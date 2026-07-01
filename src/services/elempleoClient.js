const axios = require('axios');
const cheerio = require('cheerio');
const { BROWSER_HEADERS, cleanQuery } = require('../utils/scrapeUtils');

const BASE_URL = 'https://www.elempleo.com';
const MAX_RESULTS = 15;

function normalizeJob(item) {
  return {
    id: `elempleo-${Buffer.from(item.url || item.title).toString('base64').slice(0, 24)}`,
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
    source: 'ElEmpleo',
    sourceKey: 'elempleo',
  };
}

async function searchElEmpleo(query) {
  const url = `${BASE_URL}/co/ofertas-empleo/`;

  const { data: html } = await axios.get(url, {
    params: { busqueda: cleanQuery(query) },
    headers: BROWSER_HEADERS,
    timeout: 10000,
    validateStatus: (status) => status === 200,
  });

  const $ = cheerio.load(html);
  const jobs = [];

  $('.result-item').each((_, el) => {
    if (jobs.length >= MAX_RESULTS) return;
    const $el = $(el);

    let offerData = {};
    try {
      offerData = JSON.parse($el.find('[data-ga4-offerdata]').first().attr('data-ga4-offerdata') || '{}');
    } catch {
      offerData = {};
    }

    const title = offerData.title || $el.find('.js-offer-title').first().text().trim();
    if (!title) return;

    const relativeUrl = $el.find('[data-url]').first().attr('data-url');
    const url = relativeUrl ? `${BASE_URL}${relativeUrl}` : null;

    const description = $el.find('[data-offer-description]').first().attr('data-offer-description')
      || $el.find('.result-info-hover-li-description').first().text();

    jobs.push(normalizeJob({
      title,
      company: offerData.company || $el.find('.js-offer-company').first().text().trim(),
      location: offerData.location || $el.find('.js-offer-city').first().text().trim(),
      description: (description || '').trim(),
      url,
    }));
  });

  return { count: jobs.length, results: jobs };
}

module.exports = { searchElEmpleo };
