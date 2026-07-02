const axios = require('axios');
const config = require('../config');
const { resolveCountryCode, isAdzunaSupported } = require('../utils/country');

// Fuente académica/investigación: Adzuna es una API JSON real y estable (no
// scraping), filtrada a la categoría "teaching-jobs" — la más cercana a
// docencia/investigación/faculty que ofrece Adzuna. Se agregó después de
// comprobar que las fuentes RSS académicas candidatas (HigherEdJobs,
// jobs.ac.uk, Times Higher Education, Nature Careers, Academic Positions)
// están todas detrás de bloqueos anti-bot o sin feed accesible.
const CATEGORY = 'teaching-jobs';
const RESULTS_PER_PAGE = 20;

// Adzuna pone el país en location.area[0] (ej. "US") pero casi nunca en
// display_name (ej. "Stanford, Santa Clara County") — sin el país en el
// texto, el filtro de ubicación por país seleccionado (relevanceFilter.js)
// no puede matchear estos resultados aunque la búsqueda ya esté acotada a
// ese país vía la URL de la API. Se agrega explícitamente al string.
function buildLocationText(location) {
  const displayName = location?.display_name || '';
  const countryCode = location?.area?.[0] || '';
  if (!countryCode || displayName.toLowerCase().includes(countryCode.toLowerCase())) {
    return displayName || null;
  }
  return displayName ? `${displayName}, ${countryCode}` : countryCode;
}

function normalizeAdzunaJob(item) {
  return {
    id: String(item.id),
    title: item.title || '',
    company: item.company?.display_name || null,
    location: buildLocationText(item.location),
    salaryMin: item.salary_min ?? null,
    salaryMax: item.salary_max ?? null,
    contractTime: item.contract_time || null,
    contractType: item.contract_type || null,
    category: item.category?.label || null,
    description: item.description || null,
    url: item.redirect_url || null,
    created: item.created || null,
    source: 'Academia (Adzuna)',
    sourceKey: 'adzuna',
  };
}

// Adzuna solo cubre un set fijo de países (ver ADZUNA_SUPPORTED_CODES en
// utils/country.js) y requiere el código en la URL. Si el país buscado no
// está soportado (ej. Colombia) o no se seleccionó ninguno, se consulta
// contra EE.UU. — el mercado académico en inglés más grande y el default
// razonable para esta fuente, que ya es mayormente EE.UU./internacional.
function resolveAdzunaCountry(country) {
  const code = resolveCountryCode(country);
  return isAdzunaSupported(code) ? code : 'us';
}

async function searchAdzunaJobs({ keywords, country }) {
  if (!config.adzuna.appId || !config.adzuna.appKey) {
    return { count: 0, results: [] };
  }

  const countryCode = resolveAdzunaCountry(country);
  const url = `${config.adzuna.baseUrl}/${countryCode}/search/1`;

  const params = {
    app_id: config.adzuna.appId,
    app_key: config.adzuna.appKey,
    results_per_page: RESULTS_PER_PAGE,
    category: CATEGORY,
  };
  if (keywords) params.what = keywords;

  const { data } = await axios.get(url, { params });
  const jobs = (data.results || []).map(normalizeAdzunaJob);

  return { count: jobs.length, results: jobs };
}

module.exports = { searchAdzunaJobs };
