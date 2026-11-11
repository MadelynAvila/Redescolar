/* =====================================================
   NÚCLEO · conexión, sesión, utilidades, rutas y layout
   ===================================================== */
'use strict';

const CONFIGURADO = !/TU-PROYECTO|TU-ANON/.test(CONFIG.SUPABASE_URL + CONFIG.SUPABASE_ANON_KEY);
const sb = window.supabase.createClient(
  CONFIGURADO ? CONFIG.SUPABASE_URL : 'https://ejemplo.supabase.co',
  CONFIGURADO ? CONFIG.SUPABASE_ANON_KEY : 'clave-de-ejemplo'
);

const estado = {
  usuario: null,     // usuario de Auth
  perfil: null,      // fila de usuarios_sociales
  config: null,      // configuracion_comunidad
  siguiendo: new Set(),
  posts: new Map(),
  noLeidas: 0,
  reportesPendientes: 0,
  temporizador: null,
};

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const vista = () => $('#vista');
const esModerador = () => ['administrador', 'docente'].includes(estado.perfil?.rol);
const esAdmin = () => estado.perfil?.rol === 'administrador';

/* ---------- Íconos ---------- */
const ICONOS = {
  inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  crear: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
  publicaciones: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  personas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.7c2 .7 3.2 2.5 3.6 5.3"/>',
  persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.3-6.5 8-6.5s7 2.5 8 6.5"/>',
  personaMas: '<circle cx="10" cy="8" r="4"/><path d="M2 21c1-4 4.3-6.5 8-6.5 1.6 0 3 .4 4.3 1.2"/><path d="M19 14v6M16 17h6"/>',
  personaCheck: '<circle cx="10" cy="8" r="4"/><path d="M2 21c1-4 4.3-6.5 8-6.5 1.6 0 3 .4 4.3 1.2"/><path d="m15.5 18 2 2 4-4"/>',
  corazon: '<path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.5 3.8 4 7.3 4c2 0 3.4 1.1 4.7 2.8C13.3 5.1 14.7 4 16.7 4c3.5 0 5.6 3.5 4.5 6.7C19.5 15.4 12 20 12 20z"/>',
  campana: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  comentario: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z"/>',
  enviar: '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>',
  imagen: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  subir: '<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  ubicacion: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mundo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ojoNo: '<path d="m3 3 18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  puntos: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  bandera: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
  escudo: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  ajustes: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  salir: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="m10 17-5-5 5-5"/><path d="M5 12h11"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  basura: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  atras: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  izq: '<path d="m15 6-6 6 6 6"/>',
  der: '<path d="m9 6 6 6-6 6"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  llave: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  bloqueo: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  actividad: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  copiar: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  documento: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  estrella: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  usuarios: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-6 7-6s6.2 2.4 7 6"/>',
  refrescar: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  importar: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  libro: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20"/>',
};
function icono(nombre, clase = '') {
  return `<svg class="ic ${clase}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;
}

/* ---------- Constantes de la red ---------- */
const ROLES = {
  administrador: { texto: 'Administración', badge: 'morado' },
  docente: { texto: 'Docente', badge: 'azul' },
  estudiante: { texto: 'Estudiante', badge: 'verde' },
};
const ESTADOS_USUARIO = {
  activo: { texto: 'Activa', badge: 'verde' },
  pendiente: { texto: 'Pendiente', badge: 'naranja' },
  suspendido: { texto: 'Suspendida', badge: 'rojo' },
};
const REACCIONES = {
  me_gusta: { emoji: '👍', texto: 'Me gusta' },
  me_encanta: { emoji: '❤️', texto: 'Me encanta' },
  me_divierte: { emoji: '😂', texto: 'Me divierte' },
  me_asombra: { emoji: '😮', texto: 'Me asombra' },
  me_entristece: { emoji: '😢', texto: 'Me entristece' },
};
const VISIBILIDAD = {
  publica: { texto: 'Pública', icono: 'mundo' },
  seguidores: { texto: 'Solo seguidores', icono: 'personas' },
  privada: { texto: 'Privada (solo yo)', icono: 'candado' },
};
const MOTIVOS_REPORTE = {
  acoso: 'Acoso o bullying',
  contenido_inapropiado: 'Contenido inapropiado',
  discurso_odio: 'Lenguaje ofensivo u odio',
  informacion_falsa: 'Información falsa',
  spam: 'Spam o publicidad',
  otro: 'Otro motivo',
  filtro_automatico: 'Filtro automático',
};
const COLORES_AVATAR = ['#1d72f2', '#7c5cff', '#e5487f', '#f08c00', '#16a37a', '#0ea5c6', '#e5484d', '#475569'];

/* ---------- Utilidades de texto y fecha ---------- */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatearTexto(s) {
  return esc(s)
    .replace(/(^|\s)#([\wáéíóúñü]+)/gi, '$1<span class="hashtag">#$2</span>')
    .replace(/(^|\s)@([a-z0-9._]{3,40})/gi, '$1<a class="mencion" href="#/perfil/$2">@$2</a>');
}
function iniciales(nombre) {
  return String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}
function tiempo(fecha) {
  const d = new Date(fecha), ahora = new Date();
  const seg = Math.round((ahora - d) / 1000);
  if (seg < 0) return 'el ' + fechaCorta(d) + ' a las ' + horaCorta(d);
  if (seg < 60) return 'justo ahora';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
  if (seg < 172800) return 'ayer';
  if (seg < 604800) return `hace ${Math.floor(seg / 86400)} días`;
  return fechaCorta(d);
}
function fechaCorta(d) {
  d = new Date(d);
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}
function horaCorta(d) { return new Date(d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }); }
function fechaHora(d) { return d ? `${fechaCorta(d)}, ${horaCorta(d)}` : '—'; }
function sinAcentos(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function plural(n, uno, varios) { return `${n} ${n === 1 ? uno : varios}`; }

/* ---------- Avatares e insignias ---------- */
function avatar(u, tam = '') {
  const clase = `avatar ${tam ? 'avatar--' + tam : ''}`;
  if (!u) return `<span class="${clase}" style="background:#cbd5e1">?</span>`;
  if (u.avatar_url) return `<span class="${clase}"><img src="${esc(u.avatar_url)}" alt="" loading="lazy"></span>`;
  return `<span class="${clase}" style="background:${esc(u.color_avatar || '#1d72f2')}">${esc(iniciales(u.nombre_completo))}</span>`;
}
function badgeRol(rol, soloStaff = false) {
  if (!rol || (soloStaff && rol === 'estudiante')) return '';
  const r = ROLES[rol]; return `<span class="badge badge--${r.badge}">${r.texto}</span>`;
}
function badgeEstadoUsuario(e) { const r = ESTADOS_USUARIO[e] || { texto: e, badge: 'gris' }; return `<span class="badge badge--${r.badge}">${r.texto}</span>`; }
function persona(u, extra = '', tam = '') {
  if (!u) return `<div class="persona">${avatar(null, tam)}<div class="persona__txt"><b>Cuenta no disponible</b></div></div>`;
  return `<a class="persona" href="#/perfil/${esc(u.nombre_usuario)}">${avatar(u, tam)}
    <div class="persona__txt"><b>${esc(u.nombre_completo)}</b><small>@${esc(u.nombre_usuario)}${extra}</small></div></a>`;
}
function vacio(ic, titulo, texto = '', boton = '') {
  return `<div class="vacio">${icono(ic)}<h3>${esc(titulo)}</h3><p>${esc(texto)}</p>${boton ? `<div style="margin-top:16px">${boton}</div>` : ''}</div>`;
}
const CARGANDO = '<div class="centrado"><div class="spinner"></div></div>';

/* ---------- Errores ---------- */
function textoError(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || 'Error desconocido');
  if (/Invalid login credentials/i.test(m)) return 'Usuario o contraseña incorrectos.';
  if (/banned/i.test(m)) return 'Tu cuenta está suspendida o pendiente de activación. Habla con la administración.';
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer esto.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No hay conexión con el servidor. Revisa tu internet.';
  if (/duplicate key/i.test(m)) return 'Ese registro ya existe.';
  if (/payload too large|exceeded the maximum/i.test(m)) return 'El archivo es demasiado grande (máximo 20 MB).';
  if (/mime type/i.test(m)) return 'Ese tipo de archivo no está permitido.';
  return m;
}
async function ejecutar(promesa) {
  const { data, error, count } = await promesa;
  if (error) throw error;
  return count !== undefined && count !== null && data === null ? count : data;
}

/* ---------- Avisos (toasts) ---------- */
function aviso(mensaje, tipo = '') {
  const t = document.createElement('div');
  t.className = `toast ${tipo ? 'toast--' + tipo : ''}`;
  t.innerHTML = (tipo === 'exito' ? icono('check') : tipo === 'error' ? icono('x') : '') + `<span>${esc(mensaje)}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3600);
  setTimeout(() => t.remove(), 4000);
}
const avisoError = e => { console.error(e); aviso(textoError(e), 'error'); };

