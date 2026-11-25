const crypto = require('crypto');
const jwt = require('jsonwebtoken');

let SECRETO = process.env.JWT_SECRET;
if (!SECRETO) {
  SECRETO = crypto.randomBytes(32).toString('hex');
  console.warn('JWT_SECRET no definido: las sesiones se cerrarán al reiniciar el servidor.');
}

const COOKIE = 'sesion';
const DURACION_MS = 7 * 24 * 60 * 60 * 1000;

function iniciarSesion(res, usuario) {
  const token = jwt.sign(
    { id: usuario.id_usuario, nombre: usuario.nombre, roles: usuario.roles },
    SECRETO,
    { expiresIn: '7d' }
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURACION_MS,
  });
}

function cerrarSesion(res) {
  res.clearCookie(COOKIE);
}

// Adjunta req.usuario si hay una sesión válida; nunca rechaza.
function sesionOpcional(req, _res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (token) {
    try {
      req.usuario = jwt.verify(token, SECRETO);
    } catch {
      /* token inválido o vencido: se trata como visitante */
    }
  }
  next();
}

function requiereSesion(req, res, next) {
  if (!req.usuario) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  next();
}

function requiereAdmin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  if (!req.usuario.roles.includes('administrador')) {
    return res.status(403).json({ error: 'Se requiere el rol de administrador.' });
  }
  next();
}

module.exports = { iniciarSesion, cerrarSesion, sesionOpcional, requiereSesion, requiereAdmin };
