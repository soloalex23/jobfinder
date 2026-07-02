const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

const MODEL = 'claude-sonnet-4-6';

function getClient() {
  if (!config.anthropic.apiKey) {
    throw new Error('Falta la API key de Anthropic (ANTHROPIC_API_KEY).');
  }
  return new Anthropic({ apiKey: config.anthropic.apiKey });
}

function extractText(response) {
  const block = response.content.find((b) => b.type === 'text');
  if (!block) throw new Error('Claude no devolvió contenido de texto.');
  return block.text;
}

function stripCodeFences(text) {
  return text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
}

// ─── ANÁLISIS ATS ───────────────────────────────────────────────────────────

async function analyzeATS(cvText) {
  const prompt = `Eres un experto en reclutamiento y sistemas ATS (Applicant Tracking Systems) con 15 años de experiencia evaluando CVs para empresas Fortune 500 y startups tecnológicas. Tu análisis debe ser tan riguroso como el de un ATS real combinado con el criterio humano de un recruiter senior.

Analiza el siguiente CV con criterios ATS exhaustivos y devuelve SOLO un JSON válido con esta estructura exacta (sin markdown, sin explicaciones, solo el JSON):

{
  "scoreGeneral": <número 0-100>,
  "nivel": <"Excelente" | "Bueno" | "Regular" | "Deficiente">,
  "resumenEjecutivo": "<2-3 oraciones resumiendo el estado general del CV para ATS>",
  "categorias": {
    "formato": {
      "score": <0-100>,
      "peso": 20,
      "titulo": "Formato y Estructura",
      "hallazgos": [
        { "tipo": <"ok"|"critico"|"advertencia"|"sugerencia">, "texto": "<hallazgo específico>" }
      ]
    },
    "contenido": {
      "score": <0-100>,
      "peso": 25,
      "titulo": "Contenido y Claridad",
      "hallazgos": [...]
    },
    "keywords": {
      "score": <0-100>,
      "peso": 25,
      "titulo": "Palabras Clave y SEO",
      "hallazgos": [...]
    },
    "experiencia": {
      "score": <0-100>,
      "peso": 15,
      "titulo": "Experiencia y Logros",
      "hallazgos": [...]
    },
    "educacion": {
      "score": <0-100>,
      "peso": 5,
      "titulo": "Educación y Certificaciones",
      "hallazgos": [...]
    },
    "contacto": {
      "score": <0-100>,
      "peso": 5,
      "titulo": "Datos de Contacto",
      "hallazgos": [...]
    },
    "legibilidad": {
      "score": <0-100>,
      "peso": 5,
      "titulo": "Legibilidad para ATS",
      "hallazgos": [...]
    }
  },
  "problemasRojos": ["<problema crítico 1>", "<problema crítico 2>"],
  "recomendacionesPrioritarias": ["<acción concreta 1>", "<acción concreta 2>", "<acción concreta 3>"],
  "fortalezas": ["<fortaleza 1>", "<fortaleza 2>"],
  "keywordsDetectadas": ["<keyword 1>", "<keyword 2>"],
  "keywordsFaltantes": ["<keyword sugerida 1>", "<keyword sugerida 2>"],
  "seccionesDetectadas": ["<sección encontrada>"],
  "seccionesFaltantes": ["<sección recomendada faltante>"],
  "industria": "<industria inferida del CV>",
  "cargoObjetivo": "<cargo inferido del perfil>"
}

CRITERIOS DE EVALUACIÓN que debes aplicar con máximo rigor:

FORMATO (20%):
- ¿Usa columnas múltiples que confunden el parser ATS? (crítico si sí)
- ¿Hay tablas para organizar información? (crítico — los ATS no las leen bien)
- ¿Usa headers/footers con información importante? (crítico — ATS los ignora)
- ¿El orden de las secciones es lógico? (Contacto > Resumen > Experiencia > Educación > Skills)
- ¿Hay elementos gráficos, iconos o barras de progreso para skills? (advertencia)
- ¿Usa fuentes estándar legibles? (Arial, Calibri, Times, etc.)
- ¿El CV tiene longitud apropiada? (1 página < 5 años exp; 2 páginas ideal; +3 páginas = problema)

CONTENIDO (25%):
- ¿Cada cargo tiene descripción de responsabilidades con verbos de acción?
- ¿Se usan métricas y logros cuantificables? (aumenté ventas 30%, reduje costos X%)
- ¿El resumen/objetivo está bien redactado y es relevante?
- ¿Las descripciones son específicas o genéricas?
- ¿Hay redundancia innecesaria?
- ¿Los títulos de cargo son estándar o creativos/inusuales? (los creativos no los parsea el ATS)

KEYWORDS (25%):
- ¿El título del cargo objetivo aparece en el CV?
- ¿Las habilidades técnicas están listadas explícitamente?
- ¿Se usan acrónimos Y su versión completa? (ej: "Recursos Humanos (RR.HH.)")
- ¿Las keywords están distribuidas naturalmente o ausentes?
- ¿Hay keywords de industria relevantes?

EXPERIENCIA (15%):
- ¿Las fechas están en formato consistente y parseable? (MM/YYYY o Month YYYY)
- ¿Hay gaps de empleo sin explicación?
- ¿La progresión de carrera es lógica?
- ¿Las empresas son identificables?
- ¿Se listan logros o solo responsabilidades?

EDUCACIÓN (5%):
- ¿Título, institución y año están presentes?
- ¿Las certificaciones relevantes están incluidas?

CONTACTO (5%):
- ¿Email profesional presente?
- ¿LinkedIn URL presente?
- ¿Teléfono presente?
- ¿Ciudad/país presente? (no dirección completa)
- ¿El email tiene dominio profesional o genérico?

LEGIBILIDAD ATS (5%):
- ¿Usa caracteres especiales problemáticos?
- ¿Los bullet points son estándar (•, -, *)?
- ¿Las secciones tienen headers claros?
- ¿El texto es seleccionable (no imagen)?

Responde siempre en español neutro/latinoamericano estándar, sin modismos regionales (evita el voseo — no uses "revisá", "fijate", "tenés"; usa "revisa", "fíjate", "tienes").

CV A ANALIZAR:
---
${cvText}
---`;

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(stripCodeFences(extractText(response)));
}

