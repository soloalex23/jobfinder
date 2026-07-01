const express = require('express');
const upload = require('../middleware/upload');
const { extractCvText } = require('../services/cvExtractor');
const { parseCvWithAi } = require('../services/cvAiParser');

const router = express.Router();

// POST /api/cv/parse
// multipart/form-data: cv (archivo PDF/DOCX, requerido, máx. 5MB)
router.post('/parse', upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes subir un archivo PDF o DOCX en el campo "cv".' });
    }

    const cvText = await extractCvText(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!cvText || !cvText.trim()) {
      return res.status(422).json({ error: 'No se pudo extraer texto del archivo.' });
    }

    const parsed = await parseCvWithAi(cvText);

    res.json({ ...parsed, cvText });
  } catch (err) {
    res.status(500).json({ error: err.message || 'No se pudo leer el CV.' });
  }
});

module.exports = router;