/* ---------- Modales ---------- */
function abrirModal({ titulo, cuerpo, acciones = [], ancho = false, alCerrar }) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal ${ancho ? 'modal--ancho' : ''}" role="dialog" aria-modal="true">
    <div class="modal__cabeza"><h3>${esc(titulo)}</h3><button class="btn-icono" data-cerrar aria-label="Cerrar">${icono('x')}</button></div>
    <div class="modal__cuerpo">${cuerpo}</div>
    ${acciones.length ? `<div class="modal__pie">${acciones.map((a, i) => `<button class="btn ${a.clase || 'btn--gris'}" data-i="${i}">${a.texto}</button>`).join('')}</div>` : ''}
  </div>`;
  const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', esc_); alCerrar && alCerrar(); };
  const esc_ = e => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', esc_);
  fondo.addEventListener('mousedown', e => { if (e.target === fondo) cerrar(); });
  $('[data-cerrar]', fondo).onclick = cerrar;
  $$('.modal__pie button', fondo).forEach(b => b.onclick = async () => {
    const a = acciones[+b.dataset.i];
    if (!a.accion) return cerrar();
    const original = b.innerHTML;
    b.disabled = true; b.innerHTML = '<span class="spinner spinner--chico"></span>';
    try { const r = await a.accion(fondo); if (r !== false) cerrar(); }
    catch (e) { avisoError(e); }
    finally { if (document.body.contains(b)) { b.disabled = false; b.innerHTML = original; } }
  });
  $('#modales').appendChild(fondo);
  const primero = $('input, textarea, select', fondo);
  if (primero) setTimeout(() => primero.focus(), 50);
  return { el: fondo, cerrar };
}
function confirmar({ titulo = '¿Estás segura?', mensaje = '', boton = 'Confirmar', peligro = false }) {
  return new Promise(res => {
    let ok = false;
    abrirModal({
      titulo, cuerpo: `<p class="texto-suave">${mensaje}</p>`,
      acciones: [{ texto: 'Cancelar' }, { texto: boton, clase: peligro ? 'btn--rojo' : 'btn--azul', accion: () => { ok = true; } }],
      alCerrar: () => res(ok),
    });
  });
}
function pedirTexto({ titulo, mensaje = '', etiqueta = '', placeholder = '', boton = 'Aceptar', requerido = false, valor = '', peligro = false }) {
  return new Promise(res => {
    let valorFinal = null;
    abrirModal({
      titulo,
      cuerpo: `${mensaje ? `<p class="texto-suave">${mensaje}</p>` : ''}
        <label class="campo"><span>${esc(etiqueta)}</span><textarea rows="3" maxlength="500" placeholder="${esc(placeholder)}" id="pedir-texto">${esc(valor)}</textarea></label>`,
      acciones: [{ texto: 'Cancelar' }, {
        texto: boton, clase: peligro ? 'btn--rojo' : 'btn--azul', accion: m => {
          const v = $('#pedir-texto', m).value.trim();
          if (requerido && !v) { aviso('Este campo es obligatorio', 'error'); return false; }
          valorFinal = v;
        }
      }],
      alCerrar: () => res(valorFinal),
    });
  });
}

/* ---------- Menús desplegables ---------- */
function abrirMenu(boton, items) {
  cerrarMenus();
  const cont = boton.closest('.desplegable') || boton.parentElement;
  const menu = document.createElement('div');
  menu.className = 'desplegable__menu';
  items.filter(Boolean).forEach(it => {
    const b = document.createElement('button');
    b.type = 'button';
    if (it.peligro) b.className = 'peligro';
    b.innerHTML = `${icono(it.icono || 'der')}<span>${esc(it.texto)}</span>`;
    b.onclick = e => { e.stopPropagation(); cerrarMenus(); it.fn(); };
    menu.appendChild(b);
  });
  cont.appendChild(menu);
  const r = menu.getBoundingClientRect();
  if (r.bottom > innerHeight - 10) { menu.style.top = 'auto'; menu.style.bottom = 'calc(100% + 4px)'; }
}
function cerrarMenus() { $$('.desplegable__menu, .selector-reacciones').forEach(m => m.remove()); }
document.addEventListener('click', e => {
  if (!e.target.closest('.desplegable__menu, [data-menu], .selector-reacciones, [data-accion="abrir-reacciones"]')) cerrarMenus();
});

/* ---------- Acciones delegadas (data-accion="...") ---------- */
const ACCIONES = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-accion]');
  if (!el || !ACCIONES[el.dataset.accion]) return;
  e.preventDefault();
  Promise.resolve(ACCIONES[el.dataset.accion](el, e)).catch(avisoError);
});

/* ---------- Subida de archivos ---------- */
const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
async function subirArchivo(archivo, prefijo = '') {
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) throw new Error(`"${archivo.name}" no es una imagen o video permitido.`);
  if (archivo.size > 20 * 1024 * 1024) throw new Error(`"${archivo.name}" pesa más de 20 MB.`);
  const limpio = sinAcentos(archivo.name).toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-60);
  const ruta = `${estado.usuario.id}/${prefijo}${Date.now()}-${limpio}`;
  await ejecutar(sb.storage.from('medios').upload(ruta, archivo, { cacheControl: '3600', upsert: false }));
  return sb.storage.from('medios').getPublicUrl(ruta).data.publicUrl;
}
const esVideo = url => /\.(mp4|webm)(\?|$)/i.test(url);
function medioHTML(url, extra = '') {
  return esVideo(url)
    ? `<video src="${esc(url)}" ${extra || 'controls playsinline preload="metadata"'}></video>`
    : `<img src="${esc(url)}" alt="" loading="lazy">`;
}

/* =====================================================
   RUTAS
   ===================================================== */
const RUTAS = [];
function ruta(patron, fn, opciones = {}) { RUTAS.push({ patron, fn, ...opciones }); }

function cabecera(titulo, migas = []) {
  $('#titulo-vista').textContent = titulo;
  document.title = `${titulo} · ${estado.config?.nombre_comunidad || 'Red Escolar'}`;
  $('#migas').innerHTML = migas.length
    ? [['Inicio', '#/inicio'], ...migas].map(([t, h], i, a) =>
        (i < a.length - 1 && h ? `<a href="${h}">${esc(t)}</a>` : `<span>${esc(t)}</span>`) + (i < a.length - 1 ? '<span class="sep">/</span>' : '')).join('')
    : '';
}

async function navegar() {
  if (!estado.perfil) return;
  const hash = location.hash.replace(/^#/, '') || '/inicio';
  const [camino, consulta] = hash.split('?');
  const params = Object.fromEntries(new URLSearchParams(consulta || ''));
  for (const r of RUTAS) {
    const m = camino.match(r.patron);
    if (!m) continue;
    if (r.roles && !r.roles.includes(estado.perfil.rol)) {
      vista().innerHTML = vacio('candado', 'Sin acceso', 'Esta sección no está disponible para tu rol.');
      cabecera('Sin acceso'); return;
    }
    marcarMenu(camino);
    cerrarSidebar();
    cerrarMenus();
    vista().innerHTML = CARGANDO;
    window.scrollTo(0, 0);
    try { await r.fn(m.slice(1).map(decodeURIComponent), params); }
    catch (e) { console.error(e); vista().innerHTML = vacio('bloqueo', 'Algo salió mal', textoError(e)); }
    return;
  }
  location.hash = '#/inicio';
}
window.addEventListener('hashchange', navegar);

/* =====================================================
   MENÚ LATERAL Y CABECERA
   ===================================================== */
function construirMenu() {
  const item = (href, ic, texto, id = '') =>
    `<a class="menu__item" href="${href}" data-ruta="${href.slice(1)}">${icono(ic)}<span>${texto}</span>${id ? `<span class="insignia" id="${id}" hidden></span>` : ''}</a>`;
  let html = item('#/inicio', 'inicio', 'Inicio')
    + item('#/crear', 'crear', 'Crear publicación')
    + item('#/mis-publicaciones', 'publicaciones', 'Mis publicaciones')
    + item('#/explorar', 'usuarios', 'Perfiles')
    + item('#/seguidores', 'personas', 'Seguidores')
    + item('#/notificaciones', 'campana', 'Notificaciones', 'insignia-notif');
  if (esModerador()) {
    html += '<div class="menu__seccion">Panel docente</div>'
      + item('#/moderacion', 'actividad', 'Resumen')
      + item('#/moderacion/reportes', 'bandera', 'Reportes', 'insignia-reportes')
      + item('#/moderacion/contenido', 'escudo', 'Supervisión')
      + item('#/moderacion/comentarios', 'comentario', 'Comentarios')
      + item('#/moderacion/registro', 'lista', 'Registro');
  }
  if (esAdmin()) {
    html += '<div class="menu__seccion">Administración</div>'
      + item('#/admin/usuarios', 'personaMas', 'Usuarios')
      + item('#/admin/configuracion', 'ajustes', 'Configuración');
  }
  $('#menu').innerHTML = html;
  $('#btn-salir').innerHTML = `${icono('salir')}<span>Cerrar sesión</span>`;
  $('#btn-menu').innerHTML = icono('menu');
  $('#btn-campana').innerHTML = icono('campana') + '<span class="punto" id="punto-notif" hidden></span>';
}
function marcarMenu(camino) {
  const items = $$('.menu__item[data-ruta]');
  let mejor = null;
  items.forEach(a => { a.classList.remove('activo'); if (camino === a.dataset.ruta || camino.startsWith(a.dataset.ruta + '/')) if (!mejor || a.dataset.ruta.length > mejor.dataset.ruta.length) mejor = a; });
  if (camino.startsWith('/editar')) mejor = $('.menu__item[data-ruta="/crear"]');
  if (camino.startsWith('/perfil/' + estado.perfil.nombre_usuario)) mejor = null;
  if (camino.startsWith('/publicacion')) mejor = $('.menu__item[data-ruta="/inicio"]');
  mejor && mejor.classList.add('activo');
}
function pintarYo() {
  const p = estado.perfil;
  $('#topbar-yo').innerHTML = `${avatar(p, '')}<span class="topbar__yo-txt"><b>${esc(p.nombre_completo.split(' ')[0])}</b><small>${ROLES[p.rol].texto}</small></span>`;
}
function pintarComunidad() {
  const c = estado.config || {};
  $$('.js-nombre-comunidad').forEach(e => e.textContent = c.nombre_comunidad || 'Red Escolar');
  $$('.js-descripcion-comunidad').forEach(e => e.textContent = c.descripcion || '');
  $('#anuncio-titulo').textContent = c.anuncio_titulo || '';
  $('#anuncio-texto').textContent = c.anuncio_texto || '';
  $('#anuncio').hidden = !c.anuncio_titulo && !c.anuncio_texto;
  $('#anio').textContent = new Date().getFullYear();
}
function abrirSidebar() { $('#sidebar').classList.add('abierta'); $('#sidebar-fondo').classList.add('visible'); }
function cerrarSidebar() { $('#sidebar').classList.remove('abierta'); $('#sidebar-fondo').classList.remove('visible'); }

async function actualizarContadores() {
  if (!estado.perfil) return;
  try {
    const { count } = await sb.from('notificaciones').select('id', { count: 'exact', head: true }).eq('leida', false);
    estado.noLeidas = count || 0;
    const ins = $('#insignia-notif'), punto = $('#punto-notif');
    ins.hidden = punto.hidden = !estado.noLeidas;
    ins.textContent = punto.textContent = estado.noLeidas > 99 ? '99+' : estado.noLeidas;
    if (esModerador()) {
      const r = await sb.from('reportes').select('id', { count: 'exact', head: true }).in('estado', ['pendiente', 'en_revision']);
      estado.reportesPendientes = r.count || 0;
      const ir = $('#insignia-reportes');
      ir.hidden = !estado.reportesPendientes; ir.textContent = estado.reportesPendientes;
    }
  } catch (e) { console.warn(e); }
}

/* =====================================================
   SESIÓN
   ===================================================== */
async function cargarConfig() {
  const { data } = await sb.from('configuracion_comunidad').select('*').eq('id', 1).maybeSingle();
  estado.config = data || { nombre_comunidad: 'Red Escolar', permitir_comentarios: true, max_caracteres: 2000, max_imagenes: 4, palabras_prohibidas: [] };
  pintarComunidad();
}

function mostrarLogin(mensaje = '') {
  estado.perfil = null; estado.usuario = null;
  clearInterval(estado.temporizador);
  $('#app').hidden = true;
  $('#pantalla-login').hidden = false;
  $('#cargando-global').hidden = true;
  const err = $('#login-error');
  if (!CONFIGURADO) mensaje = 'Falta configurar la conexión: abre js/config.js y pega la URL y la anon key de tu proyecto de Supabase.';
  err.hidden = !mensaje; err.textContent = mensaje;
  document.title = `Iniciar sesión · ${estado.config?.nombre_comunidad || 'Red Escolar'}`;
}

async function cargarSesion(usuario) {
  const perfil = await ejecutar(sb.from('usuarios_sociales').select('*').eq('id', usuario.id).maybeSingle());
  if (!perfil) { await sb.auth.signOut(); return mostrarLogin('Tu cuenta no tiene un perfil en la comunidad. Habla con la administración.'); }
  if (perfil.estado !== 'activo') {
    await sb.auth.signOut();
    return mostrarLogin(perfil.estado === 'suspendido' ? 'Tu cuenta está suspendida. Habla con la administración.' : 'Tu cuenta aún está pendiente de activación.');
  }
  estado.usuario = usuario;
  estado.perfil = perfil;
  await cargarConfig();
  await cargarSiguiendo();
  construirMenu();
  pintarYo();
  $('#pantalla-login').hidden = true;
  $('#app').hidden = false;
  $('#cargando-global').hidden = true;
  actualizarContadores();
  clearInterval(estado.temporizador);
  estado.temporizador = setInterval(actualizarContadores, 30000);
  navegar();
}
async function recargarPerfil() {
  estado.perfil = await ejecutar(sb.from('usuarios_sociales').select('*').eq('id', estado.usuario.id).single());
  pintarYo();
}
async function cargarSiguiendo() {
  const filas = await ejecutar(sb.from('seguidores').select('seguido_id').eq('seguidor_id', estado.usuario.id));
  estado.siguiendo = new Set(filas.map(f => f.seguido_id));
}

async function iniciarSesion(e) {
  e.preventDefault();
  const btn = $('#btn-login'), err = $('#login-error');
  let usuario = $('#login-usuario').value.trim().toLowerCase().replace(/^@/, '');
  const password = $('#login-password').value;
  if (!CONFIGURADO) return mostrarLogin();
  const email = usuario.includes('@') ? usuario : `${usuario}@${CONFIG.DOMINIO_INTERNO}`;
  btn.disabled = true; btn.innerHTML = '<span class="spinner spinner--chico"></span> Entrando…';
  err.hidden = true;
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    $('#login-password').value = '';
    await cargarSesion(data.user);
  } catch (ex) {
    err.textContent = textoError(ex); err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'Iniciar sesión';
  }
}

async function cerrarSesion() {
  if (!await confirmar({ titulo: 'Cerrar sesión', mensaje: '¿Quieres salir de tu cuenta?', boton: 'Cerrar sesión' })) return;
  await sb.auth.signOut();
  location.hash = '';
  mostrarLogin();
}

/* =====================================================
   ARRANQUE
   ===================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  $('#form-login').addEventListener('submit', iniciarSesion);
  $('.js-ver-password').innerHTML = icono('ojo');
  $('.js-ver-password').onclick = function () {
    const i = $('#login-password'); const ver = i.type === 'password';
    i.type = ver ? 'text' : 'password'; this.innerHTML = icono(ver ? 'ojoNo' : 'ojo');
  };
  $('#btn-salir').onclick = cerrarSesion;
  $('#btn-menu').onclick = abrirSidebar;
  $('#sidebar-fondo').onclick = cerrarSidebar;

  if (!CONFIGURADO) return mostrarLogin();
  cargarConfig().catch(() => {});

  sb.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT' && estado.perfil) mostrarLogin('Tu sesión terminó. Vuelve a iniciar sesión.');
  });

  try {
    const { data } = await sb.auth.getSession();
    if (data.session) await cargasSesionSegura(data.session.user);
    else mostrarLogin();
  } catch (e) { mostrarLogin(textoError(e)); }
});
async function cargasSesionSegura(u) {
  try { await cargarSesion(u); } catch (e) { await sb.auth.signOut(); mostrarLogin(textoError(e)); }
}
