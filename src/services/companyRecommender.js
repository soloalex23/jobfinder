const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const config = require('../config');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = 'Eres un experto en mercado laboral colombiano e internacional. '
  + 'Conoces qué sistema de tracking de candidatos (ATS) usa cada empresa. '
  + 'Devuelves SOLO JSON válido sin markdown ni explicaciones. '
  + 'Todo texto en español debe estar en español neutro/latinoamericano estándar, sin modismos regionales ni voseo.';

function buildUserPrompt({
  cargoActual, industria, industrias, habilidades, empresasPrevias, experienciaTotalAnios,
}) {
  const cargoText = cargoActual || 'no especificado';
  const industriaText = industria || 'no especificada';
  const industriasText = industrias && industrias.length ? industrias.join(', ') : 'no especificadas';
  const habilidadesText = habilidades && habilidades.length ? habilidades.slice(0, 10).join(', ') : 'no especificadas';
  const empresasText = empresasPrevias && empresasPrevias.length
    ? empresasPrevias.map((e) => (typeof e === 'string' ? e : e?.nombre)).filter(Boolean).join(', ')
    : 'no disponible';
  const experienciaText = experienciaTotalAnios != null ? experienciaTotalAnios : 'no especificados';

  return `Para el siguiente perfil profesional, sugiere 20 empresas donde esta persona debería buscar trabajo (10 colombianas, 10 internacionales con presencia en Colombia o que contraten remoto desde Colombia).

Perfil:
- Cargo actual: ${cargoText}
- Industria principal: ${industriaText}
- Industrias donde ha trabajado: ${industriasText}
- Habilidades clave: ${habilidadesText}
- Empresas previas: ${empresasText}
- Años de experiencia: ${experienciaText}

Para cada empresa indica:
- Si usa Greenhouse: tipo='greenhouse', su slug exacto en boards.greenhouse.io/SLUG
- Si usa Lever: tipo='lever', su slug exacto en jobs.lever.co/SLUG
- Si tiene portal propio: tipo='portal_propio', URL real de careers
- Si no se sabe: tipo='linkedin'

Prioriza empresas que genuinamente contratan perfiles similares y que tengan portales de carreras activos.

Si el perfil es académico o de investigación (cargo, industria o habilidades relacionadas con docencia, investigación, ciencia, postdoctorado, faculty, etc.), incluye universidades, centros de investigación, institutos científicos y ONGs de investigación entre las 20 sugerencias — no te limites a empresas corporativas/industria.

Devuelve exactamente:
{
  "nacionales": [
    {
      "nombre": "string",
      "industria": "string",
      "descripcion": "string",
      "tipo": "greenhouse"|"lever"|"portal_propio"|"linkedin",
      "careersUrl": "string",
      "greenhouseSlug": "string o null",
      "leverSlug": "string o null",
      "linkedin": "string"
    }
  ],
  "transnacionales": [ misma estructura ]
}`;
}

function buildAtsLookupPrompt(nombre) {
  return `¿Qué sistema de tracking de candidatos (ATS) usa la empresa "${nombre}" para publicar sus vacantes?

Devuelve exactamente este JSON sin nada más:
{
  "nombre": "${nombre}",
  "industria": "string o null",
  "descripcion": "una línea breve sobre la empresa",
  "tipo": "greenhouse"|"lever"|"portal_propio"|"linkedin",
  "careersUrl": "URL real de su página de empleos o null",
  "greenhouseSlug": "slug en boards.greenhouse.io/SLUG o null",
  "leverSlug": "slug en jobs.lever.co/SLUG o null",
  "linkedin": "https://www.linkedin.com/company/SLUG-EMPRESA/jobs/ o null"
}`;
}

function stripCodeFences(text) {
  return text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
}

async function callClaude(client, userPrompt, temperature, maxTokens = 4096) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) throw new Error('Claude no devolvió contenido de texto.');
  return textBlock.text;
}

function parseCompaniesJson(text) {
  const parsed = JSON.parse(stripCodeFences(text));
  if (!Array.isArray(parsed.nacionales) || !Array.isArray(parsed.transnacionales)) {
    throw new Error('El JSON de Claude no tiene la forma esperada (nacionales/transnacionales).');
  }
  return parsed;
}

async function checkPortalActivo(url) {
  if (!url) return false;
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { 'User-Agent': 'Mozilla/5.0 (JobFinder careers-check)' },
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function annotatePortals(companies) {
  return Promise.all(companies.map(async (company) => ({
    ...company,
    hasActivePortal: await checkPortalActivo(company.careersUrl),
  })));
}

// Perfil "nativo" del nuevo CV parser con IA -> lista de empresas sugeridas.
async function suggestCompanies(profile) {
  if (!config.anthropic.apiKey) {
    throw new Error('Falta la API key de Anthropic (ANTHROPIC_API_KEY).');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const userPrompt = buildUserPrompt(profile);

  let parsed;
  try {
    const text = await callClaude(client, userPrompt, 1.0);
    parsed = parseCompaniesJson(text);
  } catch {
    // Reintento único con temperatura más baja si el primer JSON no fue válido.
    const text = await callClaude(client, userPrompt, 0.2);
    parsed = parseCompaniesJson(text);
  }

  const [nacionales, transnacionales] = await Promise.all([
    annotatePortals(parsed.nacionales),
    annotatePortals(parsed.transnacionales),
  ]);

  return { nacionales, transnacionales };
}

// Adaptador de compatibilidad para el endpoint /recommend existente
// (usado por la sección "Empresas que podrían buscarte" de resultados),
// que recibe el perfil en forma role/industry/keywords/skills/previousCompanies
// en vez del perfil nativo del CV parser.
function adaptLegacyProfile({ role, industry, keywords, skills, previousCompanies }) {
  return {
    cargoActual: role,
    industria: industry,
    industrias: industry ? [industry] : [],
    habilidades: (skills && skills.length ? skills : keywords) || [],
    empresasPrevias: (previousCompanies || []).map((nombre) => ({ nombre })),
    experienciaTotalAnios: null,
  };
}

async function recommendCompanies(legacyProfile) {
  return suggestCompanies(adaptLegacyProfile(legacyProfile));
}

// Resuelve el ATS de UNA sola empresa agregada manualmente por el usuario
// (sin pasar por la lista de sugeridas), para el endpoint /search-portals.
async function resolveCompanyAts(nombre) {
  if (!config.anthropic.apiKey) {
    throw new Error('Falta la API key de Anthropic (ANTHROPIC_API_KEY).');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const prompt = buildAtsLookupPrompt(nombre);

  const parseOne = (text) => {
    const parsed = JSON.parse(stripCodeFences(text));
    if (!parsed.tipo) throw new Error('Respuesta de ATS sin campo "tipo".');
    return parsed;
  };

  try {
    const text = await callClaude(client, prompt, 0.3, 512);
    return parseOne(text);
  } catch {
    const text = await callClaude(client, prompt, 0.1, 512);
    return parseOne(text);
  }
}

module.exports = {
  suggestCompanies, recommendCompanies, resolveCompanyAts,
};
