// Crea el esquema, carga los datos de ejemplo y registra al administrador.
// ATENCIÓN: borra todas las tablas existentes.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

async function main() {
  const leer = (f) => fs.readFileSync(path.join(__dirname, '..', 'db', f), 'utf8');
  await pool.query(leer('schema.sql'));
  await pool.query(leer('seed.sql'));

  const correo = (process.env.ADMIN_CORREO || 'admin@ejemplo.mx').toLowerCase();
  const clave = process.env.ADMIN_PASSWORD || 'admin1234';
  const hash = await bcrypt.hash(clave, 10);
  const { rows } = await pool.query(
    `INSERT INTO usuario (nombre, correo, contrasena_hash) VALUES ('Administrador', $1, $2) RETURNING id_usuario`,
    [correo, hash]
  );
  await pool.query(
    `INSERT INTO usuario_rol (id_usuario, id_rol) SELECT $1, id_rol FROM rol`,
    [rows[0].id_usuario]
  );
  console.log(`Base de datos lista. Administrador: ${correo}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('Contraseña por defecto "admin1234": define ADMIN_PASSWORD en .env para cambiarla.');
  }
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => pool.end());
