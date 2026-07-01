async function main() {
  const empresas = [
    { nombre: 'Deel', tipo: 'greenhouse', greenhouseSlug: 'deel', careersUrl: 'https://jobs.lever.co/deel' },
    { nombre: 'Wizeline', tipo: 'greenhouse', greenhouseSlug: 'wizeline', careersUrl: 'https://wizeline.com/careers' },
    { nombre: 'Bancolombia', tipo: 'portal_propio', careersUrl: 'https://www.grupobancolombia.com/personas/nosotros/trabaja-con-nosotros' },
    'McKinsey',
  ];

  const res = await fetch('http://localhost:3000/api/companies/search-portals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empresas, query: 'developer engineer', perfil: {} }),
  });
  const data = await res.json();
  console.log('status:', res.status);
  data.resultados.forEach((r) => {
    console.log(`\n--- ${r.empresa} (${r.tipo}) ---`);
    console.log('hasVacantes:', r.hasVacantes, '| error:', r.error);
    console.log('careersUrl:', r.careersUrl, '| searchUrl:', r.searchUrl);
    r.vacantes.slice(0, 3).forEach((v) => console.log('  *', v.title, '|', v.location));
  });

  const conVacantes = data.resultados.filter((r) => r.hasVacantes).length;
  console.log(`\nResumen: ${conVacantes}/${data.resultados.length} empresas con vacantes reales encontradas.`);
}

main().catch((e) => console.error('ERROR', e.message));
