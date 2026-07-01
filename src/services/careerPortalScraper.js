const axios = require('axios');
const cheerio = require('cheerio');
const { BROWSER_HEADERS } = require('../utils/scrapeUtils');

const MAX_RESULTS = 5;

function queryWords(query) {
  return (query || '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1);
}

function textMatchesQuery(text, words) {
  if (!words.length) return true; // sin query, no se filtra por texto
  const norm = (text || '').toLowerCase();
  return words.some((w) => norm.includes(w));
}

// Prioriza coincidencias por título (señal confiable). Si NINGÚN título
// coincide, recién ahí se prueba con título+contenido como respaldo — el
// contenido completo de una oferta suele incluir boilerplate genérico de
// la empresa que se repite en todas las vacantes ("sobre nosotros", stack
// tecnológico general, etc.), lo que genera falsos positivos si se usa
// como primer filtro (ej. una vacante de "Account Executive" matcheando
// "developer" porque el texto legal menciona "our engineering team").
function filterPreferringTitle(items, words, getTitle, getContent) {
  if (!words.length) return items;
  const titleMatches = items.filter((item) => textMatchesQuery(getTitle(item), words));
  if (titleMatches.length) return titleMatches;
  return items.filter((item) => textMatchesQuery(`${getTitle(item)} ${getContent(item)}`, words));
}

function buildLinkedinSearchUrl(query) {
  const q = query && query.trim() ? query.trim() : 'empleo';
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=Colombia`;
}

// CASO A — Greenhouse: API pública sin autenticación.
async function searchGreenhouse(slug, words) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`;
  const { data } = await axios.get(url, {
    params: { content: true },
    timeout: 8000,
    validateStatus: (status) => status === 200,
  });

  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  return filterPreferringTitle(jobs, words, (j) => j.title, (j) => j.content)
    .slice(0, MAX_RESULTS)
    .map((job) => ({
      title: job.title,
      location: job.location?.name || null,
      url: job.absolute_url || null,
      updatedAt: job.updated_at || null,
    }));
}

// CASO B — Lever: API pública sin autenticación.
async function searchLever(slug, words) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}`;
  const { data } = await axios.get(url, {
    params: { mode: 'json' },
    timeout: 8000,
    validateStatus: (status) => status === 200,
  });

  const postings = Array.isArray(data) ? data : [];
  return filterPreferringTitle(postings, words, (p) => p.text, (p) => p.descriptionPlain || '')
    .slice(0, MAX_RESULTS)
    .map((posting) => ({
      title: posting.text,
      location: posting.categories?.location || null,
      url: posting.hostedUrl || null,
      updatedAt: posting.createdAt ? new Date(posting.createdAt).toISOString() : null,
    }));
}

// CASO C — Portal propio: scraping best-effort con cheerio. Si falla o
// bloquea (403, timeout), se devuelve [] pero se conserva careersUrl para
// que el frontend igual pueda ofrecer el link directo.
async function searchPortalPropio(careersUrl, words) {
  const { data: html } = await axios.get(careersUrl, {
    headers: BROWSER_HEADERS,
    timeout: 5000,
    validateStatus: (status) => status === 200,
  });

  const $ = cheerio.load(html);
  const seen = new Set();
  const results = [];

  $('a').each((_, el) => {
    if (results.length >= MAX_RESULTS) return;
    const $el = $(el);
    const text = $el.text().trim().replace(/\s+/g, ' ');
    if (!text || text.length > 120) return;
    if (!textMatchesQuery(text, words)) return;

    const href = $el.attr('href');
    if (!href) return;
    let absoluteUrl;
    try {
      absoluteUrl = new URL(href, careersUrl).toString();
    } catch {
      return;
    }
    if (seen.has(absoluteUrl)) return;
    seen.add(absoluteUrl);

    results.push({ title: text, location: null, url: absoluteUrl, updatedAt: null });
  });

  return results;
}

// Resultado uniforme por empresa, sin importar el tipo de fuente.
async function searchCompanyJobs(empresa, query) {
  const words = queryWords(query);
  const result = {
    empresa: empresa.nombre,
    tipo: empresa.tipo,
    vacantes: [],
    careersUrl: empresa.careersUrl || null,
    searchUrl: buildLinkedinSearchUrl(query),
    hasVacantes: false,
    error: null,
  };

  try {
    if (empresa.tipo === 'greenhouse' && empresa.greenhouseSlug) {
      result.vacantes = await searchGreenhouse(empresa.greenhouseSlug, words);
    } else if (empresa.tipo === 'lever' && empresa.leverSlug) {
      result.vacantes = await searchLever(empresa.leverSlug, words);
    } else if (empresa.tipo === 'portal_propio' && empresa.careersUrl) {
      result.vacantes = await searchPortalPropio(empresa.careersUrl, words);
    }
    // tipo === 'linkedin' (o falta el slug/URL requerido): no hay scraping,
    // solo queda el searchUrl ya calculado arriba.
  } catch (err) {
    result.error = err.message;
  }

  result.hasVacantes = result.vacantes.length > 0;
  return result;
}

module.exports = { searchCompanyJobs, buildLinkedinSearchUrl };
