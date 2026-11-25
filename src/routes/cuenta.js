// Registro, sesión y acciones del estudiante: guardar, reportar, notificaciones.
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, transaccion } = require('../db');
const { iniciarSesion, cerrarSesion, requiereSesion } = require('../auth');

const router = express.Router();
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function rolesDe(db, idUsuario) {
  const { rows } = await db.query(
    'SELECT r.nombre FROM usuario_rol ur JOIN rol r USING (id_rol) WHERE ur.id_usuario = $1',
    [idUsuario]
  );
  return rows.map((r) => r.nombre);
}

router.post('/auth/registro', async (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const correo = String(req.body.correo || '').trim().toLowerCase();
  const contrasena = String(req.body.contrasena || '');
  const idUnidad = Number.parseInt(req.body.id_unidad, 10) || null;

  if (nombre.length < 2 || nombre.length > 150) return res.status(400).json({ error: 'Escribe tu nombre.' });
  if (!CORREO.test(correo) || correo.length > 200) return res.status(400).json({ error: 'Correo no válido.' });
  if (contrasena.length < 8 || contrasena.length > 72) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 72 caracteres.' });
  }

  const hash = await bcrypt.hash(contrasena, 10);
  try {
    const usuario = await transaccion(async (db) => {
      const { rows } = await db.query(
        `INSERT INTO usuario (nombre, correo, contrasena_hash, id_unidad)
         VALUES ($1, $2, $3, $4) RETURNING id_usuario, nombre`,
        [nombre, correo, hash, idUnidad]
      );
      await db.query(
        `INSERT INTO usuario_rol (id_usuario, id_rol) SELECT $1, id_rol FROM rol WHERE nombre = 'estudiante'`,
        [rows[0].id_usuario]
      );
      return { ...rows[0], roles: ['estudiante'] };
    });
    iniciarSesion(res, usuario);
    res.status(201).json({ id: usuario.id_usuario, nombre: usuario.nombre, roles: usuario.roles });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    if (e.code === '23503') return res.status(400).json({ error: 'Unidad académica no válida.' });
    throw e;
  }
});

router.post('/auth/login', async (req, res) => {
  const correo = String(req.body.correo || '').trim().toLowerCase();
  const contrasena = String(req.body.contrasena || '');
  const { rows } = await pool.query(
    'SELECT id_usuario, nombre, contrasena_hash FROM usuario WHERE correo = $1 AND activo',
    [correo]
  );
  const ok = rows.length && (await bcrypt.compare(contrasena, rows[0].contrasena_hash));
  if (!ok) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });

  const usuario = { ...rows[0], roles: await rolesDe(pool, rows[0].id_usuario) };
  iniciarSesion(res, usuario);
  res.json({ id: usuario.id_usuario, nombre: usuario.nombre, roles: usuario.roles });
});

router.post('/auth/logout', (_req, res) => {
  cerrarSesion(res);
  res.status(204).end();
});

router.get('/auth/yo', (req, res) => {
  if (!req.usuario) return res.json(null);
  const { id, nombre, roles } = req.usuario;
  res.json({ id, nombre, roles });
});

// ----- Oportunidades guardadas -----

router.get('/guardadas', requiereSesion, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT o.id_oportunidad, o.titulo, o.tipo, o.estado_vigencia, g.fecha_guardado
     FROM oportunidad_guardada g JOIN oportunidad o USING (id_oportunidad)
     WHERE g.id_usuario = $1 AND o.activo ORDER BY g.fecha_guardado DESC`,
    [req.usuario.id]
  );
  res.json(rows);
});

router.put('/guardadas/:id', requiereSesion, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO oportunidad_guardada (id_usuario, id_oportunidad) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.usuario.id, Number.parseInt(req.params.id, 10) || 0]
    );
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ error: 'Oportunidad no encontrada.' });
    throw e;
  }
  res.status(204).end();
});

router.delete('/guardadas/:id', requiereSesion, async (req, res) => {
  await pool.query('DELETE FROM oportunidad_guardada WHERE id_usuario = $1 AND id_oportunidad = $2', [
    req.usuario.id,
    Number.parseInt(req.params.id, 10) || 0,
  ]);
  res.status(204).end();
});

// ----- Reportes -----

const MOTIVOS = ['informacion_incorrecta', 'desactualizada', 'enlace_roto', 'otro'];

router.post('/oportunidades/:id/reportes', requiereSesion, async (req, res) => {
  const motivo = req.body.motivo;
  if (!MOTIVOS.includes(motivo)) return res.status(400).json({ error: 'Elige un motivo.' });
  try {
    await pool.query(
      'INSERT INTO reporte (id_usuario, id_oportunidad, motivo, descripcion) VALUES ($1, $2, $3, $4)',
      [
        req.usuario.id,
        Number.parseInt(req.params.id, 10) || 0,
        motivo,
        String(req.body.descripcion || '').trim().slice(0, 1000) || null,
      ]
    );
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ error: 'Oportunidad no encontrada.' });
    throw e;
  }
  res.status(201).json({ ok: true });
});

// ----- Notificaciones -----

router.get('/notificaciones', requiereSesion, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id_notificacion, id_oportunidad, mensaje, tipo, fecha_envio, leida
     FROM notificacion WHERE id_usuario = $1 ORDER BY fecha_envio DESC LIMIT 50`,
    [req.usuario.id]
  );
  res.json(rows);
});

router.post('/notificaciones/leidas', requiereSesion, async (req, res) => {
  await pool.query('UPDATE notificacion SET leida = TRUE WHERE id_usuario = $1 AND NOT leida', [req.usuario.id]);
  res.status(204).end();
});

module.exports = router;
