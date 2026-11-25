// Aplicación de una sola página con rutas por hash (#/…), sin dependencias.
'use strict';

const vista = document.getElementById('vista');
const nav = document.getElementById('nav');
const estado = { usuario: null, catalogos: null, sinLeer: 0 };

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TIPOS = { actividad: 'Actividad', beca: 'Beca', convocatoria: 'Convocatoria' };
const ESTADOS = { vigente: ['Vigente', 'ok'], proxima: ['Próxima', 'alerta'], cerrada: ['Cerrada', 'neutra'] };
const MOTIVOS = {
  informacion_incorrecta: 'Información incorrecta',
  desactualizada: 'Está desactualizada',
  enlace_roto: 'El enlace no funciona',
  otro: 'Otro',
};

// ---------- Utilidades ----------

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const urlSegura = (u) => (/^https?:\/\//i.test(u || '') ? esc(u) : '');
const fecha = (v) =>
  v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const esAdmin = () => Boolean(estado.usuario && estado.usuario.roles.includes('administrador'));
const opciones = (lista, id, nombre, elegido) =>
  lista.map((x) => `<option value="${x[id]}" ${String(x[id]) === String(elegido) ? 'selected' : ''}>${esc(x[nombre])}</option>`).join('');

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (r.status === 204) return null;
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error((datos && datos.error) || 'No se pudo completar la operación.');
  return datos;
}

let temporizador;
function aviso(texto) {
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => (el.hidden = true), 3500);
}

function etiquetasDe(o) {
  const [texto, clase] = ESTADOS[o.estado_vigencia];
  return `<div class="etiquetas">
    <span class="etiqueta">${TIPOS[o.tipo]}</span>
    <span class="etiqueta ${clase}">${texto}</span>
    ${o.destacada ? '<span class="etiqueta alerta">Destacada</span>' : ''}
  </div>`;
}

function resumenHorarios(horarios) {
  if (!horarios.length) return '';
  const porFranja = {};
  for (const h of horarios) (porFranja[`${h.hora_inicio}–${h.hora_fin}`] ||= []).push(DIAS[h.dia_semana].slice(0, 3));
  return Object.entries(porFranja).map(([f, d]) => `${d.join(', ')} ${f}`).join(' · ');
}

// ---------- Navegación ----------

function pintarNav() {
  const u = estado.usuario;
  nav.innerHTML = `
    <a href="#/">Explorar</a>
    ${u ? `<a href="#/cuenta">Mi cuenta${estado.sinLeer ? `<span class="insignia">${estado.sinLeer}</span>` : ''}</a>` : ''}
    ${esAdmin() ? '<a href="#/admin">Administración</a>' : ''}
    ${u ? '<button type="button" data-accion="salir">Salir</button>' : '<a href="#/entrar">Entrar</a>'}`;
}

async function cargarSesion() {
  estado.usuario = await api('/auth/yo');
  estado.sinLeer = 0;
  if (estado.usuario) {
    const n = await api('/notificaciones');
    estado.sinLeer = n.filter((x) => !x.leida).length;
  }
  pintarNav();
}

const rutas = [
  [/^\/?$/, vistaCatalogo],
  [/^\/oportunidad\/(\d+)$/, vistaDetalle],
  [/^\/entrar$/, vistaEntrar],
  [/^\/cuenta$/, vistaCuenta],
  [/^\/admin$/, vistaAdmin],
  [/^\/admin\/nueva$/, () => vistaFormulario(null)],
  [/^\/admin\/editar\/(\d+)$/, vistaFormulario],
];

