async function main() {
  const payload = {
    role: 'Risk Manager',
    keywords: [],
    seniority: ['Senior', 'Lead-Coordinador'],
    experience: '5-7',
    country: 'Colombia',
    modality: ['Remoto', 'Híbrido'],
    contractType: null,
    industry: ['Fintech', 'Banca y Seguros'],
    minSalary: null,
    sources: ['Computrabajo', 'ElEmpleo', 'Remotive', 'Arbeitnow', 'The Muse'],
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
  if (res.status !== 200) { console.log(data); return; }
  console.log('colombiaQueryEs:', data.colombiaQueryEs, '| queryEs:', data.queryEs);
  console.log('colombia.count:', data.colombia.count, '| remotoGlobal.count:', data.remotoGlobal.count);
  console.log('Scores:', [...data.colombia.jobs, ...data.remotoGlobal.jobs].map((j) => j.compatibilityScore).slice(0, 10));
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
