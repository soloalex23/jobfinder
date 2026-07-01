async function main() {
  const payload = {
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

  const start = Date.now();
  const res = await fetch('http://localhost:3000/api/jobs/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log('status:', res.status, 'tiempo:', Date.now() - start, 'ms');
  console.log('query:', data.query);
  console.log('sourcesUsed:', data.sourcesUsed);
  console.log('sourcesFailed:', data.sourcesFailed);
  console.log('colombia.count:', data.colombia?.count, '| remotoGlobal.count:', data.remotoGlobal?.count);
  console.log('');
  console.log('=== Vacantes en Colombia (top 5) ===');
  (data.colombia?.jobs || []).slice(0, 5).forEach((j) => {
    console.log(`[${j.source}] score=${j.compatibilityScore} | ${j.title} @ ${j.company} (${j.location})`);
  });
  console.log('');
  console.log('=== Conteo por fuente (colombia) ===');
  const counts = {};
  (data.colombia?.jobs || []).forEach((j) => { counts[j.source] = (counts[j.source] || 0) + 1; });
  console.log(counts);
  console.log('');
  console.log('=== Oportunidades remotas globales (top 5) ===');
  (data.remotoGlobal?.jobs || []).slice(0, 5).forEach((j) => {
    console.log(`score=${j.compatibilityScore} | ${j.title} @ ${j.company} (${j.location})`);
  });
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
