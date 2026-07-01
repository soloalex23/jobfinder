const { normalize, tokenize, significantWords } = require('../utils/textUtils');
const { SENIORITY_PATTERNS } = require('../utils/seniority');
const { locationMentionsColombia } = require('../utils/relevanceFilter');
const { resolveCountryCode } = require('../utils/country');

// 40%: coincidencia de keywords del usuario (ES y EN) con título+descripción.
// keywordsEs[i]/keywordsEn[i] son la misma keyword lógica en ambos idiomas;
// cuenta como UNA sola keyword si aparece cualquiera de las dos versiones.
// Una coincidencia en el título pesa el doble que una que solo aparece en
// la descripción.
function keywordScore(keywordsEs, keywordsEn, title, description) {
  const total = Math.max(keywordsEs?.length || 0, keywordsEn?.length || 0);
  if (!total) return 0;
  const titleNorm = normalize(title || '');
  const descNorm = normalize(description || '');

  let credit = 0;
  for (let i = 0; i < total; i++) {
    const words = [...significantWords(keywordsEs?.[i]), ...significantWords(keywordsEn?.[i])];
    if (!words.length) continue;
    if (words.some((w) => titleNorm.includes(w))) credit += 1;
    else if (words.some((w) => descNorm.includes(w))) credit += 0.5;
  }

  return (credit / total) * 40;
}

// 25%: coincidencia de habilidades del CV (ES y EN) con la descripción.
// Una habilidad cuenta si su versión en español O en inglés aparece.
// Si no hay CV, este peso se redistribuye al componente de rol (roleWeight).
function skillsScore(skillsEs, skillsEn, description) {
  const total = Math.max(skillsEs?.length || 0, skillsEn?.length || 0);
  if (!total) return 0;
  const norm = normalize(description || '');

  let matched = 0;
  for (let i = 0; i < total; i++) {
    const es = skillsEs?.[i];
    const en = skillsEn?.[i];
    if ((es && norm.includes(normalize(es))) || (en && norm.includes(normalize(en)))) matched += 1;
  }

  return (matched / total) * 25;
}

// 20% (o 45% si no hay CV subido): coincidencia de palabras del rol (ES+EN)
// con el título. Combinar ambos idiomas en un solo set de palabras permite
// que "Compliance Officer" matchee "Oficial de Cumplimiento" y viceversa.
function roleScore(roleEs, roleEn, title, weight) {
  const words = Array.from(new Set([...tokenize(roleEs || ''), ...tokenize(roleEn || '')]));
  if (!words.length) return 0;
  const titleTokens = new Set(tokenize(title || ''));
  const matched = words.filter((w) => titleTokens.has(w));
  return (matched.length / words.length) * weight;
}

function matchesModality(haystack, m) {
  const mm = m.trim().toLowerCase();
  if (mm === 'remoto' && /\bremot[oa]\b|\bremote\b/.test(haystack)) return true;
  if (mm === 'presencial' && /\bpresencial\b|\bon[- ]?site\b|\boficina\b/.test(haystack)) return true;
  if (mm === 'híbrido' && /\bhibrido\b|\bhybrid\b/.test(haystack)) return true;
  return false;
}

// 15%: factores contextuales, 5 puntos cada uno. seniority y modality
// admiten array (multiselección): cuenta si CUALQUIERA de los valores
// seleccionados hace match.
function contextScore(job, { seniority, modality, country }) {
  let score = 0;
  const seniorityList = Array.isArray(seniority) ? seniority : [seniority].filter(Boolean);
  const modalityList = Array.isArray(modality) ? modality : [modality].filter(Boolean);

  if (seniorityList.length) {
    const anyMatch = seniorityList.some((sel) => {
      const pattern = SENIORITY_PATTERNS.find((p) => p.label === sel);
      return pattern && pattern.regex.test(job.description || '');
    });
    if (anyMatch) score += 5;
  }

  if (modalityList.length) {
    const haystack = normalize(`${job.title || ''} ${job.description || ''}`);
    if (modalityList.some((m) => matchesModality(haystack, m))) score += 5;
  }

  if (country) {
    const countryCode = resolveCountryCode(country);
    const matches = countryCode === 'co'
      ? locationMentionsColombia(job.location)
      : normalize(job.location || '').includes(normalize(country));
    if (matches) score += 5;
  }

  return score;
}

function scoreJob(job, {
  roleEs, roleEn, keywordsEs, keywordsEn, skillsEs, skillsEn, hasCv, seniority, modality, country,
}) {
  const kwScore = keywordScore(keywordsEs, keywordsEn, job.title, job.description);
  const skScore = hasCv ? skillsScore(skillsEs, skillsEn, job.description) : 0;
  const roleWeight = hasCv ? 20 : 45; // el 25% de habilidades se redistribuye al rol si no hay CV
  const rlScore = roleScore(roleEs, roleEn, job.title, roleWeight);
  const ctxScore = contextScore(job, { seniority, modality, country });

  const total = kwScore + skScore + rlScore + ctxScore;
  return Math.round(Math.min(100, Math.max(0, total)));
}

function scoreJobs(jobs, params) {
  const {
    roleEs, roleEn, keywordsEs = [], keywordsEn = [], skillsEs = [], skillsEn = [],
    cvText, seniority, modality, country,
  } = params;
  const hasCv = Boolean((cvText && cvText.trim()) || (skillsEs && skillsEs.length) || (skillsEn && skillsEn.length));

  return jobs
    .map((job) => ({
      ...job,
      compatibilityScore: scoreJob(job, {
        roleEs, roleEn, keywordsEs, keywordsEn, skillsEs, skillsEn, hasCv, seniority, modality, country,
      }),
    }))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
}

module.exports = { scoreJobs };
