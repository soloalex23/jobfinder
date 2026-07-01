const STOPWORDS = new Set([
  // Español
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por',
  'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'mas', 'pero',
  'sus', 'le', 'ya', 'o', 'este', 'si', 'porque', 'esta', 'entre', 'cuando',
  'muy', 'sin', 'sobre', 'tambien', 'me', 'hasta', 'donde', 'quien', 'desde',
  'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros',
  'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mi', 'antes', 'algunos',
  'unos', 'yo', 'otro', 'otras', 'otra', 'tanto', 'esa', 'estos',
  // Inglés
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'as', 'at', 'by', 'from', 'this',
  'that', 'it', 'we', 'you', 'your', 'our', 'will', 'have', 'has', 'had',
]);

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita acentos
}

function tokenize(text) {
  if (!text) return [];
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function uniqueTokens(text) {
  return Array.from(new Set(tokenize(text)));
}

// Palabras significativas de una frase (sin filtrar stopwords, solo
// normaliza y descarta palabras de 1 letra) — usado para comparar keywords
// individuales, donde no queremos perder términos cortos como "IA" o "QA".
function significantWords(phrase) {
  if (!phrase) return [];
  return phrase.trim().split(/\s+/).map((w) => normalize(w)).filter((w) => w.length > 1);
}

const HTML_ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&rsquo;': "'", '&ldquo;': '"', '&rdquo;': '"',
};

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, (entity) => HTML_ENTITIES[entity] || ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { normalize, tokenize, uniqueTokens, stripHtml, significantWords };
