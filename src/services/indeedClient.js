const axios = require('axios');
const cheerio = require('cheerio');
const { BROWSER_HEADERS, cleanQuery } = require('../utils/scrapeUtils');

const BASE_URL = 'https://co.indeed.com';
const MAX_RESULTS = 20;

function normalizeJob(item) {
  return {
    id: `indeed-${Buffer.from(item.url || item.title).toString('base64').slice(0, 24)}`,
    title: item.title,
    company: item.company || null,
    location: item.location || null,
    salaryMin: null,
    salaryMax: null,
    contractTime: null,
    contractType: null,
    category: null,
    description: item.description || '',
    url: item.url,
    created: null,
    source: 'Indeed Colombia',
    sourceKey: 'indeed',
  };
}

// Indeed protege sus resultados con Cloudflare y normalmente responde 403
// a peticiones sin navegador real. Cuando eso pasa, el orquestador debe
// capturar el error de este cliente y omitir la fuente en silencio.
async function searchIndeed(query) {
  const url = `${BASE_URL}/jobs`;

  const { data: html } = await axios.get(url, {
    params: { q: cleanQuery(query), l: 'Colombia' },
    headers: BROWSER_HEADERS,
    timeout: 10000,
    validateStatus: (status) => status === 200,
  });

  const $ = cheerio.load(html);
  const jobs = [];

  $('.job_seen_beacon, .jobsearch-SerpJobCard').each((_, el) => {
    if (jobs.length >= MAX_RESULTS) return;
    const $el = $(el);

    const title = $el.find('h2.jobTitle span[title]').first().attr('title')
      || $el.find('h2.jobTitle').first().text().trim();
    if (!title) return;

    const relativeUrl = $el.find('h2.jobTitle a').first().attr('href');
    const url = relativeUrl ? (relativeUrl.startsWith('http') ? relativeUrl : `${BASE_URL}${relativeUrl}`) : null;

    jobs.push(normalizeJob({
      title,
      company: $el.find('[data-testid="company-name"]').first().text().trim(),
      location: $el.find('[data-testid="text-location"]').first().text().trim(),
      description: $el.find('.job-snippet').first().text().trim(),
      url,
    }));
  });

  return { count: jobs.length, results: jobs };
}

module.exports = { searchIndeed };
