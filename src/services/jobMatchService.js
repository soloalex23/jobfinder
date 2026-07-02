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

function langLabel(language) {
  return language === 'en' ? 'English' : 'Español';
}

function langInstructionLine(language) {
  return language === 'en'
    ? 'Write everything in English.'
    : 'Escribe todo en español neutro/latinoamericano estándar, sin modismos regionales (evita el voseo — no uses "compará", "generá", "tenés"; usa "compara", "genera", "tienes").';
}

// ─── ANÁLISIS DE COMPATIBILIDAD (CV vs Job Description) ────────────────────

async function analyzeMatch(cvText, cvData, jobDescription, language) {
  const lang = langLabel(language);

  const prompt = `Eres un experto en reclutamiento técnico con 15 años de experiencia evaluando qué tan bien encaja un candidato con una vacante específica. Tu análisis debe ser honesto y riguroso — nunca infles el score ni inventes coincidencias que no existen en el CV.

Compara el CV del candidato contra la Job Description (JD) y devuelve SOLO un JSON válido con esta estructura exacta (sin markdown, sin explicaciones, solo el JSON):

{
  "score": <número 0-100>,
  "nivel": <"Excelente" | "Buena" | "Regular" | "Baja">,
  "resumenEjecutivo": "<2-3 oraciones explicando el ajuste general candidato-vacante>",
  "desglose": [
    { "categoria": "Habilidades y Keywords", "peso": 35, "puntaje": <0-100>, "comentario": "<explicación breve>" },
    { "categoria": "Experiencia y Seniority", "peso": 25, "puntaje": <0-100>, "comentario": "<explicación breve>" },
    { "categoria": "Rol y Funciones", "peso": 20, "puntaje": <0-100>, "comentario": "<explicación breve>" },
    { "categoria": "Industria y Contexto", "peso": 10, "puntaje": <0-100>, "comentario": "<explicación breve>" },
    { "categoria": "Educación y Certificaciones", "peso": 10, "puntaje": <0-100>, "comentario": "<explicación breve>" }
  ],
  "keywordsCoincidentes": ["<keyword/skill de la JD que sí está en el CV>"],
  "keywordsFaltantes": ["<keyword/skill de la JD que NO está en el CV>"],
  "fortalezas": ["<fortaleza del candidato para esta vacante específica, 3 a 5>"],
  "brechas": ["<brecha u omisión concreta frente a la JD, 3 a 5>"],
  "recomendacionesPrioritarias": ["<acción concreta que el candidato puede tomar, exactamente 3>"],
  "empresaDetectada": "<nombre de la empresa si aparece claramente en la JD, o null>"
}

REGLAS CRÍTICAS:
- El "score" es un promedio ponderado real de los puntajes por categoría según su "peso" — no un número arbitrario
- Si una keyword/skill de la JD no aparece explícitamente ni implícitamente en el CV, va en "keywordsFaltantes", nunca en "keywordsCoincidentes"
- No asumas experiencia que el candidato no mencionó — si hay duda, trátalo como brecha, no como fortaleza
- "empresaDetectada" solo si el nombre de la empresa aparece de forma clara y explícita en el texto de la JD; si no estás seguro, usa null

IDIOMA DE SALIDA: ${lang}. ${langInstructionLine(language)}

CV DEL CANDIDATO (texto):
---
${cvText}
---

CV DEL CANDIDATO (datos estructurados, para contexto adicional):
${JSON.stringify(cvData || {}, null, 2)}

JOB DESCRIPTION:
---
${jobDescription}
---`;

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(stripCodeFences(extractText(response)));
}

// ─── CV AJUSTADO A LA JD ────────────────────────────────────────────────────

