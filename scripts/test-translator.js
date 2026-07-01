const { translateProfileToBoths } = require('../src/services/translator');

async function main() {
  const result = await translateProfileToBoths({
    role: 'Compliance Officer',
    keywords: ['SARLAFT', 'risk management', 'regulatory'],
    skills: ['risk management', 'internal audit'],
    industry: 'Derecho y Cumplimiento',
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => console.error('ERROR', e));
