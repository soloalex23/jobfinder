const express = require('express');
const multer = require('multer');
const { extractCvText } = require('../services/cvExtractor');
const { analyzeATS, improveCV } = require('../services/atsResumeService');
const { generateDocx, generatePdf } = require('../services/cvDocGenerator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/resume/ats-analyze
// multipart/form-data: cv (archivo nuevo) — o
// application/json: { cvText, fileName } (CV ya parseado desde Job Search)
router.post('/ats-analyze', upload.single('cv'), async (req, res) => {
  try {
    let cvText = req.body.cvText || null;
    let fileName = req.body.fileName || 'curriculum.pdf';

    if (req.file) {
      fileName = req.file.originalname;
      cvText = await extractCvText(req.file.buffer, req.file.mimetype, req.file.originalname);
    }

    if (!cvText || !cvText.trim()) {
      return res.status(400).json({ error: 'No se recibió texto del CV.' });
    }

    const report = await analyzeATS(cvText);
    res.json({ success: true, report, cvText, fileName });
  } catch (err) {
    console.error('ATS analyze error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/resume/improve
router.post('/improve', async (req, res) => {
  try {
    const { cvText, atsReport, language, fileName } = req.body || {};
    if (!cvText || !atsReport) {
      return res.status(400).json({ error: 'Missing cvText or atsReport' });
    }

    const result = await improveCV(cvText, atsReport, language || 'es', fileName || 'CV');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Improve CV error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/resume/download
// Genera el CV mejorado (DOCX o PDF) directamente desde el CV estructurado
// que devolvió /improve, aplicando estilos reales por campo — no se parsea
// HTML, así el documento sí queda formateado.
router.post('/download', async (req, res) => {
  try {
    const { cvEstructurado, format, fileName = 'CV', styleVariant = 'v2' } = req.body || {};
    if (!cvEstructurado) {
      return res.status(400).json({ error: 'Missing cvEstructurado' });
    }

    if (format === 'docx') {
      const buffer = await generateDocx(cvEstructurado, styleVariant);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.docx"`);
      res.send(buffer);
    } else {
      const buffer = await generatePdf(cvEstructurado, styleVariant);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
      res.send(buffer);
    }
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