// ─── MEJORA DEL CV ──────────────────────────────────────────────────────────
// Cada versión se genera en su propia llamada a Claude (en paralelo con
// Promise.all) en vez de pedir las dos en un solo prompt: una sola llamada
// generando dos CVs HTML completos se acercaba/excedía el timeout del fetch
// del frontend. Separarlas reduce el tiempo de cada llamada individual y deja
// que corran en paralelo en vez de sumarse.

function commonInstructions(lang) {
  return `PARA EL HTML — debe:
- Ser un HTML completo y válido con <html><head><body>
- Incluir todos los estilos inline o en <style> en el <head>
- Estar optimizado para impresión/PDF (usar @media print)
- Ancho fijo de 794px (A4)
- Márgenes: 40px laterales, 30px arriba/abajo
- Fuente base: 11px Inter o Arial
- SIN JavaScript
- SIN imágenes externas
- Todo el contenido real del candidato incluido, escrito en ${lang}
- El CV se va a imprimir/guardar como PDF desde el navegador: el <head> debe incluir SIEMPRE, sin excepción, estas dos líneas exactas para que los colores de fondo (headers, acentos) se impriman correctamente en vez de salir en blanco:
  <meta name="color-scheme" content="light">
  <style>* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } </style>`;
}

async function generateVersion(cvText, atsReport, language, spec) {
  const lang = language === 'en' ? 'English' : 'Español';
  const langInstruction = language === 'en'
    ? 'Write everything in English.'
    : 'Escribe todo en español neutro/latinoamericano estándar, sin modismos regionales (evita el voseo — no uses "revisá", "generá", "tenés"; usa "revisa", "genera", "tienes").';

  const prompt = `Eres un experto en redacción de CVs de alto impacto y ATS optimization.

Tienes el CV original de un candidato y un reporte ATS detallado con sus problemas. Tu tarea es generar UNA versión mejorada del CV: ${spec.titulo}.

IDIOMA DE SALIDA: ${lang}. ${langInstruction}

REPORTE ATS (problemas detectados):
${JSON.stringify(atsReport, null, 2)}

CV ORIGINAL:
---
${cvText}
---

Genera SOLO un JSON válido con esta estructura (sin markdown, sin backticks):

{
  "titulo": "${spec.titulo}",
  "descripcion": "${spec.descripcion}",
  "html": "<HTML completo del CV>",
  "data": {
    "nombre": "<nombre completo>",
    "titulo": "<cargo/título profesional actual o más reciente, o null>",
    "contacto": {
      "email": "<email o null>",
      "telefono": "<teléfono o null>",
      "ciudad": "<ciudad/país o null>",
      "linkedin": "<URL o null>"
    },
    "resumen": "<mismo resumen profesional usado en el HTML, sin HTML ni markdown>",
    "experiencia": [
      { "cargo": "<cargo>", "empresa": "<empresa>", "ubicacion": "<ciudad/modalidad o null>", "fechaInicio": "<MM/YYYY o año>", "fechaFin": "<MM/YYYY, año, o \\"Actual\\">", "logros": ["<logro/responsabilidad individual, mismo contenido que en el HTML>"] }
    ],
    "educacion": [
      { "titulo": "<título>", "institucion": "<institución>", "año": "<año/periodo>" }
    ],
    "skills": ["<habilidad>"]
  }
}

INSTRUCCIONES:
${spec.instrucciones}

${commonInstructions(lang)}

PARA "data" — es la misma información y el mismo contenido optimizado que usaste en el HTML (mismas descripciones mejoradas, mismas keywords agregadas), pero como datos planos en ${lang}, sin HTML ni markdown. Se usa para generar el DOCX descargable con estilos reales aplicados por campo. Incluir TODA la experiencia y educación reales del candidato (no resumir ni omitir). "logros" son bullets individuales, no un párrafo. Si un dato no existe en el CV original, usar null o array vacío — nunca inventar.`;

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 9000,
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(stripCodeFences(extractText(response)));
}

