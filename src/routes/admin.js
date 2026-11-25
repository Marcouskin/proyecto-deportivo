// Panel de administración: captura, edición, verificación y reportes.
const express = require('express');
const { pool, transaccion } = require('../db');
const { requiereAdmin } = require('../auth');

const router = express.Router();
router.use(requiereAdmin);

class Invalido extends Error {}

const texto = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};
const url = (v) => {
  const s = texto(v, 500);
  if (s && !/^https?:\/\//i.test(s)) throw new Invalido('Los enlaces deben empezar con http:// o https://');
  return s;
};
const numero = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const fecha = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
const ids = (v) => [...new Set((Array.isArray(v) ? v : []).map((x) => Number.parseInt(x, 10)).filter((x) => x > 0))];

function validar(b) {
  const op = {
    titulo: texto(b.titulo, 200),
    descripcion: texto(b.descripcion, 5000),
    tipo: b.tipo,
    estado_vigencia: b.estado_vigencia || 'vigente',
    url_oficial: url(b.url_oficial),
    destacada: Boolean(b.destacada),
    id_organizador: Number.parseInt(b.id_organizador, 10),
    unidades: ids(b.unidades),
    disciplinas: ids(b.disciplinas),
    horarios: Array.isArray(b.horarios) ? b.horarios : [],
    requisitos: (Array.isArray(b.requisitos) ? b.requisitos : []).filter((r) => texto(r.descripcion, 400)),
    fuentes: (Array.isArray(b.fuentes) ? b.fuentes : []).filter((f) => texto(f.nombre, 200)),
    detalle: b.detalle || {},
  };
  if (!op.titulo || !op.descripcion) throw new Invalido('Título y descripción son obligatorios.');
  if (!['actividad', 'beca', 'convocatoria'].includes(op.tipo)) throw new Invalido('Tipo no válido.');
  if (!['vigente', 'proxima', 'cerrada'].includes(op.estado_vigencia)) throw new Invalido('Estado no válido.');
  if (!op.id_organizador) throw new Invalido('Elige un organizador.');
  if (!op.unidades.length) throw new Invalido('Elige al menos una unidad académica.');
  for (const h of op.horarios) {
    if (!h.id_sede || !(h.dia_semana >= 1 && h.dia_semana <= 7) || !h.hora_inicio || !h.hora_fin) {
      throw new Invalido('Cada horario necesita sede, día, hora de inicio y hora de fin.');
    }
    if (h.hora_fin <= h.hora_inicio) throw new Invalido('La hora de fin debe ser posterior a la de inicio.');
  }
  return op;
}

// Reemplaza la fila de especialización y las filas hijas de una oportunidad.
async function guardarHijos(db, id, op) {
  for (const t of ['actividad', 'beca', 'convocatoria']) {
    await db.query(`DELETE FROM ${t} WHERE id_oportunidad = $1`, [id]);
  }
  const d = op.detalle;
  if (op.tipo === 'actividad') {
    await db.query('INSERT INTO actividad (id_oportunidad, nivel_deportivo, cupo, costo) VALUES ($1,$2,$3,$4)', [
      id, texto(d.nivel_deportivo, 60), numero(d.cupo), numero(d.costo),
    ]);
  } else if (op.tipo === 'beca') {
    await db.query('INSERT INTO beca (id_oportunidad, monto, beneficios, periodo) VALUES ($1,$2,$3,$4)', [
      id, numero(d.monto), texto(d.beneficios, 2000), texto(d.periodo, 80),
    ]);
  } else {
    if (fecha(d.fecha_apertura) && fecha(d.fecha_cierre) && d.fecha_cierre < d.fecha_apertura) {
      throw new Invalido('La fecha de cierre no puede ser anterior a la de apertura.');
    }
    await db.query(
      'INSERT INTO convocatoria (id_oportunidad, evento, fecha_apertura, fecha_cierre, url_inscripcion) VALUES ($1,$2,$3,$4,$5)',
      [id, texto(d.evento, 200), fecha(d.fecha_apertura), fecha(d.fecha_cierre), url(d.url_inscripcion)]
    );
  }

  for (const t of ['oportunidad_unidad', 'oportunidad_disciplina', 'horario', 'requisito', 'fuente']) {
    await db.query(`DELETE FROM ${t} WHERE id_oportunidad = $1`, [id]);
  }
  for (const u of op.unidades) {
    await db.query('INSERT INTO oportunidad_unidad (id_oportunidad, id_unidad) VALUES ($1,$2)', [id, u]);
  }
  for (const x of op.disciplinas) {
    await db.query('INSERT INTO oportunidad_disciplina (id_oportunidad, id_disciplina) VALUES ($1,$2)', [id, x]);
  }
  for (const h of op.horarios) {
    await db.query(
      'INSERT INTO horario (id_oportunidad, id_sede, dia_semana, hora_inicio, hora_fin) VALUES ($1,$2,$3,$4,$5)',
      [id, h.id_sede, h.dia_semana, h.hora_inicio, h.hora_fin]
    );
  }
  for (const r of op.requisitos) {
    await db.query('INSERT INTO requisito (id_oportunidad, descripcion, obligatorio) VALUES ($1,$2,$3)', [
      id, texto(r.descripcion, 400), r.obligatorio !== false,
    ]);
  }
  for (const f of op.fuentes) {
    await db.query(
      'INSERT INTO fuente (id_oportunidad, nombre, url, tipo_fuente, fecha_consulta) VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE))',
      [id, texto(f.nombre, 200), url(f.url), texto(f.tipo_fuente, 40) || 'portal', fecha(f.fecha_consulta)]
    );
  }
}

function historial(db, idUsuario, id, accion, detalle) {
  return db.query(
    `INSERT INTO historial_cambio (id_usuario, tabla_afectada, id_registro, accion, detalle)
     VALUES ($1, 'oportunidad', $2, $3, $4)`,
    [idUsuario, id, accion, detalle]
  );
}

// Convierte errores de validación y de integridad en respuestas 400.
function manejar(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof Invalido) return res.status(400).json({ error: e.message });
      if (e.code === '23503') return res.status(400).json({ error: 'Alguna referencia (sede, unidad, disciplina u organizador) no existe.' });
      if (e.code === '23514' || e.code === '22007' || e.code === '22P02') {
        return res.status(400).json({ error: 'Hay valores fuera de rango o con formato incorrecto.' });
      }
      throw e;
    }
  };
}

