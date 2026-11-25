const { Pool, types } = require('pg');

// DATE y TIME como texto ('2026-11-01', '13:00:00'); NUMERIC como número.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://deportes:deportes@localhost:5432/deportes_ipn',
});

// Ejecuta fn dentro de una transacción.
async function transaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

module.exports = { pool, transaccion };
