const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `Eres un experto en análisis de hojas de vida y perfiles profesionales.
Tu tarea es leer el texto de un CV y extraer la información de forma inteligente, independientemente del formato, idioma o estructura que use el documento.

REGLAS CRÍTICAS:
- Nunca inventes información que no esté en el CV
- Si un dato no está claro o no existe, devuelve null o array vacío
- Los títulos de secciones del CV (como "PROFESSIONAL PROFILE", "EXPERIENCIA LABORAL", "EDUCATION", etc.) NO son datos — son encabezados estructurales, ignóralos como valores
- El nombre de la persona está típicamente al inicio del documento, NO es el título de una sección
- Interpreta el contenido real de cada sección, no su título
- Si el CV está en inglés, extrae los datos en el idioma original pero también proporciona traducción al español donde se indica
- Devuelves SOLO JSON válido, sin markdown, sin explicaciones`;

function buildUserPrompt(cvText) {
  return `Analiza este CV y extrae toda la información profesional relevante.

TEXTO DEL CV:
${cvText}

Devuelve exactamente este JSON sin nada más:
{
  "nombre": "nombre completo de la persona o null",
  "cargoActual": "título del último cargo o cargo más reciente o null",
  "resumenPerfil": "descripción del perfil profesional en 3-4 oraciones, basada en el contenido real del CV, no en el título de la sección",
  "experienciaTotalAnios": número entero de años totales de experiencia o null si no se puede determinar,
  "industrias": ["lista de industrias en las que ha trabajado"],
  "habilidades": ["lista de habilidades técnicas y blandas mencionadas"],
  "habilidades_en": ["mismas habilidades traducidas al inglés"],
  "funcionesPrincipales": ["lista de 5-8 funciones o responsabilidades principales que ha tenido a lo largo de su carrera"],
  "empresasPrevias": [
    {
      "nombre": "nombre de la empresa",
      "cargo": "cargo que tuvo",
      "periodo": "fechas o duración si se mencionan",
      "descripcion": "breve descripción de sus responsabilidades ahí"
    }
  ],
  "educacion": [
    {
      "titulo": "título o grado obtenido",
      "institucion": "nombre de la institución",
      "anio": "año de graduación o periodo si se menciona"
    }
  ],
  "certificaciones": ["lista de certificaciones, cursos o formación adicional"],
  "idiomas": [
    {
      "idioma": "nombre del idioma",
      "nivel": "nivel mencionado en el CV"
    }
  ],
  "logros": ["lista de logros o achievements mencionados explícitamente"],
  "industria": "industria principal inferida de toda su experiencia"
}`;
}

function stripCodeFences(text) {
  return text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
}

// Se asegura de que todos los campos existan con el tipo correcto, sin
// importar qué haya omitido el modelo, para que el frontend nunca reciba
// undefined y pueda decidir con seguridad qué secciones mostrar.
function sanitizeParsedCv(parsed) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v) => (typeof v === 'string' && v.trim() ? v : null);
  const num = (v) => (Number.isFinite(v) ? v : (Number.isFinite(Number(v)) && v !== null ? Number(v) : null));

  return {
    nombre: str(parsed.nombre),
    cargoActual: str(parsed.cargoActual),
    resumenPerfil: str(parsed.resumenPerfil),
    experienciaTotalAnios: num(parsed.experienciaTotalAnios),
    industrias: arr(parsed.industrias).filter((x) => typeof x === 'string' && x.trim()),
    habilidades: arr(parsed.habilidades).filter((x) => typeof x === 'string' && x.trim()),
    habilidades_en: arr(parsed.habilidades_en).filter((x) => typeof x === 'string' && x.trim()),
    funcionesPrincipales: arr(parsed.funcionesPrincipales).filter((x) => typeof x === 'string' && x.trim()),
    empresasPrevias: arr(parsed.empresasPrevias).map((e) => ({
      nombre: str(e?.nombre),
      cargo: str(e?.cargo),
      periodo: str(e?.periodo),
      descripcion: str(e?.descripcion),
    })).filter((e) => e.nombre || e.cargo),
    educacion: arr(parsed.educacion).map((e) => ({
      titulo: str(e?.titulo),
      institucion: str(e?.institucion),
      anio: str(e?.anio),
    })).filter((e) => e.titulo || e.institucion),
    certificaciones: arr(parsed.certificaciones).filter((x) => typeof x === 'string' && x.trim()),
    idiomas: arr(parsed.idiomas).map((i) => ({
      idioma: str(i?.idioma),
      nivel: str(i?.nivel),
    })).filter((i) => i.idioma),
    logros: arr(parsed.logros).filter((x) => typeof x === 'string' && x.trim()),
    industria: str(parsed.industria),
  };
}

function parseJson(text) {
  return sanitizeParsedCv(JSON.parse(stripCodeFences(text)));
}

async function callClaude(client, cvText, temperature) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(cvText) }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) throw new Error('Claude no devolvió contenido de texto.');
  return textBlock.text;
}

async function parseCvWithAi(cvText) {
  if (!config.anthropic.apiKey) {
    throw new Error('Falta la API key de Anthropic (ANTHROPIC_API_KEY).');
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  try {
    const text = await callClaude(client, cvText, 0.3);
    return parseJson(text);
  } catch (firstErr) {
    const text = await callClaude(client, cvText, 0.1);
    return parseJson(text);
  }
}

module.exports = { parseCvWithAi };
