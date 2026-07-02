const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = require('docx');
const { JSDOM } = require('jsdom');
const PDFDocument = require('pdfkit');

// Recorre el HTML generado por Claude y lo aplana a una lista de bloques
// simples ({ type, text }). docx y pdfkit consumen esta misma estructura,
// así solo hay un lugar que interpreta el HTML.
function extractStructuredContent(htmlContent) {
  const dom = new JSDOM(htmlContent);
  const doc = dom.window.document;
  const blocks = [];

  function processNode(node) {
    const tag = node.tagName ? node.tagName.toLowerCase() : '';

    if (tag === 'h1') {
      const text = node.textContent.trim();
      if (text) blocks.push({ type: 'h1', text });
    } else if (tag === 'h2') {
      const text = node.textContent.trim();
      if (text) blocks.push({ type: 'h2', text });
    } else if (tag === 'h3') {
      const text = node.textContent.trim();
      if (text) blocks.push({ type: 'h3', text });
    } else if (tag === 'p') {
      const text = node.textContent.trim();
      if (text) blocks.push({ type: 'p', text });
    } else if (tag === 'li') {
      const text = node.textContent.trim();
      if (text) blocks.push({ type: 'li', text });
    } else if (node.children && node.children.length > 0) {
      Array.from(node.children).forEach(processNode);
    }
  }

  const body = doc.querySelector('body');
  if (body) Array.from(body.children).forEach(processNode);

  return blocks;
}

// Generar DOCX a partir del HTML (vía la estructura extraída arriba).
async function generateDocx(htmlContent) {
  const blocks = extractStructuredContent(htmlContent);
  const children = [];

  blocks.forEach((block) => {
    if (block.type === 'h1') {
      children.push(new Paragraph({
        text: block.text,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }));
    } else if (block.type === 'h2') {
      children.push(new Paragraph({
        text: block.text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '4F46E5' } },
      }));
    } else if (block.type === 'h3') {
      children.push(new Paragraph({
        children: [new TextRun({ text: block.text, bold: true, size: 24 })],
        spacing: { before: 160, after: 80 },
      }));
    } else if (block.type === 'p') {
      children.push(new Paragraph({
        children: [new TextRun({ text: block.text, size: 22 })],
        spacing: { after: 80 },
      }));
    } else if (block.type === 'li') {
      children.push(new Paragraph({
        children: [new TextRun({ text: `• ${block.text}`, size: 22 })],
        spacing: { after: 60 },
        indent: { left: 360 },
      }));
    }
  });

  if (children.length === 0) {
    children.push(new Paragraph({ text: 'CV Content' }));
  }

  const document = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(document);
}

// Generar PDF a partir del HTML (vía la estructura extraída arriba). Se
// dibuja el layout directamente con pdfkit en vez de renderizar el HTML con
// un navegador — pdfkit es JS puro sin binarios nativos, así que no arrastra
// el riesgo de Chromium/Puppeteer roto en el contenedor de Railway.
function generatePdf(htmlContent) {
  const blocks = extractStructuredContent(htmlContent);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (blocks.length === 0) {
      doc.fontSize(12).text('CV Content');
    }

    blocks.forEach((block) => {
      if (block.type === 'h1') {
        doc.moveDown(0.6).fontSize(20).font('Helvetica-Bold').fillColor('#1E1B4B').text(block.text);
      } else if (block.type === 'h2') {
        doc.moveDown(0.8).fontSize(14).font('Helvetica-Bold').fillColor('#4F46E5').text(block.text);
        doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
          .strokeColor('#E5E7EB').stroke();
        doc.moveDown(0.3);
      } else if (block.type === 'h3') {
        doc.moveDown(0.4).fontSize(12).font('Helvetica-Bold').fillColor('#111827').text(block.text);
      } else if (block.type === 'p') {
        doc.moveDown(0.2).fontSize(10).font('Helvetica').fillColor('#374151').text(block.text, { align: 'left' });
      } else if (block.type === 'li') {
        doc.moveDown(0.1).fontSize(10).font('Helvetica').fillColor('#374151')
          .text(`•  ${block.text}`, { indent: 12 });
      }
    });

    doc.end();
  });
}

module.exports = { generateDocx, generatePdf };
