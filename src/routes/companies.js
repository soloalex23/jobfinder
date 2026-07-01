const express = require('express');
const { recommendCompanies, suggestCompanies, resolveCompanyAts } = require('../services/companyRecommender');
const { searchCompanyJobs } = require('../services/careerPortalScraper');

const router = express.Router();

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value) return [value];
  return [];
}

// POST /api/companies/recommend
// JSON body: { role, industry (string o array), keywords, skills, previousCompanies }
// Endpoint existente (sección "Empresas que podrían buscarte" en resultados).
// Independiente del endpoint de búsqueda de vacantes para no bloquearlo.
router.post('/recommend', async (req, res) => {
  try {
    const {
      role = null,
      keywords = [],
      skills = [],
      previousCompanies = [],
    } = req.body || {};

    const industry = toArray(req.body?.industry).join(', ') || null;

    const result = await recommendCompanies({ role, industry, keywords, skills, previousCompanies });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'No se pudieron generar recomendaciones de empresas.' });
  }
});

// POST /api/companies/suggest
// JSON body: { cargoActual, industria, industrias, habilidades, empresasPrevias, experienciaTotalAnios }
// Se llama justo después de parsear el CV, para la sección "Empresas objetivo".
router.post('/suggest', async (req, res) => {
  try {
    const {
      cargoActual = null,
      industria = null,
      industrias = [],
      habilidades = [],
      empresasPrevias = [],
      experienciaTotalAnios = null,
    } = req.body || {};

    const result = await suggestCompanies({
      cargoActual, industria, industrias, habilidades, empresasPrevias, experienciaTotalAnios,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'No se pudieron sugerir empresas.' });
  }
});

// POST /api/companies/search-portals
// JSON body: { empresas: [nombre|objeto], query, perfil }
// "empresas" acepta strings (agregadas manualmente por el usuario, se
// resuelve su ATS con Claude) u objetos ya resueltos (vienen de /suggest,
// el frontend ya conoce su tipo/slug y evita una llamada extra).
router.post('/search-portals', async (req, res) => {
  try {
    const { empresas = [] } = req.body || {};
    const query = (req.body?.query || '').trim();

    if (!Array.isArray(empresas) || !empresas.length) {
      return res.status(400).json({ error: 'Debes enviar al menos una empresa en "empresas".' });
    }

    const resolved = await Promise.all(empresas.map(async (item) => {
      if (item && typeof item === 'object' && item.tipo) return item;
      const nombre = typeof item === 'string' ? item : item?.nombre;
      if (!nombre) return null;
      try {
        return await resolveCompanyAts(nombre);
      } catch (err) {
        return {
          nombre, tipo: 'linkedin', careersUrl: null, greenhouseSlug: null, leverSlug: null, linkedin: null, error: err.message,
        };
      }
    }));

    const resultados = await Promise.all(
      resolved.filter(Boolean).map((empresa) => searchCompanyJobs(empresa, query)),
    );

    res.json({ resultados });
  } catch (err) {
    res.status(500).json({ error: err.message || 'No se pudo buscar en los portales de empresas.' });
  }
});

module.exports = router;
