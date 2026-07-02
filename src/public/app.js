// =============================================
// NAVEGACIÓN POR SECCIONES
// =============================================

function switchSection(sectionId) {
  // Ocultar todas las secciones
  document.querySelectorAll('.app-section').forEach((s) => s.classList.remove('active'));
  // Mostrar la sección seleccionada
  document.getElementById('section-' + sectionId).classList.add('active');

  // Actualizar estado activo en sidebar
  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.remove('active'));
  document.querySelector('[data-section="' + sectionId + '"]').classList.add('active');
}

// =============================================
// CV COMPARTIDO — ESTADO GLOBAL
// =============================================

function updateSidebarCvStatus(fileName, profile) {
  const empty = document.getElementById('cvStatusEmpty');
  const loaded = document.getElementById('cvStatusLoaded');
  const name = document.getElementById('cvStatusName');

  if (fileName && profile) {
    empty.style.display = 'none';
    loaded.style.display = 'flex';
    // Mostrar nombre del candidato si está disponible, si no el nombre del archivo
    name.textContent = (profile && profile.nombre) ? profile.nombre : fileName;
  } else {
    empty.style.display = 'flex';
    loaded.style.display = 'none';
  }
}

// Botón "Change CV" — reutiliza el reset de CV que ya existe en Job Search
// (removeCvBtn) para no duplicar esa lógica.
document.addEventListener('DOMContentLoaded', function () {
  const changeBtn = document.getElementById('cvChangeBtn');
  if (changeBtn) {
    changeBtn.addEventListener('click', function () {
      updateSidebarCvStatus(null, null);
      const removeCvBtn = document.getElementById('removeCvBtn');
      if (removeCvBtn) removeCvBtn.click();
    });
  }
});

