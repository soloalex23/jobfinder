const fs = require('fs');

async function main() {
  console.log('=== PASO 1: Subir cv_ejemplo.pdf a /api/cv/parse ===');
  const cvBuffer = fs.readFileSync('scripts/cv_ejemplo.pdf');
  const form = new FormData();
  form.append('cv', new Blob([cvBuffer], { type: 'application/pdf' }), 'cv_ejemplo.pdf');
  const cvRes = await fetch('http://localhost:3000/api/cv/parse', { method: 'POST', body: form });
  const cvData = await cvRes.json();
  console.log('status:', cvRes.status, '| nombre:', cvData.nombre, '| cargo:', cvData.cargoActual);

  console.log('\n=== PASO 2: /api/companies/suggest con el perfil extraído ===');
  const suggestRes = await fetch('http://localhost:3000/api/companies/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cargoActual: cvData.cargoActual,
      industria: cvData.industria,
      industrias: cvData.industrias,
      habilidades: cvData.habilidades,
      empresasPrevias: cvData.empresasPrevias,
      experienciaTotalAnios: cvData.experienciaTotalAnios,
    }),
  });
  const suggestData = await suggestRes.json();
  console.log('status:', suggestRes.status, '| nacionales:', suggestData.nacionales.length, '| transnacionales:', suggestData.transnacionales.length);

  const allCompanies = [...suggestData.nacionales, ...suggestData.transnacionales];
  console.log('\nEmpresas sugeridas y su ATS:');
  allCompanies.forEach((c) => console.log(` - ${c.nombre} | tipo=${c.tipo}`));

  // Seleccionar 3: al menos una Greenhouse/Lever si existe, más una portal_propio/linkedin
  const atsCompany = allCompanies.find((c) => c.tipo === 'greenhouse' || c.tipo === 'lever');
  const otherCompanies = allCompanies.filter((c) => c.nombre !== atsCompany?.nombre).slice(0, 2);
  const seleccionadas = [atsCompany, ...otherCompanies].filter(Boolean);

  console.log('\n=== PASO 3: Seleccionar 3 empresas y agregar "McKinsey" manualmente ===');
  console.log('Seleccionadas de la lista sugerida:', seleccionadas.map((c) => `${c.nombre} (${c.tipo})`));

  const empresasPayload = [...seleccionadas, 'McKinsey'];

  const portalsRes = await fetch('http://localhost:3000/api/companies/search-portals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      empresas: empresasPayload,
      query: 'backend developer python django',
      perfil: { cargoActual: cvData.cargoActual, industria: cvData.industria, habilidades: cvData.habilidades },
    }),
  });
  const portalsData = await portalsRes.json();
  console.log('\n=== PASO 4-5: Resultado de /api/companies/search-portals ===');
  console.log('status:', portalsRes.status);

  portalsData.resultados.forEach((r) => {
    console.log(`\n--- ${r.empresa} (${r.tipo}) ---`);
    console.log('hasVacantes:', r.hasVacantes, '| error:', r.error);
    console.log('careersUrl:', r.careersUrl);
    console.log('searchUrl:', r.searchUrl);
    if (r.vacantes.length) {
      r.vacantes.forEach((v) => console.log('  *', v.title, '|', v.location, '|', v.url));
    }
  });

  console.log('\n=== PASO 6: Resumen ===');
  const conVacantes = portalsData.resultados.filter((r) => r.hasVacantes);
  const soloLink = portalsData.resultados.filter((r) => !r.hasVacantes);
  console.log(`${conVacantes.length} empresas devolvieron vacantes vía Greenhouse/Lever/portal.`);
  console.log(`${soloLink.length} empresas quedaron solo con link de portal/LinkedIn (sin match o ATS no disponible).`);
}

main().catch((e) => { console.error('ERROR FATAL:', e.message, e.cause); process.exit(1); });
