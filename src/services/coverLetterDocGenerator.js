const { Document, Packer, Paragraph, TextRun } = require('docx');

// Carta de presentación de negocios estándar y conservadora — a propósito
// SIN el branding indigo de JobFinder, ya que es un documento que el usuario
// envía a un tercero y debe verse como una carta profesional genérica.

const FONT = 'Calibri';
const SIZE = 22; // 11pt
const MARGIN = 1440; // 2.54cm (1 pulgada) en twips, márgenes estándar de carta

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text: text || '', font: FONT, size: SIZE, bold: Boolean(opts.bold) })],
    spacing: { after: opts.after ?? 200 },
  });
}

async function generateCoverLetterDocx(data) {
  const cl = data || {};
  const children = [];

  const remitente = cl.remitente || {};
  children.push(p(remitente.nombre, { bold: true, after: 40 }));
  if (remitente.contacto) children.push(p(remitente.contacto, { after: 240 }));

  if (cl.fecha) children.push(p(cl.fecha, { after: 240 }));

  const destinatario = cl.destinatario || {};
  if (destinatario.empresa) children.push(p(destinatario.empresa, { after: 20 }));
  if (destinatario.puesto) children.push(p(`Re: ${destinatario.puesto}`, { after: 240 }));

  if (cl.saludo) children.push(p(cl.saludo, { after: 200 }));

  (cl.parrafos || []).forEach((parrafo) => {
    children.push(p(parrafo, { after: 200 }));
  });

  if (cl.despedida) children.push(p(cl.despedida, { after: 400 }));
  if (cl.firma) children.push(p(cl.firma, { bold: true }));

  if (children.length === 0) {
    children.push(p('Cover Letter'));
  }

  const document = new Document({
    sections: [{
      properties: { page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      children,
    }],
  });

  return Packer.toBuffer(document);
}

module.exports = { generateCoverLetterDocx };
