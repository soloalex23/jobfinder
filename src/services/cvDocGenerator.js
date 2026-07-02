const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = require('docx');
const PDFDocument = require('pdfkit');

// Ambos formatos se generan directamente desde el CV estructurado que
// devuelve Claude (nombre, resumen, experiencia, educación, skills...) en
// vez de parsear el HTML: así se preservan los estilos reales (títulos,
// negritas, bullets) sin depender de un DOM walk genérico que los perdía.

const STYLES = {
  v1: { accent: '111827', label: 'Original' },
  v2: { accent: '4F46E5', label: 'JobFinder' },
};

function line(...parts) {
  return parts.filter(Boolean).join('  ·  ');
}

// ─── DOCX ───────────────────────────────────────────────────────────────────

async function generateDocx(cv, styleVariant = 'v2') {
  const accent = (STYLES[styleVariant] || STYLES.v2).accent;
  const children = [];

  children.push(new Paragraph({
    children: [new TextRun({ text: cv.nombre || 'CV', bold: true, size: 36 })],
    spacing: { after: 60 },
  }));

  if (cv.cargoActual) {
    children.push(new Paragraph({
      children: [new TextRun({ text: cv.cargoActual, size: 24, color: accent })],
      spacing: { after: 120 },
    }));
  }

  const contacto = cv.contacto || {};
  const contactoLine = line(contacto.email, contacto.telefono, contacto.linkedin, contacto.ubicacion);
  if (contactoLine) {
    children.push(new Paragraph({
      children: [new TextRun({ text: contactoLine, size: 18, color: '6B7280' })],
      spacing: { after: 200 },
    }));
  }

  function sectionHeading(text) {
    children.push(new Paragraph({
      text,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: accent } },
    }));
  }

  if (cv.resumen) {
    sectionHeading('Perfil Profesional');
    children.push(new Paragraph({
      children: [new TextRun({ text: cv.resumen, size: 22 })],
      spacing: { after: 100 },
    }));
  }

  if (Array.isArray(cv.experiencia) && cv.experiencia.length) {
    sectionHeading('Experiencia');
    cv.experiencia.forEach((exp) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: exp.cargo || '', bold: true, size: 22 })],
        spacing: { before: 140, after: 20 },
      }));
      const sub = line(exp.empresa, exp.fechas);
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
    sectionHeading('Educación');
    cv.educacion.forEach((ed) => {
      const text = line(ed.titulo, ed.institucion, ed.anio);
      children.push(new Paragraph({
        children: [new TextRun({ text, size: 21 })],
        spacing: { after: 60 },
      }));
    });
  }

  if (Array.isArray(cv.skills) && cv.skills.length) {
    sectionHeading('Habilidades');
    children.push(new Paragraph({
      children: [new TextRun({ text: cv.skills.join('   •   '), size: 21 })],
      spacing: { after: 100 },
    }));
  }

  if (Array.isArray(cv.certificaciones) && cv.certificaciones.length) {
    sectionHeading('Certificaciones');
    cv.certificaciones.forEach((c) => {
      children.push(new Paragraph({ children: [new TextRun({ text: `•  ${c}`, size: 21 })], spacing: { after: 40 } }));
    });
  }

  if (Array.isArray(cv.idiomas) && cv.idiomas.length) {
    sectionHeading('Idiomas');
    children.push(new Paragraph({
      children: [new TextRun({
        text: cv.idiomas.map((i) => line(i.idioma, i.nivel)).join('   •   '),
        size: 21,
      })],
      spacing: { after: 60 },
    }));
  }

  const document = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(document);
}

// ─── PDF ────────────────────────────────────────────────────────────────────
// pdfkit es JS puro (sin Chromium/binarios nativos) — evita el riesgo de que
// el generador de PDF rompa el proceso en Railway, como ya pasó antes con
// dependencias nativas (@napi-rs/canvas) en este mismo proyecto.

function generatePdf(cv, styleVariant = 'v2') {
  const accent = `#${(STYLES[styleVariant] || STYLES.v2).accent}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(22).font('Helvetica-Bold').fillColor('#111827').text(cv.nombre || 'CV');

    if (cv.cargoActual) {
      doc.moveDown(0.15).fontSize(13).font('Helvetica').fillColor(accent).text(cv.cargoActual);
    }

    const contacto = cv.contacto || {};
    const contactoLine = line(contacto.email, contacto.telefono, contacto.linkedin, contacto.ubicacion);
    if (contactoLine) {
      doc.moveDown(0.15).fontSize(9).font('Helvetica').fillColor('#6B7280').text(contactoLine);
    }

    function sectionHeading(text) {
      doc.moveDown(0.8).fontSize(13).font('Helvetica-Bold').fillColor(accent).text(text);
      doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
        .strokeColor('#E5E7EB').stroke();
      doc.moveDown(0.3);
    }

    if (cv.resumen) {
      sectionHeading('Perfil Profesional');
      doc.fontSize(10).font('Helvetica').fillColor('#374151').text(cv.resumen);
    }

    if (Array.isArray(cv.experiencia) && cv.experiencia.length) {
      sectionHeading('Experiencia');
      cv.experiencia.forEach((exp) => {
        doc.moveDown(0.3).fontSize(11).font('Helvetica-Bold').fillColor('#111827').text(exp.cargo || '');
        const sub = line(exp.empresa, exp.fechas);
        if (sub) doc.fontSize(9).font('Helvetica-Oblique').fillColor('#6B7280').text(sub);
        (exp.logros || []).forEach((logro) => {
          doc.moveDown(0.1).fontSize(10).font('Helvetica').fillColor('#374151').text(`•  ${logro}`, { indent: 10 });
        });
      });
    }

    if (Array.isArray(cv.educacion) && cv.educacion.length) {
      sectionHeading('Educación');
      cv.educacion.forEach((ed) => {
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(line(ed.titulo, ed.institucion, ed.anio));
      });
    }

    if (Array.isArray(cv.skills) && cv.skills.length) {
      sectionHeading('Habilidades');
      doc.fontSize(10).font('Helvetica').fillColor('#374151').text(cv.skills.join('   •   '));
    }

    if (Array.isArray(cv.certificaciones) && cv.certificaciones.length) {
      sectionHeading('Certificaciones');
      cv.certificaciones.forEach((c) => {
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(`•  ${c}`);
      });
    }

    if (Array.isArray(cv.idiomas) && cv.idiomas.length) {
      sectionHeading('Idiomas');
      doc.fontSize(10).font('Helvetica').fillColor('#374151')
        .text(cv.idiomas.map((i) => line(i.idioma, i.nivel)).join('   •   '));
    }

    doc.end();
  });
}

module.exports = { generateDocx, generatePdf };
