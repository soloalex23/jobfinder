const fs = require('fs');

async function main() {
  const cvBuffer = fs.readFileSync('scripts/cv_ejemplo_en.pdf');
  const form = new FormData();
  form.append('cv', new Blob([cvBuffer], { type: 'application/pdf' }), 'cv_ejemplo_en.pdf');

  const res = await fetch('http://localhost:3000/api/cv/parse', { method: 'POST', body: form });
  const data = await res.json();
  console.log('status:', res.status);
  fs.writeFileSync('scripts/cv_ejemplo_en_result.json', JSON.stringify(data, null, 2), 'utf8');
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