(() => {
  'use strict';

  const CV_PARSE_ENDPOINT = '/api/cv/parse';
  const JOBS_ENDPOINT = '/api/jobs/search';
  const COMPANIES_ENDPOINT = '/api/companies/recommend';
  const COMPANIES_SUGGEST_ENDPOINT = '/api/companies/suggest';
  const COMPANIES_SEARCH_PORTALS_ENDPOINT = '/api/companies/search-portals';
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = /\.(pdf|docx)$/i;
  const MAX_SKILLS_VISIBLE = 12;
  const COP_PER_USD = 4200;

  const PORTAL_TYPE_LABELS = {
    greenhouse: 'Greenhouse',
    lever: 'Lever',
    portal_propio: 'Portal propio',
    linkedin: 'LinkedIn',
  };

  const LOADING_MESSAGES = [
    { title: 'Analizando tu CV...', subtitle: 'Extrayendo habilidades y experiencia' },
    { title: 'Buscando en Computrabajo, Indeed y ElEmpleo...', subtitle: 'Rastreando ofertas en Colombia' },
    { title: 'Consultando fuentes globales...', subtitle: 'Remotive, The Muse, Arbeitnow' },
    { title: 'Calculando compatibilidad...', subtitle: 'Comparando tu perfil con cada vacante' },
    { title: 'Ordenando resultados...', subtitle: 'Priorizando las mejores oportunidades' },
  ];

  const SOURCE_META = {
    computrabajo: { label: 'Computrabajo', color: '#CA8A04' },
    indeed: { label: 'Indeed Colombia', color: '#2563EB' },
    elempleo: { label: 'ElEmpleo', color: '#16A34A' },
    remotive: { label: 'Remotive', color: '#EA580C' },
    themuse: { label: 'The Muse', color: '#7C3AED' },
    arbeitnow: { label: 'Arbeitnow', color: '#374151' },
    adzuna: { label: 'Academia (Adzuna)', color: '#0D9488' },
  };

  // ---------- Estado ----------
  const state = {
    cvFile: null,
    cvParsed: null, // resultado de /api/cv/parse
    keywords: [],
    sources: new Set(['Computrabajo', 'Indeed Colombia', 'ElEmpleo', 'Remotive', 'The Muse', 'Arbeitnow', 'Academia (Adzuna)']),
    seniority: new Set(),
    modality: new Set(),
    industries: new Set(),
    salaryCurrency: 'COP',
    salaryPeriod: 'monthly',
    targetCompanies: {
      suggestions: { nacionales: [], transnacionales: [] },
      manual: [], // [{ nombre }] agregadas a mano, sin tipo de ATS resuelto aún
      selected: new Set(), // nombres de empresas seleccionadas
    },
  };

  // ---------- Referencias DOM ----------
  const screens = {
    form: document.getElementById('screen-form'),
    loading: document.getElementById('screen-loading'),
    results: document.getElementById('screen-results'),
    error: document.getElementById('screen-error'),
  };

  const resultCounter = document.getElementById('resultCounter');
  const resultCounterNumber = document.getElementById('resultCounterNumber');
  const newSearchBtn = document.getElementById('newSearchBtn');

  const dropzone = document.getElementById('dropzone');
  const cvInput = document.getElementById('cvInput');
  const dropzoneIdle = document.getElementById('dropzoneIdle');
  const cvLoading = document.getElementById('cvLoading');
  const cvWarning = document.getElementById('cvWarning');
  const dismissWarningBtn = document.getElementById('dismissWarningBtn');
  const cvSummary = document.getElementById('cvSummary');
  const cvSummaryName = document.getElementById('cvSummaryName');
  const cvSummaryRole = document.getElementById('cvSummaryRole');
  const cvSummaryExpBadge = document.getElementById('cvSummaryExpBadge');
  const cvResumenBlock = document.getElementById('cvResumenBlock');
  const cvResumenText = document.getElementById('cvResumenText');
  const cvExperienciaBlock = document.getElementById('cvExperienciaBlock');
  const cvExperienciaList = document.getElementById('cvExperienciaList');
  const cvExperienciaMoreBtn = document.getElementById('cvExperienciaMoreBtn');
  const cvSkillsBlock = document.getElementById('cvSkillsBlock');
  const cvSkillsChips = document.getElementById('cvSkillsChips');
  const cvSkillsMoreBtn = document.getElementById('cvSkillsMoreBtn');
  const cvFuncionesBlock = document.getElementById('cvFuncionesBlock');
  const cvFuncionesList = document.getElementById('cvFuncionesList');
  const cvEducacionBlock = document.getElementById('cvEducacionBlock');
  const cvEducacionList = document.getElementById('cvEducacionList');
  const cvCertificacionesBlock = document.getElementById('cvCertificacionesBlock');
  const cvCertificacionesChips = document.getElementById('cvCertificacionesChips');
  const cvLanguagesBlock = document.getElementById('cvLanguagesBlock');
  const cvLanguagesChips = document.getElementById('cvLanguagesChips');
  const cvLogrosBlock = document.getElementById('cvLogrosBlock');
  const cvLogrosList = document.getElementById('cvLogrosList');
  const removeCvBtn = document.getElementById('removeCvBtn');

  const showTargetCompaniesBtn = document.getElementById('showTargetCompaniesBtn');
  const targetCompaniesSection = document.getElementById('targetCompaniesSection');
  const tcSuggestSkeleton = document.getElementById('tcSuggestSkeleton');
  const tcSuggestedChips = document.getElementById('tcSuggestedChips');
  const tcNacionalesGroup = document.getElementById('tcNacionalesGroup');
  const tcGroupDivider = document.getElementById('tcGroupDivider');
  const tcTransnacionalesGroup = document.getElementById('tcTransnacionalesGroup');
  const tcAddInput = document.getElementById('tcAddInput');
  const tcAddBtn = document.getElementById('tcAddBtn');
  const tcSelectedChips = document.getElementById('tcSelectedChips');
  const tcCounter = document.getElementById('tcCounter');

  const targetCompaniesResultsHeader = document.getElementById('targetCompaniesResultsHeader');
  const targetCompaniesResultsCount = document.getElementById('targetCompaniesResultsCount');
  const targetCompaniesSkeleton = document.getElementById('targetCompaniesSkeleton');
  const targetCompaniesResultsGrid = document.getElementById('targetCompaniesResultsGrid');
  const companyPortalCardTemplate = document.getElementById('companyPortalCardTemplate');

  const searchForm = document.getElementById('searchForm');
  const roleInput = document.getElementById('roleInput');
  const keywordsInput = document.getElementById('keywordsInput');
  const chipsContainer = document.getElementById('chipsContainer');
  const seniorityChips = document.getElementById('seniorityChips');
  const experienceSelect = document.getElementById('experienceSelect');
  const countrySelect = document.getElementById('countrySelect');
  const modalityChips = document.getElementById('modalityChips');
  const contractSelect = document.getElementById('contractSelect');
  const industryMultiselect = document.getElementById('industryMultiselect');
  const industryTrigger = document.getElementById('industryTrigger');
  const industryTriggerText = document.getElementById('industryTriggerText');
  const industryPanel = document.getElementById('industryPanel');
  const industryClearBtn = document.getElementById('industryClearBtn');
  const industrySelectedChips = document.getElementById('industrySelectedChips');
  const salaryCurrencyToggle = document.getElementById('salaryCurrencyToggle');
  const salaryPeriodToggle = document.getElementById('salaryPeriodToggle');
  const salaryInput = document.getElementById('salaryInput');
  const sourcesChips = document.getElementById('sourcesChips');
  const linkedinBtn = document.getElementById('linkedinBtn');
  const formError = document.getElementById('formError');

  const loadingTitle = document.getElementById('loadingTitle');
  const loadingSubtitle = document.getElementById('loadingSubtitle');

  const paisSeleccionadoTitle = document.getElementById('paisSeleccionadoTitle');
  const colombiaGrid = document.getElementById('colombiaGrid');
  const colombiaCount = document.getElementById('colombiaCount');
  const colombiaEmpty = document.getElementById('colombiaEmpty');
  const remoteGrid = document.getElementById('remoteGrid');
  const remoteCount = document.getElementById('remoteCount');
  const remoteEmpty = document.getElementById('remoteEmpty');

  const rfScoreMin = document.getElementById('rfScoreMin');
  const rfScoreMax = document.getElementById('rfScoreMax');
  const rfScoreMinValue = document.getElementById('rfScoreMinValue');
  const rfScoreMaxValue = document.getElementById('rfScoreMaxValue');
  const rfLocation = document.getElementById('rfLocation');
  const rfCompany = document.getElementById('rfCompany');
  const rfRole = document.getElementById('rfRole');
  const rfClearBtn = document.getElementById('rfClearBtn');
  const rfSummary = document.getElementById('rfSummary');

  const companiesSkeleton = document.getElementById('companiesSkeleton');
  const companiesNacionales = document.getElementById('companiesNacionales');
  const companiesTransnacionales = document.getElementById('companiesTransnacionales');
  const companyTabs = document.querySelectorAll('.company-tab');

  const retryBtn = document.getElementById('retryBtn');
  const jobCardTemplate = document.getElementById('jobCardTemplate');
  const companyCardTemplate = document.getElementById('companyCardTemplate');

  let loadingInterval = null;

  // ---------- Navegación entre pantallas ----------
  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.hidden = key !== name;
    });
    resultCounter.hidden = name !== 'results';
    newSearchBtn.hidden = name !== 'results';
  }

  // ---------- Subida y parseo de CV ----------
  function updateLinkedinHref() {
    const query = roleInput.value.trim() || state.keywords.join(' ') || 'empleo';
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=Colombia`;
    linkedinBtn.href = url;
  }

  function resetCvUi() {
    dropzoneIdle.hidden = false;
    cvLoading.hidden = true;
    cvWarning.hidden = true;
    cvSummary.hidden = true;
  }

  function renderStaticChips(container, items, extraClass) {
    container.innerHTML = '';
    items.forEach((item) => {
      const span = document.createElement('span');
      span.className = `static-chip${extraClass ? ` ${extraClass}` : ''}`;
      span.textContent = item;
      container.appendChild(span);
    });
  }

  function renderBulletList(container, items) {
    container.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      container.appendChild(li);
    });
  }

  function setBlockVisible(block, visible) {
    block.hidden = !visible;
  }

  const MAX_EXPERIENCE_VISIBLE = 4;

  function renderExperienceItems(container, items) {
    container.innerHTML = '';
    items.forEach((job) => {
      const div = document.createElement('div');
      div.className = 'cv-exp-item';

      const company = document.createElement('p');
      company.className = 'cv-exp-company';
      company.textContent = job.nombre || 'Empresa no especificada';
      div.appendChild(company);

      if (job.cargo || job.periodo) {
        const roleLine = document.createElement('p');
        roleLine.className = 'cv-exp-role';
        roleLine.textContent = [job.cargo, job.periodo].filter(Boolean).join(' · ');
        div.appendChild(roleLine);
      }

      if (job.descripcion) {
        const desc = document.createElement('p');
        desc.className = 'cv-exp-desc';
        desc.textContent = job.descripcion;
        div.appendChild(desc);
      }

      container.appendChild(div);
    });
  }

  function renderCvSummary(parsed) {
    cvSummaryName.textContent = parsed.nombre || 'Perfil detectado';
    cvSummaryRole.textContent = parsed.cargoActual || 'Cargo no detectado';

    if (parsed.experienciaTotalAnios) {
      cvSummaryExpBadge.hidden = false;
      cvSummaryExpBadge.textContent = `${parsed.experienciaTotalAnios} años de experiencia`;
    } else {
      cvSummaryExpBadge.hidden = true;
    }

    setBlockVisible(cvResumenBlock, Boolean(parsed.resumenPerfil));
    if (parsed.resumenPerfil) cvResumenText.textContent = parsed.resumenPerfil;

    const experience = parsed.empresasPrevias || [];
    setBlockVisible(cvExperienciaBlock, experience.length > 0);
    if (experience.length) {
      renderExperienceItems(cvExperienciaList, experience.slice(0, MAX_EXPERIENCE_VISIBLE));
      if (experience.length > MAX_EXPERIENCE_VISIBLE) {
        cvExperienciaMoreBtn.hidden = false;
        cvExperienciaMoreBtn.textContent = 'Ver más';
        cvExperienciaMoreBtn.onclick = () => {
          const expanded = cvExperienciaMoreBtn.textContent === 'Ver menos';
          renderExperienceItems(cvExperienciaList, expanded ? experience.slice(0, MAX_EXPERIENCE_VISIBLE) : experience);
          cvExperienciaMoreBtn.textContent = expanded ? 'Ver más' : 'Ver menos';
        };
      } else {
        cvExperienciaMoreBtn.hidden = true;
      }
    }

    const skills = parsed.habilidades || [];
    setBlockVisible(cvSkillsBlock, skills.length > 0);
    if (skills.length) {
      renderStaticChips(cvSkillsChips, skills.slice(0, MAX_SKILLS_VISIBLE), 'blue');
      if (skills.length > MAX_SKILLS_VISIBLE) {
        cvSkillsMoreBtn.hidden = false;
        cvSkillsMoreBtn.textContent = 'Ver más';
        cvSkillsMoreBtn.onclick = () => {
          const expanded = cvSkillsMoreBtn.textContent === 'Ver menos';
          renderStaticChips(cvSkillsChips, expanded ? skills.slice(0, MAX_SKILLS_VISIBLE) : skills, 'blue');
          cvSkillsMoreBtn.textContent = expanded ? 'Ver más' : 'Ver menos';
        };
      } else {
        cvSkillsMoreBtn.hidden = true;
      }
    }

    const funciones = parsed.funcionesPrincipales || [];
    setBlockVisible(cvFuncionesBlock, funciones.length > 0);
    if (funciones.length) renderBulletList(cvFuncionesList, funciones);

    const education = parsed.educacion || [];
    setBlockVisible(cvEducacionBlock, education.length > 0);
    if (education.length) {
      renderBulletList(cvEducacionList, education.map((e) => {
        const inst = e.institucion ? ` @ ${e.institucion}` : '';
        const year = e.anio ? ` (${e.anio})` : '';
        return `${e.titulo || 'Estudios'}${inst}${year}`;
      }));
    }

    const certifications = parsed.certificaciones || [];
    setBlockVisible(cvCertificacionesBlock, certifications.length > 0);
    if (certifications.length) renderStaticChips(cvCertificacionesChips, certifications, 'gray');

    const languages = parsed.idiomas || [];
    setBlockVisible(cvLanguagesBlock, languages.length > 0);
    if (languages.length) {
      renderStaticChips(
        cvLanguagesChips,
        languages.map((l) => (l.nivel ? `${l.idioma} – ${l.nivel}` : l.idioma)),
        'gray',
      );
    }

    const logros = parsed.logros || [];
    setBlockVisible(cvLogrosBlock, logros.length > 0);
    if (logros.length) renderBulletList(cvLogrosList, logros);

    dropzoneIdle.hidden = true;
    cvLoading.hidden = true;
    cvWarning.hidden = true;
    cvSummary.hidden = false;
  }

  async function parseCv(file) {
    resetCvUi();
    dropzoneIdle.hidden = true;
    cvLoading.hidden = false;

    const formData = new FormData();
    formData.append('cv', file);

    try {
      const response = await fetch(CV_PARSE_ENDPOINT, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('parse failed');
      const parsed = await response.json();
      state.cvParsed = parsed;
      updateSidebarCvStatus(file.name, parsed);
      window.globalCvText = parsed.cvText;
      window.globalCvData = parsed;
      window.globalCvFileName = file.name;
      window.rhSetCvFromJobSearch && window.rhSetCvFromJobSearch(parsed.cvText, file.name);
      window.jmSetCvFromJobSearch && window.jmSetCvFromJobSearch(parsed.cvText, parsed, file.name);
      renderCvSummary(parsed);
      revealTargetCompaniesSection(parsed);
    } catch {
      state.cvParsed = null;
      dropzoneIdle.hidden = true;
      cvLoading.hidden = true;
      cvWarning.hidden = false;
    }
  }

  // ---------- Empresas objetivo (sugerencias + selección) ----------
  function revealTargetCompaniesSection(profile) {
    targetCompaniesSection.hidden = false;
    showTargetCompaniesBtn.hidden = true;
    loadSuggestedCompanies(profile);
  }

  showTargetCompaniesBtn.addEventListener('click', () => revealTargetCompaniesSection(null));

  async function loadSuggestedCompanies(profile) {
    tcSuggestSkeleton.hidden = false;
    tcSuggestedChips.hidden = true;

    const body = profile || {
      cargoActual: null, industria: null, industrias: [], habilidades: [], empresasPrevias: [], experienciaTotalAnios: null,
    };

    try {
      const response = await fetch(COMPANIES_SUGGEST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('suggest failed');
      const data = await response.json();
      state.targetCompanies.suggestions = data;
      renderSuggestedChips();
    } catch {
      // Falla en silencio: el usuario igual puede agregar empresas a mano.
    } finally {
      tcSuggestSkeleton.hidden = true;
    }
  }

  function findCompanyByName(name) {
    const { nacionales = [], transnacionales = [] } = state.targetCompanies.suggestions || {};
    return nacionales.find((c) => c.nombre === name)
      || transnacionales.find((c) => c.nombre === name)
      || state.targetCompanies.manual.find((c) => c.nombre === name)
      || null;
  }

  function companySourceLabel(name) {
    const { nacionales = [], transnacionales = [] } = state.targetCompanies.suggestions || {};
    if (nacionales.some((c) => c.nombre === name)) return { kind: 'nacional', badge: '🇨🇴 Nacional' };
    if (transnacionales.some((c) => c.nombre === name)) return { kind: 'transnacional', badge: '🌍 Internacional' };
    return { kind: 'manual', badge: '✏️ Agregada por ti' };
  }

  function buildSuggestedChip(company, emoji) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tc-suggest-chip';
    btn.textContent = `${emoji} ${company.nombre}`;
    if (state.targetCompanies.selected.has(company.nombre)) btn.classList.add('active');
    btn.addEventListener('click', () => toggleCompanySelection(company.nombre));
    return btn;
  }

  function renderSuggestedChips() {
    const { nacionales = [], transnacionales = [] } = state.targetCompanies.suggestions || {};
    tcNacionalesGroup.innerHTML = '';
    tcTransnacionalesGroup.innerHTML = '';

    nacionales.forEach((c) => tcNacionalesGroup.appendChild(buildSuggestedChip(c, '🇨🇴')));
    transnacionales.forEach((c) => tcTransnacionalesGroup.appendChild(buildSuggestedChip(c, '🌍')));

    tcGroupDivider.hidden = !(nacionales.length && transnacionales.length);
    tcSuggestedChips.hidden = false;
  }

  function toggleCompanySelection(name) {
    if (state.targetCompanies.selected.has(name)) state.targetCompanies.selected.delete(name);
    else state.targetCompanies.selected.add(name);
    renderSuggestedChips();
    renderSelectedChips();
  }

  function renderSelectedChips() {
    tcSelectedChips.innerHTML = '';
    state.targetCompanies.selected.forEach((name) => {
      const { kind, badge } = companySourceLabel(name);
      const chip = document.createElement('span');
      chip.className = `chip tc-selected-chip${kind === 'manual' ? ' tc-manual' : ''}`;
      chip.innerHTML = '<span></span><span class="tc-chip-badge"></span><button type="button" class="chip-remove">✕</button>';
      chip.querySelector('span').textContent = name;
      chip.querySelector('.tc-chip-badge').textContent = badge;
      const removeBtn = chip.querySelector('.chip-remove');
      removeBtn.setAttribute('aria-label', `Quitar ${name}`);
      removeBtn.addEventListener('click', () => {
        state.targetCompanies.selected.delete(name);
        renderSuggestedChips();
        renderSelectedChips();
      });
      tcSelectedChips.appendChild(chip);
    });

    const n = state.targetCompanies.selected.size;
    tcCounter.textContent = `${n} empresa${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}`;
  }

  tcAddBtn.addEventListener('click', () => {
    const name = tcAddInput.value.trim();
    if (!name) return;
    if (!findCompanyByName(name)) {
      state.targetCompanies.manual.push({ nombre: name });
    }
    state.targetCompanies.selected.add(name);
    tcAddInput.value = '';
    renderSelectedChips();
  });

  tcAddInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tcAddBtn.click();
    }
  });

  function setCvFile(file) {
    if (!file) {
      state.cvFile = null;
      state.cvParsed = null;
      cvInput.value = '';
      resetCvUi();
      updateSidebarCvStatus(null, null);
      window.globalCvText = null;
      window.globalCvData = null;
      window.globalCvFileName = null;
      return;
    }

    if (!ALLOWED_EXTENSIONS.test(file.name)) {
      window.alert('Solo se aceptan archivos PDF o DOCX.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      window.alert('El archivo supera el límite de 5MB.');
      return;
    }

    state.cvFile = file;
    parseCv(file);
  }

  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#removeCvBtn') || e.target.closest('#dismissWarningBtn')) return;
    cvInput.click();
  });

  cvInput.addEventListener('change', () => setCvFile(cvInput.files[0]));

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files?.[0];
    if (file) setCvFile(file);
  });

  removeCvBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setCvFile(null);
  });
  dismissWarningBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cvWarning.hidden = true;
    dropzoneIdle.hidden = false;
  });

  // ---------- Chips de keywords ----------
  function renderChips() {
    chipsContainer.querySelectorAll('.chip').forEach((chip) => chip.remove());
    state.keywords.forEach((word, index) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `<span></span><button type="button" class="chip-remove" aria-label="Quitar ${word}">✕</button>`;
      chip.querySelector('span').textContent = word;
      chip.querySelector('.chip-remove').addEventListener('click', () => {
        state.keywords.splice(index, 1);
        renderChips();
        updateLinkedinHref();
      });
      chipsContainer.insertBefore(chip, keywordsInput);
    });
  }

  keywordsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = keywordsInput.value.trim();
      if (value && !state.keywords.includes(value)) {
        state.keywords.push(value);
        renderChips();
        updateLinkedinHref();
      }
      keywordsInput.value = '';
    } else if (e.key === 'Backspace' && !keywordsInput.value && state.keywords.length) {
      state.keywords.pop();
      renderChips();
      updateLinkedinHref();
    }
  });

  roleInput.addEventListener('input', updateLinkedinHref);

  // ---------- Salario ----------
  const SALARY_PLACEHOLDERS = {
    COP: { monthly: 'ej. 8.000.000', annual: 'ej. 96.000.000' },
    USD: { monthly: 'ej. 2.000', annual: 'ej. 24.000' },
  };

  function updateSalaryPlaceholder() {
    salaryInput.placeholder = SALARY_PLACEHOLDERS[state.salaryCurrency][state.salaryPeriod];
  }

  function wireSalaryToggle(container, stateKey) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.salary-toggle-btn');
      if (!btn) return;
      container.querySelectorAll('.salary-toggle-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state[stateKey] = btn.dataset.value;
      updateSalaryPlaceholder();
    });
  }

  wireSalaryToggle(salaryCurrencyToggle, 'salaryCurrency');
  wireSalaryToggle(salaryPeriodToggle, 'salaryPeriod');
  updateSalaryPlaceholder();

  salaryInput.addEventListener('input', () => {
    const digits = salaryInput.value.replace(/\D/g, '');
    salaryInput.value = digits ? Number(digits).toLocaleString('es-CO') : '';
  });

  function getSalaryRawValue() {
    const digits = salaryInput.value.replace(/\D/g, '');
    return digits ? Number(digits) : null;
  }

  // Normaliza siempre a USD mensual para poder comparar contra el salario
  // de las vacantes en el backend, sin importar qué moneda/periodicidad
  // haya elegido el usuario.
  function normalizeSalaryToMonthlyUsd(value, currency, period) {
    if (value == null) return null;
    let v = value;
    if (currency === 'COP') v /= COP_PER_USD;
    if (period === 'annual') v /= 12;
    return v;
  }

  // ---------- Fuentes de búsqueda ----------
  sourcesChips.addEventListener('click', (e) => {
    const btn = e.target.closest('.source-chip');
    if (!btn) return;
    const source = btn.dataset.source;
    if (state.sources.has(source)) {
      state.sources.delete(source);
      btn.classList.remove('active');
    } else {
      state.sources.add(source);
      btn.classList.add('active');
    }
  });

  // ---------- Toggle chips genéricos (seniority, modalidad) ----------
  function wireToggleChips(container, stateSet) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.toggle-chip');
      if (!btn) return;
      const value = btn.dataset.value;
      if (stateSet.has(value)) {
        stateSet.delete(value);
        btn.classList.remove('active');
      } else {
        stateSet.add(value);
        btn.classList.add('active');
      }
    });
  }

  wireToggleChips(seniorityChips, state.seniority);
  wireToggleChips(modalityChips, state.modality);

  // ---------- Multiselect de industria ----------
  const industryCheckboxes = Array.from(industryPanel.querySelectorAll('input[type="checkbox"]'));

  function renderIndustryChips() {
    industrySelectedChips.innerHTML = '';
    state.industries.forEach((value) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `<span></span><button type="button" class="chip-remove" aria-label="Quitar ${value}">✕</button>`;
      chip.querySelector('span').textContent = value;
      chip.querySelector('.chip-remove').addEventListener('click', () => {
        state.industries.delete(value);
        const cb = industryCheckboxes.find((c) => c.value === value);
        if (cb) cb.checked = false;
        renderIndustryChips();
      });
      industrySelectedChips.appendChild(chip);
    });

    industryTriggerText.textContent = state.industries.size
      ? `${state.industries.size} industria${state.industries.size === 1 ? '' : 's'} seleccionada${state.industries.size === 1 ? '' : 's'}`
      : 'Cualquier industria';
  }

  industryTrigger.addEventListener('click', () => {
    industryPanel.hidden = !industryPanel.hidden;
  });

  document.addEventListener('click', (e) => {
    if (!industryMultiselect.contains(e.target)) industryPanel.hidden = true;
  });

  industryCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.industries.add(cb.value);
      else state.industries.delete(cb.value);
      renderIndustryChips();
    });
  });

  industryClearBtn.addEventListener('click', () => {
    state.industries.clear();
    industryCheckboxes.forEach((cb) => { cb.checked = false; });
    renderIndustryChips();
  });

  // ---------- Validación + payloads ----------
  function hasAnyField() {
    return Boolean(
      roleInput.value.trim()
      || state.keywords.length
      || state.industries.size
      || countrySelect.value
      || state.seniority.size,
    );
  }

  function buildJobsPayload() {
    const salaryRaw = getSalaryRawValue();
    return {
      role: roleInput.value.trim() || null,
      keywords: state.keywords,
      seniority: Array.from(state.seniority),
      experience: experienceSelect.value || null,
      country: countrySelect.value || null,
      modality: Array.from(state.modality),
      contractType: contractSelect.value || null,
      industry: Array.from(state.industries),
      minSalary: normalizeSalaryToMonthlyUsd(salaryRaw, state.salaryCurrency, state.salaryPeriod),
      salaryOriginal: salaryRaw,
      salaryCurrency: state.salaryCurrency,
      salaryPeriod: state.salaryPeriod,
      sources: Array.from(state.sources),
      cvText: state.cvParsed?.cvText || null,
      cvSkills: state.cvParsed?.habilidades || [],
    };
  }

  function buildCompaniesPayload() {
    return {
      role: roleInput.value.trim() || null,
      industry: Array.from(state.industries),
      keywords: state.keywords,
      skills: state.cvParsed?.habilidades || [],
      previousCompanies: (state.cvParsed?.empresasPrevias || []).map((e) => e.nombre).filter(Boolean),
    };
  }

  // ---------- Loading rotativo ----------
  function startLoadingMessages() {
    let i = 0;
    loadingTitle.textContent = LOADING_MESSAGES[0].title;
    loadingSubtitle.textContent = LOADING_MESSAGES[0].subtitle;
    loadingInterval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      loadingTitle.textContent = LOADING_MESSAGES[i].title;
      loadingSubtitle.textContent = LOADING_MESSAGES[i].subtitle;
    }, 1400);
  }

  function stopLoadingMessages() {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }

  // ---------- Utilidades de render ----------
  function hashColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 45%)`;
  }

  function initials(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/).filter(Boolean);
    const letters = words.slice(0, 2).map((w) => w[0]).join('');
    return letters.toUpperCase() || '?';
  }

  function scoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-mid';
    return 'score-low';
  }

  // job.salaryMin/salaryMax llegan en USD anual (única fuente que expone
  // salario hoy es Remotive, cuyos rangos son anuales en USD). Se convierten
  // aquí a la moneda/periodicidad que el usuario eligió en el formulario.
  function formatSalary(min, max) {
    if (min == null && max == null) return null;
    const { salaryCurrency: currency, salaryPeriod: period } = state;
    const periodSuffix = period === 'annual' ? '/año' : '/mes';

    const convert = (usdAnnual) => {
      let v = period === 'annual' ? usdAnnual : usdAnnual / 12;
      if (currency === 'COP') v *= COP_PER_USD;
      return v;
    };

    const fmt = (n) => {
      const rounded = Math.round(convert(n));
      if (currency === 'COP') return `$${rounded.toLocaleString('es-CO')} COP`;
      return `$${rounded.toLocaleString('en-US')}`;
    };

    let text;
    if (min != null && max != null && min !== max) text = `${fmt(min)} - ${fmt(max)}`;
    else if (min != null) text = `${fmt(min)}+`;
    else text = fmt(max);
    return `${text} ${periodSuffix}`;
  }

  function buildPill(text, extraClass, bgColor) {
    const span = document.createElement('span');
    span.className = `pill${extraClass ? ` ${extraClass}` : ''}`;
    span.textContent = text;
    if (bgColor) span.style.background = bgColor;
    return span;
  }

  // ---------- Render de vacantes ----------
  function renderJobCard(job) {
    const node = jobCardTemplate.content.firstElementChild.cloneNode(true);

    const avatar = node.querySelector('.company-avatar');
    avatar.textContent = initials(job.company);
    avatar.style.background = hashColor(job.company || job.title || 'JobFinder');

    const badge = node.querySelector('.score-badge');
    badge.textContent = `${job.compatibilityScore}% match`;
    badge.classList.add(scoreClass(job.compatibilityScore));

    node.querySelector('.job-title').textContent = job.title || 'Sin título';
    node.querySelector('.job-company').textContent = job.company || 'Empresa no especificada';

    const barFill = node.querySelector('.score-bar-fill');
    barFill.style.width = `${Math.max(0, Math.min(100, job.compatibilityScore))}%`;
    barFill.classList.add(scoreClass(job.compatibilityScore));

    const pillsContainer = node.querySelector('.job-pills');
    if (job.location) pillsContainer.appendChild(buildPill(job.location));
    const salaryText = formatSalary(job.salaryMin, job.salaryMax);
    if (salaryText) pillsContainer.appendChild(buildPill(salaryText));
    const meta = SOURCE_META[job.sourceKey] || { label: job.source, color: '#6B7280' };
    pillsContainer.appendChild(buildPill(meta.label, 'pill-source', meta.color));

    const descriptionEl = node.querySelector('.job-description');
    descriptionEl.textContent = job.description || 'Sin descripción disponible.';

    const offerBtn = node.querySelector('.btn-offer');
    if (job.url) {
      offerBtn.href = job.url;
    } else {
      offerBtn.removeAttribute('href');
      offerBtn.style.opacity = '0.5';
      offerBtn.style.pointerEvents = 'none';
    }

    const descBtn = node.querySelector('.btn-description');
    descBtn.addEventListener('click', () => {
      const isHidden = descriptionEl.hidden;
      descriptionEl.hidden = !isHidden;
      descBtn.textContent = isHidden ? 'Ocultar' : 'Descripción';
    });

    return node;
  }

  function renderJobSection(jobs, grid, countEl, emptyEl, countLabel) {
    grid.innerHTML = '';
    countEl.textContent = countLabel(jobs.length);
    emptyEl.hidden = jobs.length > 0;
    jobs.forEach((job) => grid.appendChild(renderJobCard(job)));
  }

  // ---------- Filtros de resultados (client-side, sin nueva llamada al backend) ----------
  // Guarda el array completo que trajo el backend; los filtros se aplican
  // sobre esta copia y nunca la mutan, así "Limpiar filtros" siempre puede
  // volver al set completo.
  let allColombiaJobs = [];
  let allRemoteJobs = [];
  let currentPaisSeleccionado = null;

  window.currentFilters = { scoreMin: 0, scoreMax: 100, location: '', company: '', role: '' };

  function normalizeFilterText(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function jobMatchesFilters(job, f) {
    if (job.compatibilityScore < f.scoreMin || job.compatibilityScore > f.scoreMax) return false;
    if (f.location && !normalizeFilterText(job.location).includes(normalizeFilterText(f.location))) return false;
    if (f.company && !normalizeFilterText(job.company).includes(normalizeFilterText(f.company))) return false;
    if (f.role && !normalizeFilterText(job.title).includes(normalizeFilterText(f.role))) return false;
    return true;
  }

  function applyResultFilters() {
    const f = window.currentFilters;
    const filteredColombia = allColombiaJobs.filter((job) => jobMatchesFilters(job, f));
    const filteredRemote = allRemoteJobs.filter((job) => jobMatchesFilters(job, f));

    renderJobSection(filteredColombia, colombiaGrid, colombiaCount, colombiaEmpty,
      (n) => `${n} vacante${n === 1 ? '' : 's'} encontrada${n === 1 ? '' : 's'}${currentPaisSeleccionado ? ` en ${currentPaisSeleccionado}` : ' en Colombia'}`);
    renderJobSection(filteredRemote, remoteGrid, remoteCount, remoteEmpty,
      (n) => `${n} posicion${n === 1 ? '' : 'es'} remota${n === 1 ? '' : 's'}`);

    const totalShown = filteredColombia.length + filteredRemote.length;
    const totalAll = allColombiaJobs.length + allRemoteJobs.length;
    rfSummary.textContent = `Mostrando ${totalShown} de ${totalAll} vacante${totalAll === 1 ? '' : 's'}`;
    resultCounterNumber.textContent = totalShown;
  }

  function resetResultFilters() {
    window.currentFilters = { scoreMin: 0, scoreMax: 100, location: '', company: '', role: '' };
    rfScoreMin.value = 0;
    rfScoreMax.value = 100;
    rfScoreMinValue.textContent = '0%';
    rfScoreMaxValue.textContent = '100%';
    rfLocation.value = '';
    rfCompany.value = '';
    rfRole.value = '';
  }

  rfScoreMin.addEventListener('input', () => {
    window.currentFilters.scoreMin = Number(rfScoreMin.value);
    rfScoreMinValue.textContent = `${rfScoreMin.value}%`;
    applyResultFilters();
  });
  rfScoreMax.addEventListener('input', () => {
    window.currentFilters.scoreMax = Number(rfScoreMax.value);
    rfScoreMaxValue.textContent = `${rfScoreMax.value}%`;
    applyResultFilters();
  });
  rfLocation.addEventListener('input', () => {
    window.currentFilters.location = rfLocation.value.trim();
    applyResultFilters();
  });
  rfCompany.addEventListener('input', () => {
    window.currentFilters.company = rfCompany.value.trim();
    applyResultFilters();
  });
  rfRole.addEventListener('input', () => {
    window.currentFilters.role = rfRole.value.trim();
    applyResultFilters();
  });
  rfClearBtn.addEventListener('click', () => {
    resetResultFilters();
    applyResultFilters();
  });

  // ---------- Render de empresas ----------
  function renderCompanyCard(company) {
    const node = companyCardTemplate.content.firstElementChild.cloneNode(true);

    const avatar = node.querySelector('.company-avatar');
    avatar.textContent = initials(company.nombre);
    avatar.style.background = hashColor(company.nombre || 'Empresa');

    const badge = node.querySelector('.portal-badge');
    if (company.hasActivePortal) {
      badge.textContent = 'Portal activo ✓';
      badge.classList.add('active');
    } else {
      badge.textContent = 'Ver portal';
      badge.classList.add('inactive');
    }

    node.querySelector('.company-name').textContent = company.nombre || 'Empresa';
    node.querySelector('.company-industry').textContent = company.industria || '';
    node.querySelector('.company-description').textContent = company.descripcion || '';

    const offersBtn = node.querySelector('.btn-company-offers');
    if (company.careersUrl) {
      offersBtn.href = company.careersUrl;
    } else {
      offersBtn.removeAttribute('href');
      offersBtn.style.opacity = '0.5';
      offersBtn.style.pointerEvents = 'none';
    }

    const linkedinLink = node.querySelector('.btn-company-linkedin');
    if (company.linkedin) {
      linkedinLink.href = company.linkedin;
    } else {
      linkedinLink.removeAttribute('href');
      linkedinLink.style.opacity = '0.5';
      linkedinLink.style.pointerEvents = 'none';
    }

    return node;
  }

  function renderCompanies(data) {
    companiesSkeleton.hidden = true;

    companiesNacionales.innerHTML = '';
    (data.nacionales || []).forEach((c) => companiesNacionales.appendChild(renderCompanyCard(c)));

    companiesTransnacionales.innerHTML = '';
    (data.transnacionales || []).forEach((c) => companiesTransnacionales.appendChild(renderCompanyCard(c)));

    companiesNacionales.hidden = false;
    companiesTransnacionales.hidden = true;
  }

  companyTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      companyTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isNacionales = tab.dataset.tab === 'nacionales';
      companiesNacionales.hidden = !isNacionales;
      companiesTransnacionales.hidden = isNacionales;
    });
  });

  // ---------- Envío del formulario ----------
  async function fetchJobs() {
    const response = await fetch(JOBS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildJobsPayload()),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Error en la búsqueda de vacantes');
    return data;
  }

  async function fetchCompanies() {
    companiesSkeleton.hidden = false;
    companiesNacionales.hidden = true;
    companiesTransnacionales.hidden = true;

    try {
      const response = await fetch(COMPANIES_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCompaniesPayload()),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error('companies failed');
      renderCompanies(data);
    } catch {
      companiesSkeleton.hidden = true;
    }
  }

  // ---------- Vacantes en empresas objetivo ----------
  function buildTargetCompaniesQuery() {
    return [roleInput.value.trim(), ...state.keywords].filter(Boolean).join(' ');
  }

  function renderCompanyPortalCard(result) {
    const node = companyPortalCardTemplate.content.firstElementChild.cloneNode(true);

    const avatar = node.querySelector('.company-avatar');
    avatar.textContent = initials(result.empresa);
    avatar.style.background = hashColor(result.empresa || 'Empresa');

    const typeBadge = node.querySelector('.portal-type-badge');
    typeBadge.textContent = PORTAL_TYPE_LABELS[result.tipo] || result.tipo || 'Portal';
    typeBadge.classList.add(`portal-type-${result.tipo}`);

    node.querySelector('.company-portal-name').textContent = result.empresa || 'Empresa';

    const vacantesEl = node.querySelector('.company-portal-vacantes');
    const emptyEl = node.querySelector('.company-portal-empty');
    const linkedinCtaEl = node.querySelector('.company-portal-linkedin-cta');

    if (result.tipo === 'linkedin') {
      const link = linkedinCtaEl.querySelector('a');
      link.href = result.searchUrl || '#';
      linkedinCtaEl.hidden = false;
    } else if (result.hasVacantes) {
      vacantesEl.innerHTML = '';

      const badge = document.createElement('span');
      badge.className = 'pill portal-found-badge';
      const n = result.vacantes.length;
      badge.textContent = `${n} vacante${n === 1 ? '' : 's'} encontrada${n === 1 ? '' : 's'}`;
      vacantesEl.appendChild(badge);

      result.vacantes.forEach((v) => {
        const row = document.createElement('div');
        row.className = 'company-portal-vacante-row';

        const info = document.createElement('div');
        const title = document.createElement('p');
        title.className = 'company-portal-vacante-title';
        title.textContent = v.title || 'Vacante sin título';
        info.appendChild(title);
        if (v.location) {
          const loc = document.createElement('p');
          loc.className = 'company-portal-vacante-location';
          loc.textContent = v.location;
          info.appendChild(loc);
        }
        row.appendChild(info);

        const viewBtn = document.createElement('a');
        viewBtn.className = 'btn-secondary company-portal-view-btn';
        viewBtn.textContent = 'Ver';
        viewBtn.target = '_blank';
        viewBtn.rel = 'noopener noreferrer';
        if (v.url) {
          viewBtn.href = v.url;
        } else {
          viewBtn.style.opacity = '0.5';
          viewBtn.style.pointerEvents = 'none';
        }
        row.appendChild(viewBtn);

        vacantesEl.appendChild(row);
      });

      vacantesEl.hidden = false;
    } else {
      const careersBtn = emptyEl.querySelector('.btn-portal-careers');
      if (result.careersUrl) {
        careersBtn.href = result.careersUrl;
      } else {
        careersBtn.style.opacity = '0.5';
        careersBtn.style.pointerEvents = 'none';
      }
      emptyEl.querySelector('.btn-portal-linkedin').href = result.searchUrl || '#';
      emptyEl.hidden = false;
    }

    return node;
  }

  function renderCompanyPortalResults(resultados) {
    targetCompaniesSkeleton.hidden = true;
    targetCompaniesResultsGrid.innerHTML = '';

    const foundCount = resultados.filter((r) => r.hasVacantes).length;
    const n = resultados.length;
    targetCompaniesResultsCount.textContent = `${n} empresa${n === 1 ? '' : 's'} consultada${n === 1 ? '' : 's'} · ${foundCount} con vacantes encontradas`;

    resultados.forEach((r) => targetCompaniesResultsGrid.appendChild(renderCompanyPortalCard(r)));
    targetCompaniesResultsGrid.hidden = false;
  }

  async function fetchCompanyPortals() {
    if (!state.targetCompanies.selected.size) return;

    targetCompaniesResultsHeader.hidden = false;
    targetCompaniesSkeleton.hidden = false;
    targetCompaniesResultsGrid.hidden = true;

    const empresas = Array.from(state.targetCompanies.selected)
      .map((name) => findCompanyByName(name) || { nombre: name });

    const payload = {
      empresas,
      query: buildTargetCompaniesQuery(),
      perfil: {
        cargoActual: roleInput.value.trim() || state.cvParsed?.cargoActual || null,
        industria: Array.from(state.industries)[0] || state.cvParsed?.industria || null,
        habilidades: state.cvParsed?.habilidades || [],
      },
    };

    try {
      const response = await fetch(COMPANIES_SEARCH_PORTALS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error('search-portals failed');
      renderCompanyPortalResults(data.resultados || []);
    } catch {
      targetCompaniesSkeleton.hidden = true;
      targetCompaniesResultsHeader.hidden = true;
    }
  }

  async function submitSearch() {
    showScreen('loading');
    startLoadingMessages();

    // Se lanzan en paralelo: las vacantes se muestran apenas llegan, las
    // empresas y los portales se cargan en segundo plano sin bloquear
    // los resultados principales.
    const companiesPromise = fetchCompanies();

    if (state.targetCompanies.selected.size) {
      fetchCompanyPortals().catch(() => {});
    } else {
      targetCompaniesResultsHeader.hidden = true;
      targetCompaniesSkeleton.hidden = true;
      targetCompaniesResultsGrid.hidden = true;
    }

    try {
      const data = await fetchJobs();
      stopLoadingMessages();

      currentPaisSeleccionado = data.paisSeleccionado?.pais || null;
      allColombiaJobs = data.paisSeleccionado?.jobs || [];
      allRemoteJobs = data.global?.jobs || [];

      paisSeleccionadoTitle.textContent = currentPaisSeleccionado ? `Vacantes en ${currentPaisSeleccionado}` : 'Vacantes en Colombia';
      resetResultFilters();
      applyResultFilters();
      showScreen('results');
    } catch {
      stopLoadingMessages();
      showScreen('error');
    }

    companiesPromise.catch(() => {});
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!hasAnyField()) {
      formError.hidden = false;
      return;
    }
    formError.hidden = true;
    submitSearch();
  });

  newSearchBtn.addEventListener('click', () => showScreen('form'));
  retryBtn.addEventListener('click', () => showScreen('form'));

  // ---------- Inicialización ----------
  renderChips();
  updateLinkedinHref();
  showScreen('form');
})();

