// `undici` (dependencia transitiva de cheerio, usada por los scrapers)
// referencia el global `File` sin comprobar al cargarse
// (webidl/index.js: "webidl.is.File = ...MakeTypeAssertion(File)"), lo que
// revienta con "ReferenceError: File is not defined" en runtimes sin ese
// global (Node < 20). Se poliféllea ANTES de cualquier otro require —
// especialmente antes de las rutas, que arrastran cheerio transitivamente.
// El fix real es exigir Node >= 20 (ver "engines" en package.json y
// .nvmrc), esto es una red de seguridad adicional.
if (typeof globalThis.File === 'undefined') {
  try {
    const { File } = require('node:buffer');
    if (File) globalThis.File = File;
  } catch {
    // Node demasiado antiguo (< 19.8) sin File en node:buffer.
    // Requiere Node >= 20 — ver "engines" en package.json.
  }
}

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