router.get('/oportunidades', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT o.id_oportunidad, o.titulo, o.tipo, o.estado_vigencia, o.destacada, o.fecha_actualizacion,
            (SELECT count(*)::int FROM reporte r WHERE r.id_oportunidad = o.id_oportunidad AND r.estado = 'pendiente') AS reportes_pendientes,
            (SELECT max(fecha) FROM verificacion v WHERE v.id_oportunidad = o.id_oportunidad) AS ultima_verificacion
     FROM oportunidad o WHERE o.activo ORDER BY o.fecha_actualizacion DESC`
  );
  res.json(rows);
});

router.post('/oportunidades', manejar(async (req, res) => {
  const op = validar(req.body);
  const id = await transaccion(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO oportunidad (id_organizador, titulo, descripcion, tipo, estado_vigencia, url_oficial, destacada)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id_oportunidad`,
      [op.id_organizador, op.titulo, op.descripcion, op.tipo, op.estado_vigencia, op.url_oficial, op.destacada]
    );
    await guardarHijos(db, rows[0].id_oportunidad, op);
    await historial(db, req.usuario.id, rows[0].id_oportunidad, 'crear', op.titulo);
    return rows[0].id_oportunidad;
  });
  res.status(201).json({ id_oportunidad: id });
}));

router.put('/oportunidades/:id', manejar(async (req, res) => {
  const id = Number.parseInt(req.params.id, 10) || 0;
  const op = validar(req.body);
  const existe = await transaccion(async (db) => {
    const r = await db.query(
      `UPDATE oportunidad SET id_organizador=$1, titulo=$2, descripcion=$3, tipo=$4, estado_vigencia=$5,
              url_oficial=$6, destacada=$7, fecha_actualizacion=now()
       WHERE id_oportunidad=$8 AND activo`,
      [op.id_organizador, op.titulo, op.descripcion, op.tipo, op.estado_vigencia, op.url_oficial, op.destacada, id]
    );
    if (!r.rowCount) return false;
    await guardarHijos(db, id, op);
    await historial(db, req.usuario.id, id, 'actualizar', op.titulo);
    // Avisa a quienes la tienen guardada.
    await db.query(
      `INSERT INTO notificacion (id_usuario, id_oportunidad, mensaje)
       SELECT id_usuario, $1, $2 FROM oportunidad_guardada WHERE id_oportunidad = $1`,
      [id, `Se actualizó "${op.titulo}".`.slice(0, 400)]
    );
    return true;
  });
  if (!existe) return res.status(404).json({ error: 'Oportunidad no encontrada.' });
  res.json({ id_oportunidad: id });
}));

