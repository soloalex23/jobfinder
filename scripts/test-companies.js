async function main() {
  const payload = {
    role: 'Desarrollador Backend',
    industry: 'Tecnología - Software',
    keywords: ['Python', 'Django'],
    skills: ['Python', 'Django', 'Flask', 'JavaScript', 'Node.js', 'React', 'SQL', 'PostgreSQL', 'Docker', 'AWS'],
    previousCompanies: ['EmpresaTech SAS', 'StartupXYZ'],
  };

  const start = Date.now();
  const res = await fetch('http://localhost:3000/api/companies/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log('status:', res.status, 'tiempo:', Date.now() - start, 'ms');
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
