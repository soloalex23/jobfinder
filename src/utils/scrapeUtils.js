const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Convierte una query libre en un slug apto para URLs tipo Computrabajo
// (espacios -> guiones, sin caracteres especiales).
function slugifyQuery(query) {
  return (query || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Limpia caracteres especiales conservando espacios normales, para las
// fuentes que usan la query como parámetro (?q=... / ?busqueda=...).
function cleanQuery(query) {
  return (query || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { BROWSER_HEADERS, delay, slugifyQuery, cleanQuery };