// Baja lógica: la oportunidad deja de mostrarse pero se conserva.
router.delete('/oportunidades/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10) || 0;
  const existe = await transaccion(async (db) => {
    const r = await db.query('UPDATE oportunidad SET activo = FALSE WHERE id_oportunidad = $1 AND activo RETURNING titulo', [id]);
    if (!r.rowCount) return false;
    await historial(db, req.usuario.id, id, 'eliminar', r.rows[0].titulo);
    return true;
  });
  if (!existe) return res.status(404).json({ error: 'Oportunidad no encontrada.' });
  res.status(204).end();
});

router.post('/oportunidades/:id/verificaciones', manejar(async (req, res) => {
  const id = Number.parseInt(req.params.id, 10) || 0;
  const resultado = req.body.resultado;
  if (!['vigente', 'desactualizada', 'no_encontrada'].includes(resultado)) throw new Invalido('Resultado no válido.');
  await transaccion(async (db) => {
    await db.query(
      'INSERT INTO verificacion (id_usuario, id_oportunidad, resultado, observaciones) VALUES ($1,$2,$3,$4)',
      [req.usuario.id, id, resultado, texto(req.body.observaciones, 1000)]
    );
    await historial(db, req.usuario.id, id, 'verificar', resultado);
  });
  res.status(201).json({ ok: true });
}));

router.get('/reportes', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id_reporte, r.motivo, r.descripcion, r.fecha, r.estado,
            o.id_oportunidad, o.titulo, u.nombre AS usuario
     FROM reporte r JOIN oportunidad o USING (id_oportunidad) JOIN usuario u USING (id_usuario)
     ORDER BY (r.estado = 'pendiente') DESC, r.fecha DESC LIMIT 200`
  );
  res.json(rows);
});

router.patch('/reportes/:id', async (req, res) => {
  if (!['pendiente', 'atendido', 'descartado'].includes(req.body.estado)) {
    return res.status(400).json({ error: 'Estado no válido.' });
  }
  const r = await pool.query('UPDATE reporte SET estado = $1 WHERE id_reporte = $2', [
    req.body.estado,
    Number.parseInt(req.params.id, 10) || 0,
  ]);
  if (!r.rowCount) return res.status(404).json({ error: 'Reporte no encontrado.' });
  res.status(204).end();
});

router.get('/historial', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT h.id_cambio, h.tabla_afectada, h.id_registro, h.accion, h.detalle, h.fecha, u.nombre AS usuario
     FROM historial_cambio h JOIN usuario u USING (id_usuario) ORDER BY h.fecha DESC LIMIT 100`
  );
  res.json(rows);
});

module.exports = router;
