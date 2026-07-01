const express = require('express');
const { searchAllSources } = require('../services/searchOrchestrator');
const { scoreJobs } = require('../services/scoring');
const { translateProfileToBoths } = require('../services/translator');
const { applyRelevanceFilters } = require('../utils/relevanceFilter');
const { dedupeSimilarJobs } = require('../utils/dedupe');
const { buildQuery, buildScraperQuery } = require('../utils/query');

const router = express.Router();

const COMPUTRABAJO_MAX_WORDS = 3;

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value) return [value];
  return [];
}

// POST /api/jobs/search
// Content-Type: application/json (el CV ya se parseó antes vía /api/cv/parse)
// body: { role, keywords, seniority[], experience, country, modality[],
//         contractType, industry[], minSalary, sources, cvText, cvSkills }
router.post('/search', async (req, res) => {
  try {
    const {
      role = null,
      keywords = [],
      experience = null,
      country = null,
      contractType = null,
      minSalary = null,
      sources = [],
      cvText = null,
      cvSkills = [],
    } = req.body || {};

    const seniority = toArray(req.body?.seniority);
    const modality = toArray(req.body?.modality);
    const industry = toArray(req.body?.industry);

    const hasAnyField = Boolean(
      (role && role.trim())
      || (Array.isArray(keywords) && keywords.length)
      || industry.length
      || country
      || seniority.length,
    );
    if (!hasAnyField) {
      return res.status(400).json({
        error: 'Completa al menos un campo para iniciar la búsqueda.',
      });
    }

    // Una sola llamada a Claude traduce rol + keywords + skills del CV +
    // industria a español Y a inglés, para que el idioma de la búsqueda,
    // del CV y de las vacantes sea indiferente.
    const t = await translateProfileToBoths({
      role, keywords, skills: cvSkills, industry: industry.join(', ') || null,
    });

    const queryEs = buildQuery({ role: t.role_es, keywords: t.keywords_es, industry: t.industry_es });
    const queryEn = buildQuery({ role: t.role_en, keywords: t.keywords_en, industry: t.industry_en });

    // Computrabajo/ElEmpleo no manejan bien queries largas de varias
    // keywords: cuando no hay rol, se usa un solo término representativo
    // (industria o la keyword más larga), truncado a máximo 3 palabras
    // (límite real de la URL de Computrabajo). Las demás keywords no se
    // pierden: siguen aplicando en el filtro de relevancia post-búsqueda.
    const colombiaQueryEs = buildScraperQuery(
      { role: t.role_es, keywords: t.keywords_es, industry: t.industry_es },
      COMPUTRABAJO_MAX_WORDS,
    );
    const colombiaQueryEn = buildScraperQuery(
      { role: t.role_en, keywords: t.keywords_en, industry: t.industry_en },
      COMPUTRABAJO_MAX_WORDS,
    );

    // Si el usuario seleccionó exactamente una modalidad, se usa para
    // filtrar en las fuentes que lo soportan (Remotive/Arbeitnow). Con
    // varias o ninguna seleccionada, ese filtro a nivel de fuente se omite
    // y el matching de modalidad queda a cargo del scoring.
    const modalityForSources = modality.length === 1 ? modality[0] : null;

    const { results, sourcesUsed, sourcesFailed } = await searchAllSources({
      queryEs,
      queryEn,
      colombiaQueryEs,
      colombiaQueryEn,
      modality: modalityForSources,
      contractType,
      minSalary,
      sources,
    });

    let jobs = applyRelevanceFilters(results, {
      roleEs: t.role_es, roleEn: t.role_en, keywordsEs: t.keywords_es, keywordsEn: t.keywords_en, country,
    });

    jobs = scoreJobs(jobs, {
      roleEs: t.role_es,
      roleEn: t.role_en,
      keywordsEs: t.keywords_es,
      keywordsEn: t.keywords_en,
      skillsEs: t.skills_es,
      skillsEn: t.skills_en,
      cvText,
      seniority,
      modality,
      country,
    });

    jobs = dedupeSimilarJobs(jobs).sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    const colombiaJobs = jobs.filter((job) => job.source !== 'Remoto Global');
    const remotoGlobalJobs = jobs.filter((job) => job.source === 'Remoto Global');

    res.json({
      queryEs,
      queryEn,
      colombiaQueryEs,
      colombiaQueryEn,
      sourcesUsed,
      sourcesFailed,
      colombia: { jobs: colombiaJobs, count: colombiaJobs.length },
      remotoGlobal: { jobs: remotoGlobalJobs, count: remotoGlobalJobs.length },
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error || err.message || 'Error interno del servidor.';
    res.status(status).json({ error: message });
  }
});

module.exports = router;
