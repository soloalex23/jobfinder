async function main() {
  const payload = {
    role: null,
    keywords: ['SARLAFT', 'cumplimiento', 'riesgo'],
    seniority: [],
    experience: null,
    country: 'Colombia',
    modality: [],
    contractType: null,
    industry: [],
    minSalary: null,
    sources: ['Computrabajo', 'Indeed Colombia', 'ElEmpleo', 'Remotive', 'The Muse', 'Arbeitnow'],
    cvText: null,
    cvSkills: [],
  };

  const res = await fetch('http://localhost:3000/api/jobs/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log('status:', res.status);
  console.log('colombiaQueryEs (enviada a Computrabajo/ElEmpleo):', data.colombiaQueryEs);
  console.log('colombiaQueryEn:', data.colombiaQueryEn);
  console.log('queryEs (fuentes globales):', data.queryEs);
  console.log('queryEn (fuentes globales):', data.queryEn);
  console.log('sourcesUsed:', data.sourcesUsed, '| sourcesFailed:', data.sourcesFailed);
  console.log('colombia.count (pasaron el filtro):', data.colombia.count);
  console.log('remotoGlobal.count:', data.remotoGlobal.count);

  console.log('\nTop 3 Colombia:');
  data.colombia.jobs.slice(0, 3).forEach((j) => {
    console.log(` [${j.sourceKey}] score=${j.compatibilityScore} | ${j.title} @ ${j.company} (${j.location})`);
  });
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
