const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = require('docx');

// El PDF ya no se genera en el servidor — se resuelve en el navegador
// (window.print() sobre el HTML del CV, que ya trae @media print) para
// garantizar fidelidad visual exacta sin depender de un motor de render
// server-side (Chromium/Puppeteer no es viable en Railway sin arriesgar el
// mismo tipo de crash por dependencias nativas que ya tuvimos antes en este
// proyecto con @napi-rs/canvas).
//
// El DOCX sí se genera acá, pero directamente desde "data" (el CV
// estructurado que ahora devuelve Claude junto al HTML) en vez de parsear
// HTML con jsdom — así se aplican estilos reales por campo (negritas,
// bullets, encabezados con línea de color) de forma confiable.

const ACCENT = '4F46E5';

function line(...parts) {
  return parts.filter(Boolean).join('  ·  ');
}

function sectionHeading(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT } },
  });
}

async function generateDocx(data) {
  const cv = data || {};
  const children = [];

  children.push(new Paragraph({
    children: [new TextRun({ text: cv.nombre || 'CV', bold: true, size: 40 })],
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 60 },
  }));

  if (cv.titulo) {
    children.push(new Paragraph({
      children: [new TextRun({ text: cv.titulo, size: 24, color: ACCENT })],
      spacing: { after: 100 },
    }));
  }

  const contacto = cv.contacto || {};
  const contactoLine = line(contacto.email, contacto.telefono, contacto.ciudad, contacto.linkedin);
  if (contactoLine) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactoLine, size: 18, color: '6B7280' })],
      spacing: { after: 200 },
    }));
  }

  if (cv.resumen) {
    children.push(sectionHeading('Perfil Profesional'));
    children.push(new Paragraph({
      children: [new TextRun({ text: cv.resumen, size: 22 })],
      spacing: { after: 100 },
    }));
  }

  if (Array.isArray(cv.experiencia) && cv.experiencia.length) {
    children.push(sectionHeading('Experiencia'));
    cv.experiencia.forEach((exp) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: exp.cargo || '', bold: true, size: 22 }),
          new TextRun({ text: exp.empresa ? `  —  ${exp.empresa}` : '', size: 22 }),
        ],
        spacing: { before: 160, after: 20 },
      }));
      const sub = line(exp.ubicacion, [exp.fechaInicio, exp.fechaFin].filter(Boolean).join(' – '));
      if (sub) {
        children.push(new Paragraph({
          children: [new TextRun({ text: sub, size: 20, color: '6B7280', italics: true })],
          spacing: { after: 60 },
        }));
      }
      (exp.logros || []).forEach((logro) => {
        children.push(new Paragraph({
          children: [new TextRun({ text: `•  ${logro}`, size: 21 })],
          spacing: { after: 40 },
          indent: { left: 300 },
        }));
      });
    });
  }

  if (Array.isArray(cv.educacion) && cv.educacion.length) {
    children.push(sectionHeading('Educación'));
    cv.educacion.forEach((ed) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: line(ed.titulo, ed.institucion, ed.año), size: 21 })],
        spacing: { after: 60 },
      }));
    });
  }

  if (Array.isArray(cv.skills) && cv.skills.length) {
    children.push(sectionHeading('Habilidades'));
    children.push(new Paragraph({
      children: [new TextRun({ text: cv.skills.join('   •   '), size: 21 })],
      spacing: { after: 100 },
    }));
  }

  if (children.length === 0) {
    children.push(new Paragraph({ text: 'CV Content' }));
  }

  const document = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(document);
}

module.exports = { generateDocx };
