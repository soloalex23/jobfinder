require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  adzuna: {
    appId: process.env.ADZUNA_APP_ID,
    appKey: process.env.ADZUNA_APP_KEY,
    baseUrl: process.env.ADZUNA_BASE_URL || 'https://api.adzuna.com/v1/api/jobs',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
};