// =============================================
// RESUME HEALTH
// =============================================

(function () {
  let rhCvText = null;
  let rhFileName = null;
  let rhAtsReport = null;
  let rhCvVersion1 = null; // { html, data }
  let rhCvVersion2 = null; // { html, data }
  let rhSelectedLang = 'es';

  // Colores según score
  function scoreColor(score) {
    if (score >= 80) return '#16A34A';
    if (score >= 60) return '#D97706';
    if (score >= 40) return '#EA580C';
    return '#DC2626';
  }

  // Iconos por tipo de hallazgo
  function hallazgoIcon(tipo) {
    const icons = { ok: '✅', critico: '🔴', advertencia: '⚠️', sugerencia: '💡' };
    return icons[tipo] || '•';
  }

  // ── Integración con CV ya cargado desde Job Search ──
  window.rhSetCvFromJobSearch = function (text, name) {
    rhCvText = text;
    rhFileName = name || 'curriculum';
    const loadedEl = document.getElementById('rhCvLoaded');
    const uploadEl = document.getElementById('rhCvUpload');
    const nameEl = document.getElementById('rhCvName');
    const btn = document.getElementById('rhAnalyzeBtn');
    if (loadedEl) loadedEl.style.display = 'block';
    if (uploadEl) uploadEl.style.display = 'none';
    if (nameEl) nameEl.textContent = name || 'CV cargado';
    if (btn) btn.disabled = false;
  };

  // ── File upload propio de Resume Health ──
  document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('rhFileInput');
    const analyzeBtn = document.getElementById('rhAnalyzeBtn');
    const changeBtn = document.getElementById('rhCvChange');
    const langEs = document.getElementById('rhLangEs');
    const langEn = document.getElementById('rhLangEn');
    const improveBtn = document.getElementById('rhImproveBtn');

    if (!fileInput) return; // sección no cargada

    // Si ya hay CV del estado global (cargado en Job Search)
    if (window.globalCvText) {
      window.rhSetCvFromJobSearch(window.globalCvText, window.globalCvFileName);
    }

    // Upload de archivo
    fileInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      rhFileName = file.name;
      rhCvText = null; // se enviará el archivo directo
      window._rhFile = file;
      document.getElementById('rhCvLoaded').style.display = 'block';
      document.getElementById('rhCvUpload').style.display = 'none';
      document.getElementById('rhCvName').textContent = file.name;
      analyzeBtn.disabled = false;
    });

    // Drag-and-drop — reusa el handler de 'change' de arriba en vez de
    // duplicar la lógica de carga.
    const dropzone = document.getElementById('rhDropzone');
    if (dropzone) {
      ['dragenter', 'dragover'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });
      dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
      });
    }

    // Cambiar CV
    if (changeBtn) {
      changeBtn.addEventListener('click', function () {
        document.getElementById('rhCvLoaded').style.display = 'none';
        document.getElementById('rhCvUpload').style.display = 'block';
        rhCvText = null;
        window._rhFile = null;
        analyzeBtn.disabled = true;
      });
    }

    // Toggle idioma
    if (langEs) {
      langEs.addEventListener('click', function () {
        rhSelectedLang = 'es';
        langEs.classList.add('active');
        langEn.classList.remove('active');
      });
    }

    if (langEn) {
      langEn.addEventListener('click', function () {
        rhSelectedLang = 'en';
        langEn.classList.add('active');
        langEs.classList.remove('active');
      });
    }

    // ── ANALIZAR ──
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', async function () {
        document.getElementById('rhUploadZone').style.display = 'none';
        document.getElementById('rhReport').style.display = 'none';
        document.getElementById('rhVersions').style.display = 'none';
        document.getElementById('rhLoading').style.display = 'block';

        const loadingMessages = [
          'Analizando formato y estructura...',
          'Evaluando keywords y contenido...',
          'Revisando criterios ATS...',
          'Generando reporte detallado...',
        ];
        let msgIdx = 0;
        const msgEl = document.getElementById('rhLoadingText');
        const msgInterval = setInterval(() => {
          msgIdx = (msgIdx + 1) % loadingMessages.length;
          if (msgEl) msgEl.textContent = loadingMessages[msgIdx];
        }, 2000);

        try {
          let response;

          if (window._rhFile) {
            const formData = new FormData();
            formData.append('cv', window._rhFile);
            response = await fetch('/api/resume/ats-analyze', {
              method: 'POST',
              body: formData,
              signal: AbortSignal.timeout(180000),
            });
          } else if (rhCvText) {
            response = await fetch('/api/resume/ats-analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cvText: rhCvText, fileName: rhFileName }),
              signal: AbortSignal.timeout(180000),
            });
          } else {
            throw new Error('No hay CV para analizar.');
          }

          const data = await response.json();
          if (!data.success) throw new Error(data.error);

          rhAtsReport = data.report;
          if (data.cvText) rhCvText = data.cvText;
          if (data.fileName) rhFileName = data.fileName;

          clearInterval(msgInterval);
          document.getElementById('rhLoading').style.display = 'none';
          renderAtsReport(data.report);
          document.getElementById('rhReport').style.display = 'block';
        } catch (err) {
          clearInterval(msgInterval);
          document.getElementById('rhLoading').style.display = 'none';
          document.getElementById('rhUploadZone').style.display = 'block';
          window.alert('Error al analizar el CV: ' + err.message);
        }
      });
    }

    // ── IMPROVE ──
    if (improveBtn) {
      improveBtn.addEventListener('click', async function () {
        document.getElementById('rhVersions').style.display = 'none';
        document.getElementById('rhImprovingLoading').style.display = 'block';

        const improvingMessages = [
          'Generando versiones mejoradas del CV...',
          'Optimizando contenido para ATS...',
          'Aplicando mejoras de diseño...',
          'Casi listo...',
        ];
        let msgIdx2 = 0;
        const msgEl2 = document.getElementById('rhImprovingText');
        const msgInterval2 = setInterval(() => {
          msgIdx2 = (msgIdx2 + 1) % improvingMessages.length;
          if (msgEl2) msgEl2.textContent = improvingMessages[msgIdx2];
        }, 3000);

        try {
          const response = await fetch('/api/resume/improve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cvText: rhCvText,
              atsReport: rhAtsReport,
              language: rhSelectedLang,
              fileName: rhFileName,
            }),
            signal: AbortSignal.timeout(180000),
          });

          const data = await response.json();
          if (!data.success) throw new Error(data.error);

          rhCvVersion1 = { html: data.version1.html, data: data.version1.data };
          rhCvVersion2 = { html: data.version2.html, data: data.version2.data };

          clearInterval(msgInterval2);
          document.getElementById('rhImprovingLoading').style.display = 'none';
          renderVersions(data);
        } catch (err) {
          clearInterval(msgInterval2);
          document.getElementById('rhImprovingLoading').style.display = 'none';
          window.alert('Error generando el CV mejorado: ' + err.message);
        }
      });
    }
  });

  // ── RENDER REPORTE ATS ──
  function renderAtsReport(report) {
    document.getElementById('rhScoreNumber').textContent = report.scoreGeneral;
    document.getElementById('rhScoreNivel').textContent = report.nivel;
    document.getElementById('rhScoreResumen').textContent = report.resumenEjecutivo;

    const color = scoreColor(report.scoreGeneral);
    document.getElementById('rhScoreNumber').style.color = color;

    const catContainer = document.getElementById('rhCategorias');
    catContainer.innerHTML = '';
    Object.values(report.categorias || {}).forEach((cat) => {
      const card = document.createElement('div');
      card.className = 'rh-cat-card';
      const barColor = scoreColor(cat.score);
      card.innerHTML = `
        <div class="rh-cat-header">
          <span class="rh-cat-title">${cat.titulo}</span>
          <span class="rh-cat-score" style="color:${barColor}">${cat.score}/100</span>
        </div>
        <div class="rh-cat-bar">
          <div class="rh-cat-bar-fill" style="width:${cat.score}%;background:${barColor}"></div>
        </div>
        <ul class="rh-cat-hallazgos">
          ${(cat.hallazgos || []).slice(0, 4).map((h) => `
            <li class="rh-hallazgo">
              <span class="rh-hallazgo-icon">${hallazgoIcon(h.tipo)}</span>
              <span>${h.texto}</span>
            </li>
          `).join('')}
        </ul>
      `;
      catContainer.appendChild(card);
    });

    const problemasBlock = document.getElementById('rhProblemasBlock');
    if (report.problemasRojos && report.problemasRojos.length > 0) {
      problemasBlock.style.display = 'block';
      document.getElementById('rhProblemasList').innerHTML = report.problemasRojos.map((p) => `<li>🔴 ${p}</li>`).join('');
    } else {
      problemasBlock.style.display = 'none';
    }

    const fortalezasBlock = document.getElementById('rhFortalezasBlock');
    if (report.fortalezas && report.fortalezas.length > 0) {
      fortalezasBlock.style.display = 'block';
      document.getElementById('rhFortalezasList').innerHTML = report.fortalezas.map((f) => `<li>${f}</li>`).join('');
    } else {
      fortalezasBlock.style.display = 'none';
    }

    document.getElementById('rhKeywordsDetectadas').innerHTML = (report.keywordsDetectadas || [])
      .map((k) => `<span class="rh-chip">${k}</span>`).join('');

    document.getElementById('rhKeywordsFaltantes').innerHTML = (report.keywordsFaltantes || [])
      .map((k) => `<span class="rh-chip">${k}</span>`).join('');

    document.getElementById('rhAccionesList').innerHTML = (report.recomendacionesPrioritarias || [])
      .map((a) => `<li>${a}</li>`).join('');
  }

  // ── RENDER VERSIONES ──
  function renderVersions(result) {
    document.getElementById('rhV1Title').textContent = result.version1.titulo;
    document.getElementById('rhV1Desc').textContent = result.version1.descripcion;
    document.getElementById('rhV2Title').textContent = result.version2.titulo;
    document.getElementById('rhV2Desc').textContent = result.version2.descripcion;

    function setIframeContent(containerId, html) {
      const container = document.getElementById(containerId);
      container.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '600px';
      iframe.style.border = '1px solid #E5E7EB';
      iframe.style.borderRadius = '8px';
      container.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
    }

    setIframeContent('rhV1Preview', result.version1.html);
    setIframeContent('rhV2Preview', result.version2.html);

    document.getElementById('rhVersions').style.display = 'block';
    document.getElementById('rhVersions').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── DESCARGA ──
  // Solo DOCX (generado en el servidor desde el campo "data") — la opción de
  // PDF vía window.print() se quitó por fallas pendientes de Fase 2.
  window.downloadCV = async function (version) {
    const format = 'docx';
    const entry = version === 'v1' ? rhCvVersion1 : rhCvVersion2;
    if (!entry) {
      window.alert('No hay un CV mejorado listo para descargar todavía.');
      return;
    }
    const baseName = (rhFileName || 'CV').replace(/\.[^.]+$/, '');
    const vLabel = version === 'v1' ? 'Original' : 'JobFinder';
    const fileName = `${baseName}_${vLabel}`;

    try {
      const response = await fetch('/api/resume/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: entry.html, data: entry.data, format, fileName }),
      });

      if (!response.ok) throw new Error('Error generando archivo');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert('Error al descargar: ' + err.message);
    }
  };
})();

