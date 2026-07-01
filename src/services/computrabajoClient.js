const axios = require('axios');
const cheerio = require('cheerio');
const { BROWSER_HEADERS, slugifyQuery } = require('../utils/scrapeUtils');

const BASE_URL = 'https://co.computrabajo.com';
const MAX_RESULTS = 20;

function normalizeJob(item) {
  return {
    id: `computrabajo-${Buffer.from(item.url || item.title).toString('base64').slice(0, 24)}`,
    title: item.title,
    company: item.company || null,
    location: item.location || null,
    salaryMin: null,
    salaryMax: null,
    contractTime: null,
    contractType: null,
    category: null,
    description: '', // Computrabajo no expone descripción en el listado.
    url: item.url,
    created: null,
    source: 'Computrabajo',
    sourceKey: 'computrabajo',
  };
}

async function searchComputrabajo(query) {
  const slug = slugifyQuery(query);
  const url = `${BASE_URL}/trabajo-de-${slug}`;

  const { data: html } = await axios.get(url, {
    headers: BROWSER_HEADERS,
    timeout: 10000,
    validateStatus: (status) => status === 200,
  });

  const $ = cheerio.load(html);
  const jobs = [];

  $('article').each((_, el) => {
    if (jobs.length >= MAX_RESULTS) return;
    const $el = $(el);
    const titleLink = $el.find('a.js-o-link').first();
    const title = titleLink.text().trim();
    const href = titleLink.attr('href');
    if (!title || !href) return;

    const company = $el.find('a[offer-grid-article-company-url]').first().text().trim();
    const location = $el.find('p.fs16.fc_base.mt5 span.mr10').first().text().trim();

    jobs.push(normalizeJob({
      title,
      company,
      location,
      url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
    }));
  });

  return { count: jobs.length, results: jobs };
}

module.exports = { searchComputrabajo };