async function enrutar() {
  const ruta = location.hash.replace(/^#/, '') || '/';
  const [camino] = ruta.split('?');
  for (const [patron, fn] of rutas) {
    const m = camino.match(patron);
    if (m) {
      try {
        await fn(m[1]);
      } catch (e) {
        vista.innerHTML = `<div class="vacio"><p>${esc(e.message)}</p><a class="boton secundario" href="#/">Volver al inicio</a></div>`;
      }
      window.scrollTo(0, 0);
      return;
    }
  }
  vista.innerHTML = '<div class="vacio"><p>Página no encontrada.</p><a class="boton secundario" href="#/">Volver al inicio</a></div>';
}

// ---------- Catálogo ----------

const filtros = { q: '', tipo: '', unidad: '', disciplina: '', dia: '', desde: '', hasta: '', estado: '' };

async function vistaCatalogo() {
  const c = estado.catalogos;
  vista.innerHTML = `
    <h1>Oportunidades deportivas en Zacatenco</h1>
    <p class="tenue">Actividades, becas y convocatorias del IPN en un solo lugar. Filtra por tu escuela, disciplina y horario.</p>
    <form class="filtros" id="filtros">
      <div class="fichas" role="group" aria-label="Tipo de oportunidad">
        ${[['', 'Todas'], ['actividad', 'Actividades'], ['beca', 'Becas'], ['convocatoria', 'Convocatorias']]
          .map(([v, t]) => `<button type="button" class="ficha" data-tipo="${v}" aria-pressed="${filtros.tipo === v}">${t}</button>`).join('')}
      </div>
      <div class="campos">
        <div><label for="f-q">Buscar</label><input id="f-q" name="q" type="search" placeholder="Ej. básquetbol" value="${esc(filtros.q)}"></div>
        <div><label for="f-unidad">Unidad académica</label>
          <select id="f-unidad" name="unidad"><option value="">Todas</option>${opciones(c.unidades, 'id_unidad', 'siglas', filtros.unidad)}</select></div>
        <div><label for="f-disciplina">Disciplina</label>
          <select id="f-disciplina" name="disciplina"><option value="">Todas</option>${opciones(c.disciplinas, 'id_disciplina', 'nombre', filtros.disciplina)}</select></div>
        <div><label for="f-dia">Día</label>
          <select id="f-dia" name="dia"><option value="">Cualquiera</option>
            ${DIAS.slice(1).map((d, i) => `<option value="${i + 1}" ${String(filtros.dia) === String(i + 1) ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        <div><label for="f-desde">Estoy libre desde</label><input id="f-desde" name="desde" type="time" value="${esc(filtros.desde)}"></div>
        <div><label for="f-hasta">Hasta</label><input id="f-hasta" name="hasta" type="time" value="${esc(filtros.hasta)}"></div>
        <div><label for="f-estado">Vigencia</label>
          <select id="f-estado" name="estado"><option value="">Todas</option>
            ${Object.entries(ESTADOS).map(([v, [t]]) => `<option value="${v}" ${filtros.estado === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      </div>
      <div class="fila" style="margin-top:14px"><button type="button" class="boton secundario chico" data-accion="limpiar">Limpiar filtros</button>
        <span id="conteo" class="tenue pequeno" aria-live="polite"></span></div>
    </form>
    <div id="resultados" class="rejilla"></div>`;

  const form = document.getElementById('filtros');
  let espera;
  form.addEventListener('input', () => {
    Object.assign(filtros, Object.fromEntries(new FormData(form)));
    clearTimeout(espera);
    espera = setTimeout(buscar, 250);
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('click', (e) => {
    const ficha = e.target.closest('[data-tipo]');
    if (ficha) {
      filtros.tipo = ficha.dataset.tipo;
      form.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-pressed', b === ficha));
      buscar();
    } else if (e.target.closest('[data-accion=limpiar]')) {
      for (const k of Object.keys(filtros)) filtros[k] = '';
      vistaCatalogo();
    }
  });
  await buscar();
}

async function buscar() {
  const caja = document.getElementById('resultados');
  if (!caja) return;
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
  const lista = await api(`/oportunidades?${params}`);
  if (!document.body.contains(caja)) return;
  document.getElementById('conteo').textContent = `${lista.length} resultado${lista.length === 1 ? '' : 's'}`;
  caja.innerHTML = lista.length
    ? lista.map((o) => `
      <a class="tarjeta" href="#/oportunidad/${o.id_oportunidad}">
        ${etiquetasDe(o)}
        <h3>${esc(o.titulo)}</h3>
        <span class="tenue pequeno">${esc(o.organizador)}</span>
        ${o.horarios.length ? `<span class="pequeno">${esc(resumenHorarios(o.horarios))}</span>` : ''}
        <div class="etiquetas">
          ${o.disciplinas.map((d) => `<span class="etiqueta neutra">${esc(d.nombre)}</span>`).join('')}
          ${o.unidades.length > 3
            ? `<span class="etiqueta neutra">${o.unidades.length} unidades</span>`
            : o.unidades.map((u) => `<span class="etiqueta neutra">${esc(u.siglas)}</span>`).join('')}
        </div>
        <span class="tenue pequeno">Actualizada el ${fecha(o.fecha_actualizacion)}</span>
      </a>`).join('')
    : '<div class="vacio" style="grid-column:1/-1">No hay oportunidades con esos filtros. Prueba quitando alguno.</div>';
}

// ---------- Detalle ----------

function detalleTipo(o) {
  const d = o.detalle;
  const dato = (t, v) => (v === null || v === undefined || v === '' ? '' : `<div><dt>${t}</dt><dd>${v}</dd></div>`);
  const dinero = (n) => (n === null ? null : n === 0 ? 'Gratuito' : `$${n.toLocaleString('es-MX')}`);
  if (o.tipo === 'actividad') {
    return dato('Nivel', esc(d.nivel_deportivo)) + dato('Cupo', d.cupo === null ? null : `${d.cupo} lugares`) + dato('Costo', dinero(d.costo));
  }
  if (o.tipo === 'beca') {
    return dato('Monto', d.monto === null ? null : dinero(d.monto)) + dato('Periodo', esc(d.periodo)) + dato('Beneficios', esc(d.beneficios));
  }
  const ins = urlSegura(d.url_inscripcion);
  return dato('Evento', esc(d.evento)) + dato('Apertura', d.fecha_apertura && fecha(d.fecha_apertura)) +
    dato('Cierre', d.fecha_cierre && fecha(d.fecha_cierre)) +
    (ins ? dato('Inscripción', `<a href="${ins}" target="_blank" rel="noopener">Ir al registro</a>`) : '');
}

async function vistaDetalle(id) {
  const o = await api(`/oportunidades/${id}`);
  const oficial = urlSegura(o.url_oficial);
  const contacto = (c) => {
    if (c.tipo_contacto === 'correo') return `<a href="mailto:${esc(c.valor)}">${esc(c.valor)}</a>`;
    const u = urlSegura(c.valor);
    return u ? `<a href="${u}" target="_blank" rel="noopener">${u}</a>` : esc(c.valor);
  };
  vista.innerHTML = `
    <p><a href="#/">← Volver a explorar</a></p>
    ${etiquetasDe(o)}
    <h1 style="margin-top:8px">${esc(o.titulo)}</h1>
    <p class="tenue">${esc(o.organizador)} · Actualizada el ${fecha(o.fecha_actualizacion)}
      ${o.ultima_verificacion ? ` · <span class="etiqueta ok">Verificada el ${fecha(o.ultima_verificacion)}</span>` : ' · <span class="etiqueta neutra">Sin verificar</span>'}</p>
    <div class="fila" style="margin:16px 0">
      ${oficial ? `<a class="boton" href="${oficial}" target="_blank" rel="noopener">Ver fuente oficial</a>` : ''}
      <button class="boton secundario" data-accion="guardar" data-id="${o.id_oportunidad}" data-guardada="${o.guardada}">${o.guardada ? 'Quitar de guardadas' : 'Guardar'}</button>
      ${esAdmin() ? `<a class="boton secundario" href="#/admin/editar/${o.id_oportunidad}">Editar</a>` : ''}
    </div>
    <div class="panel">
      <p>${esc(o.descripcion)}</p>
      <dl class="datos">${detalleTipo(o)}</dl>

      ${o.horarios.length ? `<h2>Horarios</h2><div class="tabla-caja"><table>
        <thead><tr><th>Día</th><th>Horario</th><th>Sede</th></tr></thead>
        <tbody>${o.horarios.map((h) => `<tr><td>${DIAS[h.dia_semana]}</td><td>${h.hora_inicio}–${h.hora_fin}</td><td>${esc(h.sede)}</td></tr>`).join('')}</tbody>
      </table></div>` : ''}

      ${o.requisitos.length ? `<h2>Requisitos</h2><ul class="lista">
        ${o.requisitos.map((r) => `<li>${esc(r.descripcion)}${r.obligatorio ? '' : ' <span class="tenue">(opcional)</span>'}</li>`).join('')}</ul>` : ''}

      <h2>Aplica en</h2>
      <div class="etiquetas">${o.unidades.map((u) => `<span class="etiqueta neutra">${esc(u.siglas)}</span>`).join('')}</div>

      ${o.contactos.length ? `<h2>Contacto</h2><ul class="lista">${o.contactos.map((c) => `<li>${contacto(c)}</li>`).join('')}</ul>` : ''}

      ${o.fuentes.length ? `<h2>Fuentes</h2><ul class="lista">${o.fuentes.map((f) => {
        const u = urlSegura(f.url);
        return `<li>${u ? `<a href="${u}" target="_blank" rel="noopener">${esc(f.nombre)}</a>` : esc(f.nombre)}
          <span class="tenue">· consultada el ${fecha(f.fecha_consulta)}</span></li>`;
      }).join('')}</ul>` : ''}
    </div>

    <h2>¿Algo no coincide?</h2>
    ${estado.usuario ? `
      <form class="panel" id="reporte">
        <div class="campos">
          <div><label for="r-motivo">Motivo</label><select id="r-motivo" name="motivo" required>
            ${Object.entries(MOTIVOS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div>
          <div class="campo-ancho"><label for="r-desc">Cuéntanos qué viste (opcional)</label><textarea id="r-desc" name="descripcion" maxlength="1000"></textarea></div>
        </div>
        <button class="boton secundario" style="margin-top:12px">Enviar reporte</button>
      </form>` : '<p class="tenue"><a href="#/entrar">Inicia sesión</a> para reportar información incorrecta o desactualizada.</p>'}`;

  const form = document.getElementById('reporte');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api(`/oportunidades/${id}/reportes`, { metodo: 'POST', cuerpo: Object.fromEntries(new FormData(form)) });
        form.reset();
        aviso('Reporte enviado. ¡Gracias!');
      } catch (err) {
        aviso(err.message);
      }
    });
  }
}

// ---------- Entrar / registro ----------

function vistaEntrar() {
  if (estado.usuario) return void (location.hash = '#/cuenta');
  const c = estado.catalogos;
  vista.innerHTML = `
    <div class="estrecho">
      <form class="panel" id="login">
        <h1>Entrar</h1>
        <div id="login-error"></div>
        <p><label for="l-correo">Correo</label><input id="l-correo" name="correo" type="email" autocomplete="email" required></p>
        <p><label for="l-clave">Contraseña</label><input id="l-clave" name="contrasena" type="password" autocomplete="current-password" required></p>
        <button class="boton">Entrar</button>
      </form>
      <form class="panel" id="registro" style="margin-top:20px">
        <h2 style="margin-top:0">¿No tienes cuenta? Regístrate</h2>
        <div id="registro-error"></div>
        <p><label for="g-nombre">Nombre</label><input id="g-nombre" name="nombre" autocomplete="name" required maxlength="150"></p>
        <p><label for="g-correo">Correo</label><input id="g-correo" name="correo" type="email" autocomplete="email" required></p>
        <p><label for="g-unidad">Unidad académica</label>
          <select id="g-unidad" name="id_unidad"><option value="">Prefiero no decir</option>${opciones(c.unidades, 'id_unidad', 'siglas')}</select></p>
        <p><label for="g-clave">Contraseña (mínimo 8 caracteres)</label><input id="g-clave" name="contrasena" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></p>
        <button class="boton secundario">Crear cuenta</button>
      </form>
    </div>`;
  for (const [idForm, ruta] of [['login', '/auth/login'], ['registro', '/auth/registro']]) {
    const form = document.getElementById(idForm);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api(ruta, { metodo: 'POST', cuerpo: Object.fromEntries(new FormData(form)) });
        await cargarSesion();
        location.hash = '#/';
      } catch (err) {
        document.getElementById(`${idForm}-error`).innerHTML = `<div class="mensaje-error" role="alert">${esc(err.message)}</div>`;
      }
    });
  }
}

// ---------- Mi cuenta ----------

async function vistaCuenta() {
  if (!estado.usuario) return void (location.hash = '#/entrar');
  const [guardadas, notificaciones] = await Promise.all([api('/guardadas'), api('/notificaciones')]);
  vista.innerHTML = `
    <h1>Hola, ${esc(estado.usuario.nombre)}</h1>
    <h2>Oportunidades guardadas</h2>
    ${guardadas.length ? `<div class="rejilla">${guardadas.map((o) => `
      <a class="tarjeta" href="#/oportunidad/${o.id_oportunidad}">${etiquetasDe(o)}<h3>${esc(o.titulo)}</h3>
        <span class="tenue pequeno">Guardada el ${fecha(o.fecha_guardado)}</span></a>`).join('')}</div>`
      : '<p class="tenue">Aún no guardas ninguna. Usa el botón «Guardar» en cualquier oportunidad.</p>'}
    <h2>Notificaciones</h2>
    ${notificaciones.length ? `<div class="panel"><ul class="lista">${notificaciones.map((n) => `
      <li><a href="#/oportunidad/${n.id_oportunidad}">${esc(n.mensaje)}</a> <span class="tenue">· ${fecha(n.fecha_envio)}</span>
        ${n.leida ? '' : '<span class="etiqueta">Nueva</span>'}</li>`).join('')}</ul></div>`
      : '<p class="tenue">Te avisaremos cuando cambie una oportunidad que tengas guardada.</p>'}`;
  if (estado.sinLeer) {
    await api('/notificaciones/leidas', { metodo: 'POST' });
    estado.sinLeer = 0;
    pintarNav();
  }
}

// ---------- Administración ----------

async function vistaAdmin() {
  if (!esAdmin()) return void (location.hash = '#/entrar');
  const [ops, reportes, historial] = await Promise.all([
    api('/admin/oportunidades'), api('/admin/reportes'), api('/admin/historial'),
  ]);
  vista.innerHTML = `
    <div class="fila" style="justify-content:space-between"><h1>Administración</h1><a class="boton" href="#/admin/nueva">Nueva oportunidad</a></div>

    <h2>Oportunidades</h2>
    <div class="panel tabla-caja"><table>
      <thead><tr><th>Título</th><th>Tipo</th><th>Vigencia</th><th>Última verificación</th><th>Reportes</th><th></th></tr></thead>
      <tbody>${ops.map((o) => `<tr>
        <td><a href="#/oportunidad/${o.id_oportunidad}">${esc(o.titulo)}</a></td>
        <td>${TIPOS[o.tipo]}</td><td>${ESTADOS[o.estado_vigencia][0]}</td>
        <td>${fecha(o.ultima_verificacion)}</td>
        <td>${o.reportes_pendientes ? `<span class="etiqueta error">${o.reportes_pendientes} pendiente${o.reportes_pendientes > 1 ? 's' : ''}</span>` : '—'}</td>
        <td><div class="fila">
          <a class="boton secundario chico" href="#/admin/editar/${o.id_oportunidad}">Editar</a>
          <button class="boton secundario chico" data-accion="verificar" data-id="${o.id_oportunidad}">Marcar verificada</button>
          <button class="boton secundario chico" data-accion="eliminar" data-id="${o.id_oportunidad}" data-titulo="${esc(o.titulo)}">Eliminar</button>
        </div></td></tr>`).join('')}</tbody>
    </table></div>

    <h2>Reportes de estudiantes</h2>
    ${reportes.length ? `<div class="panel tabla-caja"><table>
      <thead><tr><th>Oportunidad</th><th>Motivo</th><th>Detalle</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
      <tbody>${reportes.map((r) => `<tr>
        <td><a href="#/oportunidad/${r.id_oportunidad}">${esc(r.titulo)}</a><br><span class="tenue pequeno">${esc(r.usuario)}</span></td>
        <td>${MOTIVOS[r.motivo]}</td><td>${esc(r.descripcion) || '—'}</td><td>${fecha(r.fecha)}</td>
        <td><span class="etiqueta ${r.estado === 'pendiente' ? 'error' : 'neutra'}">${r.estado}</span></td>
        <td>${r.estado === 'pendiente' ? `<div class="fila">
          <button class="boton secundario chico" data-accion="reporte" data-id="${r.id_reporte}" data-estado="atendido">Atendido</button>
          <button class="boton secundario chico" data-accion="reporte" data-id="${r.id_reporte}" data-estado="descartado">Descartar</button></div>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="tenue">No hay reportes.</p>'}

    <h2>Historial de cambios</h2>
    ${historial.length ? `<div class="panel tabla-caja"><table>
      <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Registro</th><th>Detalle</th></tr></thead>
      <tbody>${historial.map((h) => `<tr><td>${fecha(h.fecha)}</td><td>${esc(h.usuario)}</td><td>${esc(h.accion)}</td>
        <td>${esc(h.tabla_afectada)} #${h.id_registro}</td><td>${esc(h.detalle)}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="tenue">Sin cambios registrados.</p>'}`;
}

// Formulario de alta y edición de oportunidades.
async function vistaFormulario(id) {
  if (!esAdmin()) return void (location.hash = '#/entrar');
  const c = estado.catalogos;
  const o = id ? await api(`/oportunidades/${id}`) : {
    titulo: '', descripcion: '', tipo: 'actividad', estado_vigencia: 'vigente', url_oficial: '', destacada: false,
    id_organizador: '', unidades: [], disciplinas: [], horarios: [], requisitos: [], fuentes: [], detalle: {},
  };
  const d = o.detalle;
  const v = (x) => esc(x ?? '');
  const marcada = (lista, clave, valor) => (lista.some((x) => x[clave] === valor) ? 'checked' : '');

  const renglonHorario = (h = {}) => `<div class="renglon" data-renglon="horario">
    <select aria-label="Sede" data-c="id_sede">${c.sedes.map((s) => `<option value="${s.id_sede}" ${s.id_sede === h.id_sede ? 'selected' : ''}>${esc(s.siglas)} · ${esc(s.nombre)}</option>`).join('')}</select>
    <select aria-label="Día" data-c="dia_semana">${DIAS.slice(1).map((n, i) => `<option value="${i + 1}" ${h.dia_semana === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <input aria-label="Hora de inicio" type="time" data-c="hora_inicio" value="${v(h.hora_inicio)}" required>
    <input aria-label="Hora de fin" type="time" data-c="hora_fin" value="${v(h.hora_fin)}" required>
    <button type="button" class="boton secundario chico" data-accion="quitar">Quitar</button></div>`;
  const renglonRequisito = (r = {}) => `<div class="renglon dos" data-renglon="requisito">
    <input aria-label="Requisito" data-c="descripcion" value="${v(r.descripcion)}" maxlength="400" required>
    <label style="margin:0;font-weight:400"><input type="checkbox" data-c="obligatorio" ${r.obligatorio === false ? '' : 'checked'}> Obligatorio</label>
    <button type="button" class="boton secundario chico" data-accion="quitar">Quitar</button></div>`;
  const renglonFuente = (f = {}) => `<div class="renglon tres" data-renglon="fuente">
    <input aria-label="Nombre de la fuente" data-c="nombre" placeholder="Nombre" value="${v(f.nombre)}" maxlength="200" required>
    <input aria-label="Enlace de la fuente" data-c="url" type="url" placeholder="https://…" value="${v(f.url)}">
    <button type="button" class="boton secundario chico" data-accion="quitar">Quitar</button></div>`;
  const plantillas = { horario: renglonHorario, requisito: renglonRequisito, fuente: renglonFuente };

  vista.innerHTML = `
    <p><a href="#/admin">← Volver a administración</a></p>
    <h1>${id ? 'Editar oportunidad' : 'Nueva oportunidad'}</h1>
    <form class="panel" id="form-op">
      <div id="form-error"></div>
      <div class="campos">
        <div class="campo-ancho"><label for="o-titulo">Título</label><input id="o-titulo" name="titulo" value="${v(o.titulo)}" maxlength="200" required></div>
        <div class="campo-ancho"><label for="o-desc">Descripción</label><textarea id="o-desc" name="descripcion" required>${v(o.descripcion)}</textarea></div>
        <div><label for="o-tipo">Tipo</label><select id="o-tipo" name="tipo">
          ${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${o.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div><label for="o-estado">Vigencia</label><select id="o-estado" name="estado_vigencia">
          ${Object.entries(ESTADOS).map(([k, [t]]) => `<option value="${k}" ${o.estado_vigencia === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div><label for="o-org">Organizador</label><select id="o-org" name="id_organizador" required>
          <option value="">Elige…</option>${opciones(c.organizadores, 'id_organizador', 'nombre', o.id_organizador)}</select></div>
        <div class="campo-ancho"><label for="o-url">Enlace oficial</label><input id="o-url" name="url_oficial" type="url" placeholder="https://…" value="${v(o.url_oficial)}"></div>
        <div class="campo-ancho"><label style="font-weight:400"><input type="checkbox" name="destacada" ${o.destacada ? 'checked' : ''}> Mostrar como destacada</label></div>
      </div>

      <h2>Datos según el tipo</h2>
      <div class="campos" data-tipo-campos="actividad">
        <div><label for="d-nivel">Nivel deportivo</label><input id="d-nivel" data-d="nivel_deportivo" value="${v(d.nivel_deportivo)}" maxlength="60"></div>
        <div><label for="d-cupo">Cupo</label><input id="d-cupo" data-d="cupo" type="number" min="0" value="${v(d.cupo)}"></div>
        <div><label for="d-costo">Costo (0 = gratuito)</label><input id="d-costo" data-d="costo" type="number" min="0" step="0.01" value="${v(d.costo)}"></div>
      </div>
      <div class="campos" data-tipo-campos="beca">
        <div><label for="d-monto">Monto</label><input id="d-monto" data-d="monto" type="number" min="0" step="0.01" value="${v(d.monto)}"></div>
        <div><label for="d-periodo">Periodo</label><input id="d-periodo" data-d="periodo" value="${v(d.periodo)}" maxlength="80"></div>
        <div class="campo-ancho"><label for="d-benef">Beneficios</label><textarea id="d-benef" data-d="beneficios">${v(d.beneficios)}</textarea></div>
      </div>
      <div class="campos" data-tipo-campos="convocatoria">
        <div><label for="d-evento">Evento</label><input id="d-evento" data-d="evento" value="${v(d.evento)}" maxlength="200"></div>
        <div><label for="d-ap">Fecha de apertura</label><input id="d-ap" data-d="fecha_apertura" type="date" value="${v(d.fecha_apertura)}"></div>
        <div><label for="d-ci">Fecha de cierre</label><input id="d-ci" data-d="fecha_cierre" type="date" value="${v(d.fecha_cierre)}"></div>
        <div class="campo-ancho"><label for="d-ins">Enlace de inscripción</label><input id="d-ins" data-d="url_inscripcion" type="url" placeholder="https://…" value="${v(d.url_inscripcion)}"></div>
      </div>

      <h2>Unidades académicas donde aplica</h2>
      <div class="opciones">${c.unidades.map((u) => `<label><input type="checkbox" name="unidades" value="${u.id_unidad}" ${marcada(o.unidades, 'id_unidad', u.id_unidad)}> ${esc(u.siglas)}</label>`).join('')}</div>

      <h2>Disciplinas</h2>
      <div class="opciones">${c.disciplinas.map((x) => `<label><input type="checkbox" name="disciplinas" value="${x.id_disciplina}" ${marcada(o.disciplinas, 'id_disciplina', x.id_disciplina)}> ${esc(x.nombre)}</label>`).join('')}</div>

      ${['horario', 'requisito', 'fuente'].map((t) => `
        <h2>${{ horario: 'Horarios', requisito: 'Requisitos', fuente: 'Fuentes' }[t]}</h2>
        <div data-lista="${t}">${o[`${t}s`].map(plantillas[t]).join('')}</div>
        <button type="button" class="boton secundario chico" data-accion="agregar" data-que="${t}">Agregar ${t}</button>`).join('')}

      <div class="fila" style="margin-top:28px"><button class="boton">Guardar</button><a class="boton secundario" href="#/admin">Cancelar</a></div>
    </form>`;

  const form = document.getElementById('form-op');
  const mostrarTipo = () => form.querySelectorAll('[data-tipo-campos]').forEach((el) => (el.hidden = el.dataset.tipoCampos !== form.tipo.value));
  form.tipo.addEventListener('change', mostrarTipo);
  mostrarTipo();

  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    if (b.dataset.accion === 'agregar') {
      form.querySelector(`[data-lista=${b.dataset.que}]`).insertAdjacentHTML('beforeend', plantillas[b.dataset.que]());
    } else if (b.dataset.accion === 'quitar') {
      b.closest('[data-renglon]').remove();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const renglones = (t) => [...form.querySelectorAll(`[data-renglon=${t}]`)].map((r) =>
      Object.fromEntries([...r.querySelectorAll('[data-c]')].map((el) => [
        el.dataset.c,
        el.type === 'checkbox' ? el.checked : ['id_sede', 'dia_semana'].includes(el.dataset.c) ? Number(el.value) : el.value,
      ])));
    const marcados = (n) => [...form.querySelectorAll(`[name=${n}]:checked`)].map((el) => Number(el.value));
    const cuerpo = {
      titulo: form.titulo.value, descripcion: form.descripcion.value, tipo: form.tipo.value,
      estado_vigencia: form.estado_vigencia.value, id_organizador: form.id_organizador.value,
      url_oficial: form.url_oficial.value, destacada: form.destacada.checked,
      unidades: marcados('unidades'), disciplinas: marcados('disciplinas'),
      horarios: renglones('horario'), requisitos: renglones('requisito'), fuentes: renglones('fuente'),
      detalle: Object.fromEntries([...form.querySelectorAll(`[data-tipo-campos=${form.tipo.value}] [data-d]`)].map((el) => [el.dataset.d, el.value])),
    };
    try {
      const r = await api(id ? `/admin/oportunidades/${id}` : '/admin/oportunidades', { metodo: id ? 'PUT' : 'POST', cuerpo });
      aviso('Oportunidad guardada.');
      location.hash = `#/oportunidad/${r.id_oportunidad}`;
    } catch (err) {
      const caja = document.getElementById('form-error');
      caja.innerHTML = `<div class="mensaje-error" role="alert">${esc(err.message)}</div>`;
      caja.scrollIntoView({ block: 'center' });
    }
  });
}

// ---------- Acciones globales ----------

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const { accion, id } = b.dataset;
  try {
    if (accion === 'salir') {
      await api('/auth/logout', { metodo: 'POST' });
      await cargarSesion();
      location.hash = '#/';
      enrutar();
    } else if (accion === 'guardar') {
      if (!estado.usuario) return void (location.hash = '#/entrar');
      const guardada = b.dataset.guardada === 'true';
      await api(`/guardadas/${id}`, { metodo: guardada ? 'DELETE' : 'PUT' });
      b.dataset.guardada = String(!guardada);
      b.textContent = guardada ? 'Guardar' : 'Quitar de guardadas';
      aviso(guardada ? 'Se quitó de tus guardadas.' : 'Guardada en tu cuenta.');
    } else if (accion === 'verificar') {
      await api(`/admin/oportunidades/${id}/verificaciones`, { metodo: 'POST', cuerpo: { resultado: 'vigente' } });
      aviso('Verificación registrada.');
      vistaAdmin();
    } else if (accion === 'eliminar') {
      if (!confirm(`¿Eliminar «${b.dataset.titulo}»? Dejará de mostrarse a los estudiantes.`)) return;
      await api(`/admin/oportunidades/${id}`, { metodo: 'DELETE' });
      aviso('Oportunidad eliminada.');
      vistaAdmin();
    } else if (accion === 'reporte') {
      await api(`/admin/reportes/${id}`, { metodo: 'PATCH', cuerpo: { estado: b.dataset.estado } });
      vistaAdmin();
    }
  } catch (err) {
    aviso(err.message);
  }
});

// ---------- Arranque ----------

(async function iniciar() {
  try {
    [estado.catalogos] = await Promise.all([api('/catalogos'), cargarSesion()]);
  } catch (e) {
    vista.innerHTML = `<div class="vacio">No se pudo conectar con el servidor: ${esc(e.message)}</div>`;
    return;
  }
  window.addEventListener('hashchange', enrutar);
  enrutar();
})();
