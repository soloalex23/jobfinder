const axios = require('axios');
const { stripHtml } = require('../utils/textUtils');

const SEARCH_URL = 'https://www.arbeitnow.com/api/job-board-api';

function normalizeArbeitnowJob(item) {
  return {
    id: item.slug,
    title: item.title,
    company: item.company_name || null,
    location: item.location || (item.remote ? 'Remote' : null),
    salaryMin: null,
    salaryMax: null,
    contractTime: item.job_types?.[0] || null,
    contractType: null,
    category: (item.tags || []).join(', ') || null,
    description: stripHtml(item.description),
    url: item.url || null,
    created: item.created_at ? new Date(item.created_at * 1000).toISOString() : null,
    remote: Boolean(item.remote),
    source: 'Remoto Global',
    sourceKey: 'arbeitnow',
  };
}

async function searchArbeitnowJobs({ keywords, modality }) {
  const params = {};
  if (keywords) params.search = keywords;

  const { data } = await axios.get(SEARCH_URL, { params });
  let jobs = (data.data || []).map(normalizeArbeitnowJob);

  const m = (modality || '').trim().toLowerCase();
  if (/^remot[oa]?$/.test(m)) {
    jobs = jobs.filter((job) => job.remote);
  } else if (m === 'presencial') {
    jobs = jobs.filter((job) => !job.remote);
  }
  // "Híbrido" no tiene equivalente confiable en los datos de Arbeitnow: no se filtra.

  return { count: jobs.length, results: jobs };
}

module.exports = { searchArbeitnowJobs };
