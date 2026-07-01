// pdfjs-dist v4 solo se distribuye como ESM; se carga con import() dinámico
// para poder seguir usando CommonJS en el resto del proyecto.
let pdfjsLibPromise;
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLibPromise;
}

// content.items no trae saltos de línea; se reconstruyen agrupando los
// fragmentos por su coordenada Y (transform[5]) para que las heurísticas
// de parseo del CV puedan detectar secciones línea por línea.
function reconstructLines(items) {
  const Y_TOLERANCE = 2;
  const lines = [];
  let currentY = null;
  let currentLine = [];

  for (const item of items) {
    const y = item.transform[5];
    if (currentY === null || Math.abs(y - currentY) > Y_TOLERANCE) {
      if (currentLine.length) lines.push(currentLine.join(' '));
      currentLine = [item.str];
      currentY = y;
    } else {
      currentLine.push(item.str);
    }
  }
  if (currentLine.length) lines.push(currentLine.join(' '));
  return lines.join('\n');
}

async function extractTextFromPdf(buffer) {
  const pdfjsLib = await loadPdfjs();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  const pageTexts = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    pageTexts.push(reconstructLines(content.items));
  }

  await pdf.destroy();
  return pageTexts.join('\n').trim();
}

module.exports = { extractTextFromPdf };
