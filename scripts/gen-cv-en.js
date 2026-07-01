const fs = require('fs');
const path = require('path');

// Genera un PDF válido con varias líneas de texto (CV ficticio de ejemplo).
function buildPdf(lines) {
  const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  let streamBody = 'BT\n/F1 11 Tf\n13 TL\n50 750 Td\n';
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

// CV en ingles con headers no convencionales (a proposito, para probar
// que la extraccion con IA no depende de encabezados especificos como
// "Summary"/"Experience"/"Education", a diferencia del regex anterior.
const cvLines = [
  'Maria Fernanda Lopez Gutierrez',
  'maria.lopez@example.com | +34 600 123 456 | Madrid, Spain',
  '',
  'WHAT I BRING',
  'Bilingual marketing strategist with over 6 years driving growth for',
  'consumer brands across LATAM and Europe. Skilled in performance',
  'marketing, brand storytelling, and cross-functional leadership.',
  '',
  'MY JOURNEY',
  'Senior Marketing Manager, Nordic Beauty Co. (Mar 2022 - Present)',
  'Leading a team of 8 across paid media, content and CRM; grew revenue',
  '42% YoY by relaunching the loyalty program and doubling paid social ROAS.',
  '',
  'Marketing Lead, Sunrise Retail Group (Jan 2019 - Feb 2022)',
  'Owned go-to-market for 3 product lines, managed a $2M annual media',
  'budget, and built the first attribution model used company-wide.',
  '',
  'Marketing Coordinator, BrightPath Agency (Jun 2017 - Dec 2018)',
  'Supported 12 client accounts on social strategy and reporting;',
  'automated the monthly reporting workflow, saving 10 hours per week.',
  '',
  'TOOLS I USE',
  'Google Ads, Meta Ads Manager, HubSpot, Salesforce, Tableau, SQL (basic),',
  'Adobe Creative Suite, Excel, Asana',
  '',
  'WHERE I STUDIED',
  'MBA, IE Business School, Madrid (2018)',
  'BA in Communications, Universidad Complutense de Madrid (2015)',
  '',
  'BADGES & CERTS',
  'Google Ads Certified, HubSpot Inbound Marketing Certification, Meta Blueprint',
  '',
  'LANGUAGES I SPEAK',
  'Spanish (Native), English (Fluent / C1), Portuguese (Conversational)',
  '',
  'HIGHLIGHTS',
  "Named 'Marketer of the Year' 2023 by LATAM Retail Awards.",
  "Grew Nordic Beauty's Instagram following from 40K to 310K in 18 months.",
];

const pdf = buildPdf(cvLines);
const outPath = path.join(__dirname, '..', 'scripts', 'cv_ejemplo_en.pdf');
fs.writeFileSync(outPath, pdf, 'latin1');
console.log('CV en inglés generado en', outPath);
