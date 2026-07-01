const { cleanQuery } = require('./scrapeUtils');

const CONNECTORS = new Set(['y', 'de', 'del', 'la', 'el', 'en', 'a', 'los', 'las', 'con', 'para', 'o']);

// Limpia conectores ("y", "de"...) de una etiqueta, preservando las
// palabras significativas. ej. "Derecho y Cumplimiento" -> "Derecho Cumplimiento"
function cleanLabelForQuery(text) {
  if (!text) return '';
  return text
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !CONNECTORS.has(word.toLowerCase()))
    .join(' ');
}

// Construye la query de búsqueda combinando rol + keywords + término
// principal de la industria (los tres se agregan si están presentes).
function buildQuery({ role, keywords, industry }) {
  const parts = [];
  if (role && role.trim()) parts.push(role.trim());
  if (Array.isArray(keywords) && keywords.length) parts.push(keywords.join(' '));
  if (industry) parts.push(cleanLabelForQuery(industry));

  return cleanQuery(parts.join(' '));
}

// Sin rol, elige UNA sola keyword/término como base de búsqueda: la
// industria (si hay) o, si no, la keyword más larga (suele ser la más
// específica, ej. "cumplimiento normativo" en vez de "riesgo"). Las demás
// keywords no se pierden: siguen disponibles para el filtro de relevancia
// post-búsqueda, solo no forman parte de la query de búsqueda en sí.
function pickPrimaryTerm({ industry, keywords }) {
  if (industry) return cleanLabelForQuery(industry);
  if (Array.isArray(keywords) && keywords.length) {
    return keywords.reduce((longest, k) => ((k || '').length > longest.length ? k : longest), '');
  }
  return '';
}

// Query específica para los scrapers de Colombia (Computrabajo/ElEmpleo):
// estas plataformas no manejan bien queries largas de varias keywords.
// Computrabajo en particular falla si el path de la URL supera ~3 palabras,
// así que maxWords trunca el resultado.
function buildScraperQuery({ role, keywords, industry }, maxWords) {
  const base = (role && role.trim()) ? role.trim() : pickPrimaryTerm({ industry, keywords });
  const cleaned = cleanQuery(base);
  if (!maxWords) return cleaned;
  return cleaned.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');
}

module.exports = {
  cleanLabelForQuery, buildQuery, pickPrimaryTerm, buildScraperQuery,
};
