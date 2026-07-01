const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = 'Eres un traductor especializado en terminología laboral y de recursos humanos. '
  + 'Devuelves SOLO JSON válido sin explicaciones ni markdown.';

function buildUserPrompt({ role, keywords, skills, industry }) {
  const roleText = role || 'no especificado';
  const keywordsText = keywords && keywords.length ? keywords.join(', ') : 'ninguna';
  const skillsText = skills && skills.length ? skills.join(', ') : 'ninguna';
  const industryText = industry || 'no especificada';

  return `Traduce este perfil de búsqueda de empleo al español Y al inglés.
Si un campo ya está en uno de los idiomas, mantenlo igual en ese idioma y tradúcelo al otro.

Perfil:
- Rol: ${roleText}
- Keywords: ${keywordsText}
- Habilidades del CV: ${skillsText}
- Industria: ${industryText}

Devuelve exactamente este JSON sin nada más:
{
  "role_es": "traducción al español",
  "role_en": "translation to english",
  "keywords_es": ["array en español"],
  "keywords_en": ["array in english"],
  "skills_es": ["habilidades en español"],
  "skills_en": ["skills in english"],
  "industry_es": "industria en español",
  "industry_en": "industry in english"
}`;
}

function stripCodeFences(text) {
  return text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
}

function isEmptyProfile({ role, keywords, skills, industry }) {
  return !role && (!keywords || !keywords.length) && (!skills || !skills.length) && !industry;
}

// Resultado "de paso" cuando no hay nada que traducir o cuando la
// traducción falla: usa el valor original en ambos idiomas para que el
// resto del pipeline (búsqueda/scoring) siga funcionando en modo degradado
// en vez de romperse.
function passthrough({ role, keywords, skills, industry }) {
  return {
    role_es: role || null,
    role_en: role || null,
    keywords_es: keywords || [],
    keywords_en: keywords || [],
    skills_es: skills || [],
    skills_en: skills || [],
    industry_es: industry || null,
    industry_en: industry || null,
  };
}

async function callClaude(client, userPrompt, temperature) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    temperature,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) throw new Error('Claude no devolvió contenido de texto.');
  return textBlock.text;
}

// Los placeholders "no especificado"/"ninguna" del prompt son solo para dar
// contexto a Claude; si se los traduce literalmente ("not specified"),
// contaminarían las queries de búsqueda. Se fuerza null/[] cuando el campo
// original venía vacío, sin importar qué haya devuelto el modelo.
function sanitizeResult(result, original) {
  const hasRole = Boolean(original.role);
  const hasKeywords = Boolean(original.keywords && original.keywords.length);
  const hasSkills = Boolean(original.skills && original.skills.length);
  const hasIndustry = Boolean(original.industry);

  return {
    role_es: hasRole ? result.role_es : null,
    role_en: hasRole ? result.role_en : null,
    keywords_es: hasKeywords ? result.keywords_es : [],
    keywords_en: hasKeywords ? result.keywords_en : [],
    skills_es: hasSkills ? result.skills_es : [],
    skills_en: hasSkills ? result.skills_en : [],
    industry_es: hasIndustry ? result.industry_es : null,
    industry_en: hasIndustry ? result.industry_en : null,
  };
}

function parseTranslationJson(text) {
  const parsed = JSON.parse(stripCodeFences(text));
  const required = ['role_es', 'role_en', 'keywords_es', 'keywords_en', 'skills_es', 'skills_en', 'industry_es', 'industry_en'];
  const missing = required.filter((key) => !(key in parsed));
  if (missing.length) throw new Error(`Faltan campos en el JSON de traducción: ${missing.join(', ')}`);
  return parsed;
}

async function translateProfileToBoths(profile) {
  const { role = null, keywords = [], skills = [], industry = null } = profile || {};

  if (isEmptyProfile({ role, keywords, skills, industry })) {
    return passthrough({ role, keywords, skills, industry });
  }

  if (!config.anthropic.apiKey) {
    console.warn('[translator] Falta ANTHROPIC_API_KEY, se usa passthrough sin traducir.');
    return passthrough({ role, keywords, skills, industry });
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const userPrompt = buildUserPrompt({ role, keywords, skills, industry });

  try {
    const text = await callClaude(client, userPrompt, 0.3);
    return sanitizeResult(parseTranslationJson(text), { role, keywords, skills, industry });
  } catch (firstErr) {
    try {
      const text = await callClaude(client, userPrompt, 0.1);
      return sanitizeResult(parseTranslationJson(text), { role, keywords, skills, industry });
    } catch (secondErr) {
      console.warn('[translator] Falló la traducción tras reintento, se usa passthrough:', secondErr.message);
      return passthrough({ role, keywords, skills, industry });
    }
  }
}

module.exports = { translateProfileToBoths };