async function adjustCv(cvData, jobDescription, matchReport, language) {
  const lang = langLabel(language);

  const prompt = `Eres un experto en redacción de CVs de alto impacto. Tu tarea es ajustar el CV de un candidato para que encaje mejor con una vacante específica, sin inventar nunca experiencia, habilidades o logros que el candidato no tiene.

CV ORIGINAL (datos estructurados):
${JSON.stringify(cvData || {}, null, 2)}

JOB DESCRIPTION:
---
${jobDescription}
---

${matchReport ? `REPORTE DE COMPATIBILIDAD PREVIO (para coherencia — brechas y keywords faltantes detectadas):\n${JSON.stringify(matchReport, null, 2)}\n` : ''}

IDIOMA DE SALIDA: ${lang}. ${langInstructionLine(language)}

INSTRUCCIONES:
- Reescribe el resumen/perfil profesional para que hable directamente al rol de la JD, usando el lenguaje y las prioridades de la vacante
- Reordena y enfatiza las funciones/logros que sean más relevantes para esta JD específica primero
- Inyecta las keywords faltantes identificadas SOLO donde son honestas — es decir, solo si el candidato genuinamente tiene esa experiencia/habilidad pero no la había mencionado con esas palabras exactas. NUNCA inventes experiencia, herramientas o resultados que el candidato no tiene
- Mantén todos los trabajos, fechas y datos reales del candidato — no omitas experiencia real
- Los logros deben mantener verbos de acción fuertes y métricas cuando el CV original ya las tenía

Genera SOLO un JSON válido con esta estructura (sin markdown, sin backticks):

{
  "data": {
    "nombre": "<nombre completo>",
    "titulo": "<cargo/título profesional ajustado al lenguaje de la JD, o null>",
    "contacto": {
      "email": "<email o null>",
      "telefono": "<teléfono o null>",
      "ciudad": "<ciudad/país o null>",
      "linkedin": "<URL o null>"
    },
    "resumen": "<resumen profesional reescrito y orientado a esta JD>",
    "experiencia": [
      { "cargo": "<cargo>", "empresa": "<empresa>", "ubicacion": "<ciudad/modalidad o null>", "fechaInicio": "<MM/YYYY o año>", "fechaFin": "<MM/YYYY, año, o \\"Actual\\">", "logros": ["<logro, reordenados/enfatizados según relevancia para la JD>"] }
    ],
    "educacion": [
      { "titulo": "<título>", "institucion": "<institución>", "año": "<año/periodo>" }
    ],
    "skills": ["<habilidad, incluyendo keywords faltantes agregadas honestamente>"]
  },
  "cambiosRealizados": ["<explicación breve de un cambio concreto que hiciste, para mostrarle al usuario qué se ajustó — 3 a 6 items>"]
}

Si un dato no existe en el CV original, usar null o array vacío — nunca inventar.`;

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(stripCodeFences(extractText(response)));
}

// ─── COVER LETTER ────────────────────────────────────────────────────────────

async function generateCoverLetterContent(cvData, jobDescription, companyName, language) {
  const lang = langLabel(language);
  // La fecha se calcula acá en vez de pedírsela a Claude: el modelo no tiene
  // forma confiable de saber la fecha real del día en que corre la request.
  const today = new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const prompt = `Eres un experto en redacción de cartas de presentación (cover letters) profesionales. Tu tarea es escribir una carta de presentación honesta y persuasiva basada en el CV real del candidato y la vacante a la que aplica.

CV DEL CANDIDATO (datos estructurados):
${JSON.stringify(cvData || {}, null, 2)}

JOB DESCRIPTION:
---
${jobDescription}
---

EMPRESA: ${companyName}

IDIOMA DE SALIDA: ${lang}. ${langInstructionLine(language)}

INSTRUCCIONES:
- Usa solo logros y experiencia reales del CV — nunca inventes resultados o experiencia que el candidato no tiene
- Párrafo 1 (apertura/gancho): por qué aplica, mención directa del rol y la empresa
- Párrafo 2 (valor): 2-3 logros/experiencias concretas del CV que se alinean directamente con lo que pide la JD
- Párrafo 3 (cierre): disponibilidad, agradecimiento, llamado a la acción
- Tono profesional, seguro, sin ser excesivamente formal ni genérico — debe sonar específico a este candidato y esta vacante

Genera SOLO un JSON válido con esta estructura (sin markdown, sin backticks):

{
  "data": {
    "fecha": "${today}",
    "remitente": { "nombre": "<nombre completo del candidato>", "contacto": "<email y/o teléfono del candidato separados por ' · '>" },
    "destinatario": { "empresa": "${companyName}", "puesto": "<puesto detectado en la JD, o \\"la posición\\" si no es claro>" },
    "saludo": "<saludo profesional dirigido a la empresa>",
    "parrafos": ["<párrafo 1>", "<párrafo 2>", "<párrafo 3>"],
    "despedida": "<frase de despedida profesional>",
    "firma": "<nombre completo del candidato>"
  }
}`;

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(stripCodeFences(extractText(response)));
}

module.exports = { analyzeMatch, adjustCv, generateCoverLetterContent };
