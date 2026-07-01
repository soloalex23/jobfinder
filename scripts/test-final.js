async function main() {
  const jobsPayload = {
    role: 'Compliance Officer',
    keywords: ['SARLAFT', 'cumplimiento normativo', 'riesgo'],
    seniority: null,
    experience: null,
    country: 'Colombia',
    modality: null,
    contractType: null,
    industry: 'Derecho y Cumplimiento',
    minSalary: null,
    sources: ['Computrabajo', 'Indeed Colombia', 'ElEmpleo', 'Remotive', 'The Muse', 'Arbeitnow'],
    cvText: null,
    cvSkills: [],
  };

  const companiesPayload = {
    role: 'Compliance Officer',
    industry: 'Derecho y Cumplimiento',
    keywords: ['SARLAFT', 'cumplimiento normativo', 'riesgo'],
    skills: [],
    previousCompanies: [],
  };

  console.log('Lanzando /api/jobs/search y /api/companies/recommend en paralelo...\n');
  const [jobsRes, companiesRes] = await Promise.all([
    fetch('http://localhost:3000/api/jobs/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(jobsPayload),
    }),
    fetch('http://localhost:3000/api/companies/recommend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(companiesPayload),
    }),
  ]);

  const jobsData = await jobsRes.json();
  const companiesData = await companiesRes.json();

  console.log('=== /api/jobs/search ===');
  console.log('status:', jobsRes.status);
  console.log('query:', jobsData.query);
  console.log('sourcesUsed:', jobsData.sourcesUsed, '| sourcesFailed:', jobsData.sourcesFailed);
  console.log('colombia.count:', jobsData.colombia.count, '| remotoGlobal.count:', jobsData.remotoGlobal.count);

  const allJobs = [...jobsData.colombia.jobs, ...jobsData.remotoGlobal.jobs];
  const perSource = {};
  allJobs.forEach((j) => { perSource[j.sourceKey || j.source] = (perSource[j.sourceKey || j.source] || 0) + 1; });
  console.log('Conteo por fuente:', perSource);
  console.log('Scores únicos:', Array.from(new Set(allJobs.map((j) => j.compatibilityScore))).sort((a, b) => b - a));

  console.log('\nTop 3 Colombia:');
  jobsData.colombia.jobs.slice(0, 3).forEach((j) => console.log(` [${j.source}] score=${j.compatibilityScore} | ${j.title} @ ${j.company}`));

  console.log('\nTop 3 Remoto Global:');
  jobsData.remotoGlobal.jobs.slice(0, 3).forEach((j) => console.log(` [${j.sourceKey}] score=${j.compatibilityScore} | ${j.title} @ ${j.company}`));

  console.log('\n=== /api/companies/recommend ===');
  console.log('status:', companiesRes.status);
  console.log('nacionales:', companiesData.nacionales?.length, '| transnacionales:', companiesData.transnacionales?.length);
  console.log('Ejemplo nacional:', companiesData.nacionales?.[0]?.nombre, '| hasActivePortal:', companiesData.nacionales?.[0]?.hasActivePortal);
  console.log('Ejemplo transnacional:', companiesData.transnacionales?.[0]?.nombre, '| hasActivePortal:', companiesData.transnacionales?.[0]?.hasActivePortal);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
