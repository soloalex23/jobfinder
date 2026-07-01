const fs = require('fs');
const path = require('path');

// Genera un PDF válido con varias líneas de texto (CV ficticio de ejemplo).
function buildPdf(lines) {
  const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  let streamBody = 'BT\n/F1 11 Tf\n14 TL\n50 740 Td\n';
  lines.forEach((line, i) => {
    if (i > 0) streamBody += 'T*\n';
    streamBody += `(${escape(line)}) Tj\n`;
  });
  streamBody += 'ET';

  const objs = {};
  objs[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  objs[2] = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  objs[3] = '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n';
  objs[4] = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
  objs[5] = '5 0 obj\n<< /Length ' + Buffer.byteLength(streamBody, 'latin1') + ' >>\nstream\n' + streamBody + '\nendstream\nendobj\n';

  const header = '%PDF-1.4\n';
  let body = '';
  const offsets = [0];
  let pos = Buffer.byteLength(header, 'latin1');
  for (let i = 1; i <= 5; i++) {
    offsets[i] = pos;
    body += objs[i];
    pos += Buffer.byteLength(objs[i], 'latin1');
  }
  const xrefStart = pos;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer = 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefStart + '\n%%EOF';
  return header + body + xref + trailer;
}

const cvLines = [
  'Carlos Ramirez',
  'Desarrollador de Software',
  'Email: carlos.ramirez.dev@example.com | Tel: +57 300 000 0000',
  '',
  'Resumen',
  'Desarrollador de software con 3 anos de experiencia en construccion de',
  'aplicaciones web backend y frontend, APIs REST y bases de datos relacionales.',
  '',
  'Habilidades tecnicas',
  'Python, Django, Flask, JavaScript, Node.js, React, SQL, PostgreSQL, Git,',
  'Docker, AWS, REST APIs, Pruebas unitarias, Metodologias agiles (Scrum)',
  '',
  'Experiencia laboral',
  'Desarrollador Backend - EmpresaTech SAS (2023 - 2026)',
  'Diseno y mantenimiento de APIs REST en Python con Django y Flask,',
  'integracion con bases de datos PostgreSQL y despliegue en AWS.',
  '',
  'Desarrollador Junior - StartupXYZ (2021 - 2023)',
  'Desarrollo de funcionalidades frontend con JavaScript y React,',
  'consumo de APIs y trabajo en equipo bajo metodologia Scrum.',
  '',
  'Educacion',
  'Ingenieria de Sistemas, Universidad Nacional (2017 - 2021)',
];

const pdf = buildPdf(cvLines);
const outPath = path.join(__dirname, '..', 'scripts', 'cv_ejemplo.pdf');
fs.writeFileSync(outPath, pdf, 'latin1');
console.log('CV de ejemplo generado en', outPath);
