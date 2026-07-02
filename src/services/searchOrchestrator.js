const { searchComputrabajo } = require('./computrabajoClient');
const { searchIndeed } = require('./indeedClient');
const { searchElEmpleo } = require('./elempleoClient');
const { searchRemotiveJobs } = require('./remotiveClient');
const { searchMuseJobs } = require('./themuseClient');
const { searchArbeitnowJobs } = require('./arbeitnowClient');
const { searchAdzunaJobs } = require('./adzunaClient');
const { inferSeniority } = require('../utils/seniority');
const { delay } = require('../utils/scrapeUtils');

const SOURCE_KEYS = {
  Computrabajo: 'computrabajo',
  'Indeed Colombia': 'indeed',
  ElEmpleo: 'elempleo',
  Remotive: 'remotive',
  Arbeitnow: 'arbeitnow',
  'The Muse': 'themuse',
  'Academia (Adzuna)': 'adzuna',
};
const ALL_SOURCE_KEYS = Object.values(SOURCE_KEYS);

// A/B/C (Computrabajo, Indeed, ElEmpleo): query_es como primaria, query_en
// como secundaria. Se ejecutan de forma secuencial con delay antes de cada
// request (dos rondas por fuente, una por idioma) para no golpear los
// sitios en simultáneo. Si una falla (403, bloqueo, timeout), se omite en
// silencio y se continúa con las demás.
async function searchColombiaSources(queryEs, queryEn, enabled) {
  const results = [];
  const sourcesUsed = [];
  const sourcesFailed = [];

  const specs = [
    { key: 'computrabajo', fn: searchComputrabajo, delayMs: 1500 },
    { key: 'indeed', fn: searchIndeed, delayMs: 1500 },
    { key: 'elempleo', fn: searchElEmpleo, delayMs: 1000 },
  ];

  for (const { key, fn, delayMs } of specs) {
    if (!enabled.has(key)) continue;
    let succeededOnce = false;

    for (const q of [queryEs, queryEn]) {
      await delay(delayMs);
      try {
        const { results: found } = await fn(q);
        results.push(...found);
        succeededOnce = true;
      } catch (err) {
        console.warn(`[searchOrchestrator] ${key} falló para "${q}":`, err.message);
      }
    }

    if (succeededOnce) sourcesUsed.push(key);
    else sourcesFailed.push(key);
  }

  return { results, sourcesUsed, sourcesFailed };
}

// D/E/F/G (Remotive, The Muse, Arbeitnow, Adzuna-Academia): query_en
// primaria, query_es secundaria. Todas se piden en paralelo por ser APIs
// JSON sin riesgo de bloqueo por rate limiting agresivo.
async function searchGlobalSources(queryEs, queryEn, enabled, { modality, contractType, country }) {
  const specs = [];
  if (enabled.has('remotive') && modality?.trim().toLowerCase() !== 'presencial') {
    specs.push({ key: 'remotive', fn: (q) => searchRemotiveJobs({ keywords: q, contractType, limit: 20 }) });
  }
  if (enabled.has('arbeitnow')) {
    specs.push({ key: 'arbeitnow', fn: (q) => searchArbeitnowJobs({ keywords: q, modality }) });
  }
  if (enabled.has('themuse')) {
    specs.push({ key: 'themuse', fn: (q) => searchMuseJobs({ keywords: q, page: 1 }) });
  }
  if (enabled.has('adzuna')) {
    specs.push({ key: 'adzuna', fn: (q) => searchAdzunaJobs({ keywords: q, country }) });
  }

  const tasks = [];
  specs.forEach(({ key, fn }) => {
    tasks.push({ key, promise: fn(queryEn) });
    tasks.push({ key, promise: fn(queryEs) });
  });

  const settled = await Promise.allSettled(tasks.map((t) => t.promise));
  const results = [];
  const successKeys = new Set();
  const attemptedKeys = new Set();

  settled.forEach((outcome, i) => {
    const { key } = tasks[i];
    attemptedKeys.add(key);
    if (outcome.status === 'fulfilled') {
      results.push(...outcome.value.results);
      successKeys.add(key);
    } else {
      console.warn(`[searchOrchestrator] Fuente "${key}" falló:`, outcome.reason?.message || outcome.reason);
    }
  });

  const sourcesUsed = Array.from(successKeys);
  const sourcesFailed = Array.from(attemptedKeys).filter((k) => !successKeys.has(k));

  return { results, sourcesUsed, sourcesFailed };
}

async function searchAllSources({
  queryEs, queryEn, colombiaQueryEs, colombiaQueryEn, modality, contractType, country, sources,
}) {
  const requested = Array.isArray(sources) && sources.length
    ? sources.map((s) => SOURCE_KEYS[s] || s)
    : ALL_SOURCE_KEYS;
  const enabled = new Set(requested);

  const [colombia, global] = await Promise.all([
    searchColombiaSources(colombiaQueryEs || queryEs, colombiaQueryEn || queryEn, enabled),
    searchGlobalSources(queryEs, queryEn, enabled, { modality, contractType, country }),
  ]);

  let results = [...colombia.results, ...global.results];
  const sourcesUsed = Array.from(new Set([...colombia.sourcesUsed, ...global.sourcesUsed]));
  const sourcesFailed = Array.from(new Set([...colombia.sourcesFailed, ...global.sourcesFailed]))
    .filter((k) => !sourcesUsed.includes(k));

  results = results.map((job) => ({ ...job, seniority: inferSeniority(job.title) }));

  return { results, sourcesUsed, sourcesFailed };
}

module.exports = { searchAllSources };
