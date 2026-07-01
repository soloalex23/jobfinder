async function runSearch(label, payload) {
  console.log(`\n========== ${label} ==========`);
  const start = Date.now();
  const res = await fetch('http://localhost:3000/api/jobs/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log('status:', res.status, '| tiempo:', Date.now() - start, 'ms');
  if (res.status !== 200) {
    console.log('ERROR:', data.error);
    return;
  }
  console.log('queryEs:', data.queryEs);
  console.log('queryEn:', data.queryEn);
  console.log('sourcesUsed:', data.sourcesUsed, '| sourcesFailed:', data.sourcesFailed);
  console.log('colombia.count:', data.colombia.count, '| remotoGlobal.count:', data.remotoGlobal.count);

  const allJobs = [...data.colombia.jobs, ...data.remotoGlobal.jobs];
  console.log('Scores únicos:', Array.from(new Set(allJobs.map((j) => j.compatibilityScore))).sort((a, b) => b - a));

  console.log('Top 5 combinados:');
  allJobs.slice(0, 5).forEach((j) => {
    console.log(` [${j.sourceKey || j.source}] score=${j.compatibilityScore} | ${j.title} @ ${j.company} (${j.location})`);
  });
}

async function main() {
  await runSearch('PRUEBA 1: Rol en inglés, CV en inglés', {
    role: 'Compliance Officer',
    keywords: ['SARLAFT', 'risk management', 'regulatory'],
    country: 'Colombia',
    sources: ['Computrabajo', 'Indeed Colombia', 'ElEmpleo', 'Remotive', 'The Muse', 'Arbeitnow'],
    cvText: null,
    cvSkills: [],
  });

  await runSearch('PRUEBA 2: Rol en español, sin CV', {
    role: 'Oficial de Cumplimiento',
    keywords: ['cumplimiento normativo', 'riesgo', 'auditoría'],
    country: 'Colombia',
    sources: ['Computrabajo', 'Indeed Colombia', 'ElEmpleo', 'Remotive', 'The Muse', 'Arbeitnow'],
    cvText: null,
    cvSkills: [],
  });

  await runSearch('PRUEBA 3: CV en español, rol en inglés', {
    role: 'Risk Manager',
    keywords: [],
    country: 'Colombia',
    sources: ['Computrabajo', 'Indeed Colombia', 'ElEmpleo', 'Remotive', 'The Muse', 'Arbeitnow'],
    cvText: 'Perfil con experiencia en gestión de riesgos, normativa, auditoría interna, SARLAFT.',
    cvSkills: ['gestión de riesgos', 'normativa', 'auditoría interna', 'SARLAFT'],
  });
}

main().catch((e) => { console.error('ERROR FATAL:', e.message); process.exit(1); });
