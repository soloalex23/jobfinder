// Infiere el nivel de seniority a partir del título de la vacante.
// Orden de más a menos específico para evitar falsos positivos
// (ej. "Director" no debe caer en "Lead").
const SENIORITY_PATTERNS = [
  { label: 'C-Level', regex: /\b(chief|ceo|cto|cfo|coo|cpo|cmo)\b/i },
  { label: 'Director-VP', regex: /\b(director|vp|vice president|vicepresidente)\b/i },
  { label: 'Gerente-Manager', regex: /\b(manager|gerente)\b/i },
  { label: 'Lead-Coordinador', regex: /\b(lead|coordinator|coordinador[a]?|head of|tech lead)\b/i },
  { label: 'Senior', regex: /\b(senior|sr\.?)\b/i },
  { label: 'Junior', regex: /\b(junior|jr\.?|entry[- ]level|trainee|intern(ship)?|practicante)\b/i },
  { label: 'Mid', regex: /\b(mid[- ]level|intermediate|semi[- ]senior)\b/i },
];

function inferSeniority(title) {
  if (!title) return null;
  const match = SENIORITY_PATTERNS.find((p) => p.regex.test(title));
  return match ? match.label : null;
}

module.exports = { inferSeniority, SENIORITY_PATTERNS };
