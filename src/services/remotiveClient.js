const axios = require('axios');
const { stripHtml } = require('../utils/textUtils');

const SEARCH_URL = 'https://remotive.com/api/remote-jobs';

// El campo "salary" de Remotive es texto libre (ej. "$20k-$25k"); se extraen
// los números presentes para obtener un rango aproximado y poder filtrar.
function parseSalaryRange(text) {
  if (!text) return { min: null, max: null };
  const regex = /(\d[\d,]*)(?:\.\d+)?\s*(k)?/gi;
  const values = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    let num = parseFloat(match[1].replace(/,/g, ''));
    if (Number.isNaN(num)) continue;
    if (match[2]) num *= 1000;
    values.push(num);
  }
  if (!values.length) return { min: null, max: null };
  return { min: Math.min(...values), max: Math.max(...values) };
}

function normalizeRemotiveJob(job) {
  const { min, max } = parseSalaryRange(job.salary);
  return {
    id: job.id,
    title: (job.title || '').trim(),
    company: (job.company_name || '').trim() || null,
    location: job.candidate_required_location || null,
    salaryMin: min,
    salaryMax: max,
    contractTime: job.job_type || null,
    contractType: null,
    category: job.category || null,
    description: stripHtml(job.description),
    url: job.url || null,
    created: job.publication_date || null,
    source: 'Remoto Global',
    sourceKey: 'remotive',
  };
}

// Mapea el tipo de contrato del formulario al valor de "job_type" de Remotive.
const CONTRACT_TYPE_MAP = {
  'tiempo completo': 'full_time',
  'medio tiempo': 'part_time',
  'freelance-contrato': 'contract',
  'prácticas-pasantía': 'internship',
  'practicas-pasantia': 'internship',
};

async function searchRemotiveJobs({ keywords, contractType, limit = 20 }) {
  const params = {};
  if (keywords) params.search = keywords;

  const { data } = await axios.get(SEARCH_URL, { params });
  let jobs = (data.jobs || []).map(normalizeRemotiveJob);

  const mappedType = contractType && CONTRACT_TYPE_MAP[contractType.trim().toLowerCase()];
  if (mappedType) {
    jobs = jobs.filter((job) => job.contractTime === mappedType);
  }

  return { count: jobs.length, results: jobs.slice(0, limit) };
}

module.exports = { searchRemotiveJobs };