// =============================================
// JOB MATCH
// =============================================

(function () {
  let jmCvText = null;
  let jmCvData = null;
  let jmFileName = null;
  let jmMatchReport = null;
  let jmAdjustedCv = null; // { data, cambiosRealizados }
  let jmCoverLetter = null; // { data }
  let jmSelectedLang = 'es';

  function scoreColor(score) {
    if (score >= 80) return '#16A34A';
    if (score >= 60) return '#D97706';
    if (score >= 40) return '#EA580C';
    return '#DC2626';
  }

  // Definida a nivel de módulo (no dentro del listener de DOMContentLoaded)
  // porque jmSetCvFromJobSearch también necesita llamarla y vive en este
  // mismo scope superior — antes estaba anidada adentro del listener y
  // jmSetCvFromJobSearch no podía verla (ReferenceError).
  function updateAnalyzeBtnState() {
    const analyzeBtn = document.getElementById('jmAnalyzeBtn');
    const jdTextarea = document.getElementById('jmJobDescription');
    if (analyzeBtn && jdTextarea) {
      analyzeBtn.disabled = !(jmCvText && jdTextarea.value.trim());
    }
  }

  // ── Integración con CV ya cargado desde Job Search ──
  window.jmSetCvFromJobSearch = function (text, data, name) {
    jmCvText = text;
    jmCvData = data;
    jmFileName = name || 'curriculum';
    const loadedEl = document.getElementById('jmCvLoaded');
    const uploadEl = document.getElementById('jmCvUpload');
    const nameEl = document.getElementById('jmCvName');
    if (loadedEl) loadedEl.style.display = 'block';
    if (uploadEl) uploadEl.style.display = 'none';
    if (nameEl) nameEl.textContent = name || 'CV cargado';
    updateAnalyzeBtnState();
  };

  document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('jmFileInput');
    const analyzeBtn = document.getElementById('jmAnalyzeBtn');
    const changeBtn = document.getElementById('jmCvChange');
    const jdTextarea = document.getElementById('jmJobDescription');
    const langEs = document.getElementById('jmLangEs');
    const langEn = document.getElementById('jmLangEn');
    const adjustBtn = document.getElementById('jmAdjustCvBtn');
    const coverLetterBtn = document.getElementById('jmCoverLetterBtn');
    const downloadCvBtn = document.getElementById('jmDownloadCvBtn');
    const downloadClBtn = document.getElementById('jmDownloadClBtn');

    if (!fileInput) return; // sección no cargada

    if (window.globalCvText && window.globalCvData) {
      window.jmSetCvFromJobSearch(window.globalCvText, window.globalCvData, window.globalCvFileName);
    }

    // ── Upload propio (reusa /api/cv/parse — mismo pipeline PDF/DOCX ya probado) ──
    fileInput.addEventListener('change', async function (e) {
      const file = e.target.files[0];
      if (!file) return;

      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Leyendo CV...';

      try {
        const formData = new FormData();
        formData.append('cv', file);
        const response = await fetch('/api/cv/parse', {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(180000),
        });
        if (!response.ok) throw new Error('No se pudo leer el CV.');
        const parsed = await response.json();

        window.jmSetCvFromJobSearch(parsed.cvText, parsed, file.name);
      } catch (err) {
        window.alert('Error al leer el CV: ' + err.message);
      } finally {
        analyzeBtn.textContent = 'Analizar Compatibilidad →';
        updateAnalyzeBtnState();
      }
    });

    // Drag-and-drop — reusa el handler de 'change' de arriba en vez de
    // duplicar la lógica de carga.
    const dropzone = document.getElementById('jmDropzone');
    if (dropzone) {
      ['dragenter', 'dragover'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });
      dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
      });
    }

    if (changeBtn) {
      changeBtn.addEventListener('click', function () {
        document.getElementById('jmCvLoaded').style.display = 'none';
        document.getElementById('jmCvUpload').style.display = 'block';
        jmCvText = null;
        jmCvData = null;
        updateAnalyzeBtnState();
      });
    }

    jdTextarea.addEventListener('input', updateAnalyzeBtnState);

    // Dos toggles de idioma en la sección (uno junto al form de análisis,
    // otro en la caja "Generar Documentos") que comparten el mismo estado
    // jmSelectedLang — se mantienen sincronizados entre sí.
    const docLangEs = document.getElementById('jmDocLangEs');
    const docLangEn = document.getElementById('jmDocLangEn');
    const allLangEsBtns = [langEs, docLangEs].filter(Boolean);
    const allLangEnBtns = [langEn, docLangEn].filter(Boolean);

    function setJmLang(lang) {
      jmSelectedLang = lang;
      allLangEsBtns.forEach((btn) => btn.classList.toggle('active', lang === 'es'));
      allLangEnBtns.forEach((btn) => btn.classList.toggle('active', lang === 'en'));
    }

    allLangEsBtns.forEach((btn) => btn.addEventListener('click', () => setJmLang('es')));
    allLangEnBtns.forEach((btn) => btn.addEventListener('click', () => setJmLang('en')));

    // ── ANALIZAR ──
    analyzeBtn.addEventListener('click', async function () {
      document.getElementById('jmForm').style.display = 'none';
      document.getElementById('jmReport').style.display = 'none';
      document.getElementById('jmAdjustResult').style.display = 'none';
      document.getElementById('jmCoverLetterResult').style.display = 'none';
      document.getElementById('jmLoading').style.display = 'block';

      const loadingMessages = [
        'Comparando tu CV con la vacante...',
        'Evaluando habilidades y keywords...',
        'Analizando experiencia y seniority...',
        'Generando reporte de compatibilidad...',
      ];
      let msgIdx = 0;
      const msgEl = document.getElementById('jmLoadingText');
      const msgInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % loadingMessages.length;
        if (msgEl) msgEl.textContent = loadingMessages[msgIdx];
      }, 2000);

      try {
        const response = await fetch('/api/match/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cvText: jmCvText,
            cvData: jmCvData,
            jobDescription: jdTextarea.value.trim(),
            language: jmSelectedLang,
          }),
          signal: AbortSignal.timeout(180000),
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        jmMatchReport = data;

        clearInterval(msgInterval);
        document.getElementById('jmLoading').style.display = 'none';
        renderMatchReport(data);
        document.getElementById('jmReport').style.display = 'block';
      } catch (err) {
        clearInterval(msgInterval);
        document.getElementById('jmLoading').style.display = 'none';
        document.getElementById('jmForm').style.display = 'block';
        window.alert('Error al analizar la compatibilidad: ' + err.message);
      }
    });

    // ── GENERAR CV AJUSTADO ──
    adjustBtn.addEventListener('click', async function () {
      document.getElementById('jmDocLoadingText').textContent = 'Ajustando tu CV a esta vacante...';
      document.getElementById('jmDocLoading').style.display = 'block';
      document.getElementById('jmAdjustResult').style.display = 'none';

      try {
        const response = await fetch('/api/match/adjust-cv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cvData: jmCvData,
            jobDescription: jdTextarea.value.trim(),
            matchReport: jmMatchReport,
            language: jmSelectedLang,
          }),
          signal: AbortSignal.timeout(180000),
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        jmAdjustedCv = { data: data.data, cambiosRealizados: data.cambiosRealizados };

        document.getElementById('jmCambiosList').innerHTML = (data.cambiosRealizados || [])
          .map((c) => `<li>${c}</li>`).join('');
        document.getElementById('jmDocLoading').style.display = 'none';
        document.getElementById('jmAdjustResult').style.display = 'block';
      } catch (err) {
        document.getElementById('jmDocLoading').style.display = 'none';
        window.alert('Error al generar el CV ajustado: ' + err.message);
      }
    });

    // ── GENERAR COVER LETTER ──
    coverLetterBtn.addEventListener('click', async function () {
      const companyName = document.getElementById('jmCompanyName').value.trim();
      if (!companyName) {
        window.alert('Confirma el nombre de la empresa antes de generar la carta.');
        return;
      }

      document.getElementById('jmDocLoadingText').textContent = 'Generando tu cover letter...';
      document.getElementById('jmDocLoading').style.display = 'block';
      document.getElementById('jmCoverLetterResult').style.display = 'none';

      try {
        const response = await fetch('/api/match/cover-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cvData: jmCvData,
            jobDescription: jdTextarea.value.trim(),
            companyName,
            language: jmSelectedLang,
          }),
          signal: AbortSignal.timeout(180000),
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        jmCoverLetter = { data: data.data };
        renderCoverLetterPreview(data.data);

        document.getElementById('jmDocLoading').style.display = 'none';
        document.getElementById('jmCoverLetterResult').style.display = 'block';
      } catch (err) {
        document.getElementById('jmDocLoading').style.display = 'none';
        window.alert('Error al generar la cover letter: ' + err.message);
      }
    });

    // ── DESCARGAS ──
    downloadCvBtn.addEventListener('click', async function () {
      if (!jmAdjustedCv) return;
      await downloadDocx('/api/match/download-cv', jmAdjustedCv.data, `${(jmFileName || 'CV').replace(/\.[^.]+$/, '')}_Ajustado`);
    });

    downloadClBtn.addEventListener('click', async function () {
      if (!jmCoverLetter) return;
      const companyName = document.getElementById('jmCompanyName').value.trim() || 'Empresa';
      await downloadDocx('/api/match/download-cover-letter', jmCoverLetter.data, `Cover_Letter_${companyName}`);
    });

    async function downloadDocx(endpoint, data, fileName) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, fileName }),
        });
        if (!response.ok) throw new Error('Error generando archivo');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        window.alert('Error al descargar: ' + err.message);
      }
    }

    updateAnalyzeBtnState();
  });

  // ── RENDER REPORTE DE MATCH ──
  function renderMatchReport(report) {
    document.getElementById('jmScoreNumber').textContent = report.score;
    document.getElementById('jmScoreNivel').textContent = report.nivel;
    document.getElementById('jmScoreResumen').textContent = report.resumenEjecutivo;
    document.getElementById('jmScoreNumber').style.color = scoreColor(report.score);

    const catContainer = document.getElementById('jmDesglose');
    catContainer.innerHTML = '';
    (report.desglose || []).forEach((cat) => {
      const card = document.createElement('div');
      card.className = 'rh-cat-card';
      const barColor = scoreColor(cat.puntaje);
      card.innerHTML = `
        <div class="rh-cat-header">
          <span class="rh-cat-title">${cat.categoria} (${cat.peso}%)</span>
          <span class="rh-cat-score" style="color:${barColor}">${cat.puntaje}/100</span>
        </div>
        <div class="rh-cat-bar">
          <div class="rh-cat-bar-fill" style="width:${cat.puntaje}%;background:${barColor}"></div>
        </div>
        <p class="rh-hallazgo"><span>${cat.comentario || ''}</span></p>
      `;
      catContainer.appendChild(card);
    });

    const brechasBlock = document.getElementById('jmBrechasBlock');
    if (report.brechas && report.brechas.length) {
      brechasBlock.style.display = 'block';
      document.getElementById('jmBrechasList').innerHTML = report.brechas.map((b) => `<li>🔴 ${b}</li>`).join('');
    } else {
      brechasBlock.style.display = 'none';
    }

    const fortalezasBlock = document.getElementById('jmFortalezasBlock');
    if (report.fortalezas && report.fortalezas.length) {
      fortalezasBlock.style.display = 'block';
      document.getElementById('jmFortalezasList').innerHTML = report.fortalezas.map((f) => `<li>${f}</li>`).join('');
    } else {
      fortalezasBlock.style.display = 'none';
    }

    document.getElementById('jmKeywordsCoincidentes').innerHTML = (report.keywordsCoincidentes || [])
      .map((k) => `<span class="rh-chip">${k}</span>`).join('');
    document.getElementById('jmKeywordsFaltantes').innerHTML = (report.keywordsFaltantes || [])
      .map((k) => `<span class="rh-chip">${k}</span>`).join('');
    document.getElementById('jmAccionesList').innerHTML = (report.recomendacionesPrioritarias || [])
      .map((a) => `<li>${a}</li>`).join('');

    const companyInput = document.getElementById('jmCompanyName');
    if (report.empresaDetectada && !companyInput.value.trim()) {
      companyInput.value = report.empresaDetectada;
    }
  }

  // ── RENDER PREVIEW COVER LETTER ──
  function renderCoverLetterPreview(cl) {
    const remitente = cl.remitente || {};
    const destinatario = cl.destinatario || {};
    const lines = [
      remitente.nombre,
      remitente.contacto,
      '',
      cl.fecha,
      '',
      destinatario.empresa,
      destinatario.puesto ? `Re: ${destinatario.puesto}` : '',
      '',
      cl.saludo,
      '',
      ...(cl.parrafos || []),
      '',
      cl.despedida,
      cl.firma,
    ].filter((line) => line !== undefined);

    document.getElementById('jmClPreview').textContent = lines.join('\n');
  }
})();

