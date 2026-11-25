// Consulta pública: catálogos, listado con filtros y detalle de oportunidades.
const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const entero = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const hora = (v) => (/^\d{2}:\d{2}$/.test(v || '') ? v : null);

router.get('/catalogos', async (_req, res) => {
  const [unidades, disciplinas, sedes, organizadores] = await Promise.all([
    pool.query('SELECT id_unidad, nombre, siglas, zona FROM unidad_academica ORDER BY siglas'),
    pool.query('SELECT id_disciplina, nombre FROM disciplina WHERE activo ORDER BY nombre'),
    pool.query(
      `SELECT s.id_sede, s.nombre, u.siglas FROM sede s
       JOIN unidad_academica u USING (id_unidad) WHERE s.activo ORDER BY u.siglas, s.nombre`
    ),
    pool.query('SELECT id_organizador, nombre FROM organizador ORDER BY nombre'),
  ]);
  res.json({
    unidades: unidades.rows,
    disciplinas: disciplinas.rows,
    sedes: sedes.rows,
    organizadores: organizadores.rows,
  });
});

// Columnas compartidas por el listado y el detalle.
const SELECT_BASE = `
  SELECT o.id_oportunidad, o.titulo, o.descripcion, o.tipo, o.estado_vigencia,
         o.url_oficial, o.destacada, o.fecha_publicacion, o.fecha_actualizacion,
         o.id_organizador, org.nombre AS organizador,
         (SELECT max(v.fecha) FROM verificacion v
           WHERE v.id_oportunidad = o.id_oportunidad AND v.resultado = 'vigente') AS ultima_verificacion,
         COALESCE((SELECT json_agg(json_build_object('id_unidad', u.id_unidad, 'siglas', u.siglas) ORDER BY u.siglas)
           FROM oportunidad_unidad ou JOIN unidad_academica u USING (id_unidad)
           WHERE ou.id_oportunidad = o.id_oportunidad), '[]') AS unidades,
         COALESCE((SELECT json_agg(json_build_object('id_disciplina', d.id_disciplina, 'nombre', d.nombre) ORDER BY d.nombre)
           FROM oportunidad_disciplina od JOIN disciplina d USING (id_disciplina)
           WHERE od.id_oportunidad = o.id_oportunidad), '[]') AS disciplinas,
         COALESCE((SELECT json_agg(json_build_object(
                     'id_sede', h.id_sede, 'sede', s.nombre, 'dia_semana', h.dia_semana,
                     'hora_inicio', to_char(h.hora_inicio, 'HH24:MI'),
                     'hora_fin', to_char(h.hora_fin, 'HH24:MI'))
                   ORDER BY h.dia_semana, h.hora_inicio)
           FROM horario h JOIN sede s USING (id_sede)
           WHERE h.id_oportunidad = o.id_oportunidad), '[]') AS horarios
  FROM oportunidad o
  JOIN organizador org USING (id_organizador)`;

router.get('/oportunidades', async (req, res) => {
  const q = req.query;
  const params = [
    ['actividad', 'beca', 'convocatoria'].includes(q.tipo) ? q.tipo : null,
    entero(q.unidad),
    entero(q.disciplina),
    entero(q.dia),
    hora(q.desde),
    hora(q.hasta),
    q.q ? `%${String(q.q).slice(0, 100)}%` : null,
    ['vigente', 'proxima', 'cerrada'].includes(q.estado) ? q.estado : null,
  ];
  const { rows } = await pool.query(
    `${SELECT_BASE}
     WHERE o.activo
       AND ($1::text IS NULL OR o.tipo = $1)
       AND ($2::int IS NULL OR EXISTS (SELECT 1 FROM oportunidad_unidad x
             WHERE x.id_oportunidad = o.id_oportunidad AND x.id_unidad = $2))
       AND ($3::int IS NULL OR EXISTS (SELECT 1 FROM oportunidad_disciplina x
             WHERE x.id_oportunidad = o.id_oportunidad AND x.id_disciplina = $3))
       AND (($4::int IS NULL AND $5::time IS NULL AND $6::time IS NULL) OR EXISTS (
             SELECT 1 FROM horario x WHERE x.id_oportunidad = o.id_oportunidad
               AND ($4::int  IS NULL OR x.dia_semana = $4)
               AND ($5::time IS NULL OR x.hora_inicio >= $5)
               AND ($6::time IS NULL OR x.hora_fin <= $6)))
       AND ($7::text IS NULL OR o.titulo ILIKE $7 OR o.descripcion ILIKE $7)
       AND ($8::text IS NULL OR o.estado_vigencia = $8)
     ORDER BY o.destacada DESC, (o.estado_vigencia = 'cerrada'), o.fecha_actualizacion DESC, o.id_oportunidad`,
    params
  );
  res.json(rows);
});

const SUBTABLA = { actividad: 'actividad', beca: 'beca', convocatoria: 'convocatoria' };

router.get('/oportunidades/:id', async (req, res) => {
  const id = entero(req.params.id);
  if (!id) return res.status(404).json({ error: 'Oportunidad no encontrada.' });

  const { rows } = await pool.query(`${SELECT_BASE} WHERE o.activo AND o.id_oportunidad = $1`, [id]);
  if (!rows.length) return res.status(404).json({ error: 'Oportunidad no encontrada.' });
  const op = rows[0];

  const [detalle, requisitos, fuentes, contactos, guardada] = await Promise.all([
    pool.query(`SELECT * FROM ${SUBTABLA[op.tipo]} WHERE id_oportunidad = $1`, [id]),
    pool.query(
      'SELECT descripcion, obligatorio FROM requisito WHERE id_oportunidad = $1 ORDER BY obligatorio DESC, id_requisito',
      [id]
    ),
    pool.query(
      'SELECT nombre, url, tipo_fuente, fecha_consulta FROM fuente WHERE id_oportunidad = $1 ORDER BY id_fuente',
      [id]
    ),
    pool.query('SELECT tipo_contacto, valor FROM contacto WHERE id_organizador = $1 ORDER BY id_contacto', [
      op.id_organizador,
    ]),
    req.usuario
      ? pool.query('SELECT 1 FROM oportunidad_guardada WHERE id_usuario = $1 AND id_oportunidad = $2', [
          req.usuario.id,
          id,
        ])
      : { rows: [] },
  ]);

  const { id_oportunidad: _omitido, ...detalleTipo } = detalle.rows[0] || {};
  res.json({
    ...op,
    detalle: detalleTipo,
    requisitos: requisitos.rows,
    fuentes: fuentes.rows,
    contactos: contactos.rows,
    guardada: guardada.rows.length > 0,
  });
});

module.exports = router;
