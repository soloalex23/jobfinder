// Similitud por bigramas (coeficiente de Dice) para detectar vacantes
// duplicadas entre la query en español y la query en inglés.
function bigrams(str) {
  const s = str.toLowerCase().replace(/\s+/g, ' ').trim();
  const grams = [];
  for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
  return grams;
}

function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  if (!gramsA.length || !gramsB.length) return a === b ? 1 : 0;

  const counts = new Map();
  gramsB.forEach((g) => counts.set(g, (counts.get(g) || 0) + 1));

  let matches = 0;
  gramsA.forEach((g) => {
    const count = counts.get(g) || 0;
    if (count > 0) {
      matches += 1;
      counts.set(g, count - 1);
    }
  });

  return (2 * matches) / (gramsA.length + gramsB.length);
}

function jobKey(job) {
  return `${job.title || ''} ${job.company || ''}`.trim();
}

// Si dos vacantes tienen título+empresa con más de 80% de similitud, se
// conserva solo la de mayor compatibilityScore. Requiere que los jobs ya
// traigan compatibilityScore calculado.
function dedupeSimilarJobs(jobs, threshold = 0.8) {
  const kept = [];

  jobs.forEach((job) => {
    const key = jobKey(job);
    const duplicateIndex = kept.findIndex((k) => diceCoefficient(key, jobKey(k)) > threshold);

    if (duplicateIndex === -1) {
      kept.push(job);
      return;
    }

    if ((job.compatibilityScore || 0) > (kept[duplicateIndex].compatibilityScore || 0)) {
      kept[duplicateIndex] = job;
    }
  });

  return kept;
}

module.exports = { dedupeSimilarJobs, diceCoefficient };
