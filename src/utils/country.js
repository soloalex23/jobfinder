// Mapea nombres comunes en español/inglés a códigos ISO de 2 letras.
const COUNTRY_CODE_MAP = {
  espana: 'es', spain: 'es', es: 'es',
  mexico: 'mx', méxico: 'mx', mx: 'mx',
  'estados unidos': 'us', usa: 'us', us: 'us',
  'reino unido': 'gb', uk: 'gb', gb: 'gb',
  brasil: 'br', brazil: 'br', br: 'br',
  canada: 'ca', canadá: 'ca', ca: 'ca',
  alemania: 'de', germany: 'de', de: 'de',
  francia: 'fr', france: 'fr', fr: 'fr',
  italia: 'it', italy: 'it', it: 'it',
  india: 'in', in: 'in',
  holanda: 'nl', netherlands: 'nl', nl: 'nl',
  polonia: 'pl', poland: 'pl', pl: 'pl',
  singapur: 'sg', singapore: 'sg', sg: 'sg',
  sudafrica: 'za', 'south africa': 'za', za: 'za',
  austria: 'at', at: 'at',
  australia: 'au', au: 'au',
  rusia: 'ru', russia: 'ru', ru: 'ru',
  'nueva zelanda': 'nz', 'new zealand': 'nz', nz: 'nz',
  colombia: 'co', co: 'co',
  argentina: 'ar', ar: 'ar',
  chile: 'cl', cl: 'cl',
  peru: 'pe', perú: 'pe', pe: 'pe',
  'remote-global': 'remote', 'remote global': 'remote', remote: 'remote',
};

// Países que Adzuna cubre realmente (ver https://developer.adzuna.com/).
const ADZUNA_SUPPORTED_CODES = new Set([
  'at', 'au', 'br', 'ca', 'de', 'es', 'fr', 'gb', 'in', 'it',
  'mx', 'nl', 'nz', 'pl', 'ru', 'sg', 'us', 'za',
]);

function resolveCountryCode(country) {
  if (!country) return 'us';
  const key = country.trim().toLowerCase();
  return COUNTRY_CODE_MAP[key] || key.slice(0, 2) || 'us';
}

function isAdzunaSupported(countryCode) {
  return ADZUNA_SUPPORTED_CODES.has(countryCode);
}

// Todos los alias (ES/EN) que resuelven a un código de país dado — útil para
// buscar el nombre del país en texto libre (ej. la ubicación de una vacante)
// sin importar en qué idioma esté escrito.
function getCountryAliases(code) {
  return Object.keys(COUNTRY_CODE_MAP).filter((key) => COUNTRY_CODE_MAP[key] === code);
}

module.exports = { resolveCountryCode, isAdzunaSupported, getCountryAliases };
