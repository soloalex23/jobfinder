const express = require('express');
const { analyzeMatch, adjustCv, generateCoverLetterContent } = require('../services/jobMatchService');
const { generateDocx } = require('../services/cvDocGenerator');
const { generateCoverLetterDocx } = require('../services/coverLetterDocGenerator');

const router = express.Router();

// POST /api/match/analyze
// body: { cvText, cvData, jobDescription, language }
router.post('/analyze', async (req, res) => {
  try {
    const { cvText, cvData, jobDescription, language } = req.body || {};
    if (!cvText || !jobDescription) {
      return res.status(400).json({ error: 'Missing cvText or jobDescription' });
    }

    const report = await analyzeMatch(cvText, cvData, jobDescription, language || 'es');
    res.json({ success: true, ...report });
  } catch (err) {
    console.error('Match analyze error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/match/adjust-cv
// body: { cvData, jobDescription, matchReport, language }
router.post('/adjust-cv', async (req, res) => {
  try {
    const { cvData, jobDescription, matchReport, language } = req.body || {};
    if (!cvData || !jobDescription) {
      return res.status(400).json({ error: 'Missing cvData or jobDescription' });
    }

    const result = await adjustCv(cvData, jobDescription, matchReport || null, language || 'es');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Adjust CV error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/match/cover-letter
// body: { cvData, jobDescription, companyName, language }
router.post('/cover-letter', async (req, res) => {
  try {
    const { cvData, jobDescription, companyName, language } = req.body || {};
    if (!cvData || !jobDescription || !companyName) {
      return res.status(400).json({ error: 'Missing cvData, jobDescription or companyName' });
    }

    const result = await generateCoverLetterContent(cvData, jobDescription, companyName, language || 'es');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Cover letter error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/match/download-cv
// body: { data, fileName } — descarga el CV ajustado como DOCX
router.post('/download-cv', async (req, res) => {
  try {
    const { data, fileName = 'CV_Ajustado' } = req.body || {};
    if (!data) return res.status(400).json({ error: 'Missing data' });

    const buffer = await generateDocx(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Download adjusted CV error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/match/download-cover-letter
// body: { data, fileName } — descarga la cover letter como DOCX
router.post('/download-cover-letter', async (req, res) => {
  try {
    const { data, fileName = 'Cover_Letter' } = req.body || {};
    if (!data) return res.status(400).json({ error: 'Missing data' });

    const buffer = await generateCoverLetterDocx(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Download cover letter error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
