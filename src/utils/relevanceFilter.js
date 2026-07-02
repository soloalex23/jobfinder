const { normalize, significantWords } = require('./textUtils');
const { resolveCountryCode, getCountryAliases } = require('./country');

const COLOMBIA_LOCATION_WORDS = [
  'colombia', 'bogota', 'medellin', 'cali', 'barranquilla', 'cartagena',
  'bucaramanga', 'pereira', 'manizales', 'santa marta', 'cucuta', 'ibague',
  'pasto', 'villavicencio', 'monteria', 'neiva', 'armenia', 'sincelejo',
  'popayan', 'tunja', 'valledupar', 'palmira', 'bello', 'soledad', 'soacha',
  'remoto', 'remote', 'hibrido',
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Coincidencia de palabra completa, no de substring — un alias corto como
// "us" o "cali" no debe matchear dentro de "Düsseldorf" o "California".
function matchesWholeWord(normalizedHaystack, word) {
  const normWord = normalize(word).trim();
  if (!normWord) return false;
  return new RegExp(`\\b${escapeRegex(normWord)}\\b`, 'i').test(normalizedHaystack);
}

function locationMentionsColombia(location) {
  if (!location) return false;
  const norm = normalize(location);
  return COLOMBIA_LOCATION_WORDS.some((word) => matchesWholeWord(norm, word));
}

// Si la ubicación menciona el país seleccionado (en español o inglés, según
// los alias conocidos en country.js), o — para Colombia específicamente —
// alguna de sus ciudades principales.
function locationMentionsCountry(location, country) {
  if (!location) return false;
  const code = resolveCountryCode(country);
  if (code === 'co') return locationMentionsColombia(location);

  const norm = normalize(location);
  const aliases = getCountryAliases(code);
  if (!aliases.length) aliases.push(country.trim().toLowerCase());
  return aliases.some((alias) => matchesWholeWord(norm, alias));
}

// 1) Si se seleccionó un país (cualquiera, no solo Colombia), descarta
//    resultados cuya ubicación no lo mencione. Las fuentes "Remoto Global"
//    siempre pasan este filtro — un trabajo remoto no siempre menciona un
//    país específico en su ubicación.
function filterByCountry(jobs, country) {
  if (!country) return jobs;
  return jobs.filter((job) => job.source === 'Remoto Global' || locationMentionsCountry(job.location, country));
}

// 2) Descarta vacantes cuyo título+descripción no contenga suficientes
//    keywords/rol (ES o EN). Ser bilingüe acá es necesario: si solo mirara
//    un idioma, una vacante en inglés podría descartarse antes de llegar
//    al scoring aunque calce vía el CV/keywords traducidos.
//
//    - Si hay rol: alcanza con 1 coincidencia (keyword o palabra del rol),
//      igual que antes — el rol ya acota bastante la búsqueda.
//    - Si NO hay rol (búsqueda solo por keywords): se exige que la vacante
//      contenga al menos 2 keywords distintas (o 1 si el usuario solo
//      puso 1 keyword). Con una sola keyword como umbral, plataformas como
//      Computrabajo/ElEmpleo devuelven demasiado ruido para búsquedas sin
//      rol definido.
function filterByKeywordMatch(jobs, {
  roleEs, roleEn, keywordsEs, keywordsEn,
}) {
  const keywordCount = Math.max(keywordsEs?.length || 0, keywordsEn?.length || 0);
  const hasRole = Boolean((roleEs && roleEs.trim()) || (roleEn && roleEn.trim()));
  const hasKeywords = keywordCount > 0;
  if (!hasRole && !hasKeywords) return jobs;

  if (hasRole) {
    const terms = [];
    for (let i = 0; i < keywordCount; i++) {
      terms.push(...significantWords(keywordsEs?.[i]), ...significantWords(keywordsEn?.[i]));
    }
    terms.push(...significantWords(roleEs), ...significantWords(roleEn));
    const normTerms = Array.from(new Set(terms));
    if (!normTerms.length) return jobs;

    return jobs.filter((job) => {
      const haystack = normalize(`${job.title || ''} ${job.description || ''}`);
      return normTerms.some((term) => haystack.includes(term));
    });
  }

  const minMatches = Math.min(2, keywordCount);
  return jobs.filter((job) => {
    const haystack = normalize(`${job.title || ''} ${job.description || ''}`);
    let matchedKeywords = 0;
    for (let i = 0; i < keywordCount; i++) {
      const words = [...significantWords(keywordsEs?.[i]), ...significantWords(keywordsEn?.[i])];
      if (words.some((w) => haystack.includes(w))) matchedKeywords += 1;
    }
    return matchedKeywords >= minMatches;
  });
}

function applyRelevanceFilters(jobs, {
  roleEs, roleEn, keywordsEs, keywordsEn, country,
}) {
  let filtered = filterByCountry(jobs, country);
  filtered = filterByKeywordMatch(filtered, {
    roleEs, roleEn, keywordsEs, keywordsEn,
  });
  return filtered;
}

module.exports = { applyRelevanceFilters, locationMentionsColombia, locationMentionsCountry };
