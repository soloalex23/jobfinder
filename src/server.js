const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const jobsRouter = require('./routes/jobs');
const cvRouter = require('./routes/cv');
const companiesRouter = require('./routes/companies');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/jobs', jobsRouter);
app.use('/api/cv', cvRouter);
app.use('/api/companies', companiesRouter);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de errores de multer (archivo inválido, tamaño excedido, etc.)
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(config.port, () => {
  console.log(`Servidor escuchando en http://localhost:${config.port}`);
});
