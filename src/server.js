require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { sesionOpcional } = require('./auth');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', sesionOpcional);
app.use('/api', require('./routes/publico'));
app.use('/api', require('./routes/cuenta'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no válido.' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const puerto = Number(process.env.PORT) || 3000;
app.listen(puerto, () => console.log(`Servidor en http://localhost:${puerto}`));
