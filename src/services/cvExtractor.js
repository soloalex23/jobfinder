const { extractTextFromPdf } = require('./pdfExtractor');
const { extractTextFromDocx } = require('./docxExtractor');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function extractCvText(buffer, mimetype, originalname = '') {
  const isDocx = mimetype === DOCX_MIME || /\.docx$/i.test(originalname);
  if (isDocx) return extractTextFromDocx(buffer);
  return extractTextFromPdf(buffer);
}

module.exports = { extractCvText };
