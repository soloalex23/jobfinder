const mammoth = require('mammoth');

async function extractTextFromDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return (value || '').trim();
}

module.exports = { extractTextFromDocx };