const VERSION1_SPEC = {
  titulo: 'CV Optimizado — Estructura Original',
  descripcion: 'Misma estructura y secciones del CV original, contenido optimizado para ATS',
  instrucciones: `- Mantener el mismo orden de secciones del CV original
- Mantener todos los trabajos, educación y datos del candidato
- Reescribir las descripciones con verbos de acción fuertes y métricas donde sea posible
- Agregar keywords faltantes identificadas en el reporte ATS de forma natural
- Corregir todos los problemas críticos y advertencias del reporte
- NO usar tablas — solo texto, listas y párrafos
- Expandir el perfil/resumen si es débil`,
};

const VERSION2_SPEC = {
  titulo: 'CV Profesional — Diseño JobFinder',
  descripcion: 'Diseño limpio y moderno 100% optimizado para ATS con propuesta visual propia',
  instrucciones: `- Estructura limpia y ordenada: Contacto > Perfil Profesional > Experiencia > Educación > Habilidades > Certificaciones
- Diseño visual con colores sobrios: encabezado con fondo #1E1B4B (índigo oscuro), texto blanco en header, cuerpo en blanco con acentos #4F46E5
- Tipografía: usar Google Fonts 'Inter'
- Sin tablas, sin columnas múltiples, sin iconos decorativos — solo texto estructurado
- Bullet points limpios con • para logros y responsabilidades
- Secciones con línea separadora sutil
- Fechas en formato MM/YYYY consistente
- Skills como chips/badges sobrios en gris claro
- Métricas y logros destacados en negrita
- Footer con nombre del candidato y número de página`,
};

async function improveCV(cvText, atsReport, language) {
  const [version1, version2] = await Promise.all([
    generateVersion(cvText, atsReport, language, VERSION1_SPEC),
    generateVersion(cvText, atsReport, language, VERSION2_SPEC),
  ]);

  return { version1, version2 };
}

module.exports = { analyzeATS, improveCV };
