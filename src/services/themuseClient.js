const axios = require('axios');
const { stripHtml } = require('../utils/textUtils');

const SEARCH_URL = 'https://www.themuse.com/api/public/jobs';

function normalizeMuseJob(item) {
  return {
    id: item.id,
    title: item.name,
    company: item.company?.name || null,
    location: (item.locations || []).map((l) => l.name).join(', ') || null,
    salaryMin: null,
    salaryMax: null,
    contractTime: item.levels?.[0]?.name || null,
    contractType: null,
    category: (item.categories || []).map((c) => c.name).join(', ') || null,
    description: stripHtml(item.contents),
    url: item.refs?.landing_page || null,
    created: item.publication_date || null,
    source: 'Remoto Global',
    sourceKey: 'themuse',
  };
}

async function searchMuseJobs({ keywords, page = 1 }) {
  const params = { descending: true, page };
  if (keywords) params.query = keywords;

  const { data } = await axios.get(SEARCH_URL, { params });
  const jobs = (data.results || []).map(normalizeMuseJob);

  return { count: data.total ?? jobs.length, results: jobs };
}

module.exports = { searchMuseJobs };
