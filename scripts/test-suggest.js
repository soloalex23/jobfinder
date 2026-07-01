const fs = require('fs');

async function main() {
  const profile = {
    cargoActual: 'Desarrollador Backend',
    industria: 'Tecnología - Software',
    industrias: ['Tecnología de la información', 'Desarrollo de software'],
    habilidades: ['Python', 'Django', 'Flask', 'JavaScript', 'React', 'PostgreSQL', 'AWS', 'Docker'],
    empresasPrevias: [{ nombre: 'EmpresaTech SAS' }, { nombre: 'StartupXYZ' }],
    experienciaTotalAnios: 5,
  };

  const res = await fetch('http://localhost:3000/api/companies/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  const data = await res.json();
  console.log('status:', res.status);
  fs.writeFileSync('scripts/suggest_result.json', JSON.stringify(data, null, 2), 'utf8');
  console.log('nacionales:', data.nacionales?.length, '| transnacionales:', data.transnacionales?.length);
  console.log('\nEjemplo nacionales (tipo/slug):');
  (data.nacionales || []).forEach((c) => {
    console.log(` - ${c.nombre} | tipo=${c.tipo} | ghSlug=${c.greenhouseSlug} | leverSlug=${c.leverSlug} | activo=${c.hasActivePortal}`);
  });
  console.log('\nEjemplo transnacionales (tipo/slug):');
  (data.transnacionales || []).forEach((c) => {
    console.log(` - ${c.nombre} | tipo=${c.tipo} | ghSlug=${c.greenhouseSlug} | leverSlug=${c.leverSlug} | activo=${c.hasActivePortal}`);
  });
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
