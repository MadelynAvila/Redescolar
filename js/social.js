/* =====================================================
   PANEL DE ESTUDIANTE · inicio, publicaciones, perfiles,
   seguidores y notificaciones
   ===================================================== */
'use strict';

const CAMPOS_USUARIO = 'id,nombre_completo,nombre_usuario,avatar_url,color_avatar,rol';
const SELECT_POST = `*,
  autor:usuarios_sociales!publicaciones_autor_id_fkey(${CAMPOS_USUARIO}),
  reacciones(tipo,usuario_id),
  comentarios(count),
  publicacion_etiquetas(usuario:usuarios_sociales!publicacion_etiquetas_usuario_id_fkey(id,nombre_usuario,nombre_completo))`;
const yo = () => estado.usuario.id;
const yaSalio = p => new Date(p.fecha_publicacion) <= new Date();

/* ---------- Formularios delegados (data-form="...") ---------- */
const FORMULARIOS = {};
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]');
  if (!f || !FORMULARIOS[f.dataset.form]) return;
  e.preventDefault();
  Promise.resolve(FORMULARIOS[f.dataset.form](f)).catch(avisoError);
});
ACCIONES.ir = el => { location.hash = el.dataset.href; };
ACCIONES.recargar = () => navegar();

/* =====================================================
   TARJETA DE PUBLICACIÓN
   ===================================================== */
function estadoPost(p) {
  if (p.estado === 'borrador') return { clave: 'borrador', texto: 'Borrador', badge: 'gris' };
  if (p.estado === 'en_revision') return { clave: 'en_revision', texto: 'En revisión', badge: 'naranja' };
  if (p.estado === 'oculta') return { clave: 'oculta', texto: 'Oculta', badge: 'rojo' };
  if (!yaSalio(p)) return { clave: 'programada', texto: 'Programada', badge: 'morado' };
  return { clave: 'publicada', texto: 'Publicada', badge: 'verde' };
}
function badgeEstadoPost(p) { const e = estadoPost(p); return `<span class="badge badge--${e.badge}">${e.texto}</span>`; }

function carrusel(medios) {
  if (!medios || !medios.length) return '';
  const varios = medios.length > 1;
  return `<div class="carrusel" data-carrusel data-i="0">
    <div class="carrusel__pista">${medios.map(u => `<div class="carrusel__item">${esVideo(u) ? '' : `<div class="carrusel__fondo" style="background-image:url('${esc(u)}')"></div>`}${medioHTML(u)}</div>`).join('')}</div>
    ${varios ? `
      <button class="carrusel__btn carrusel__btn--izq" data-accion="carrusel" data-dir="-1" aria-label="Anterior">${icono('izq')}</button>
      <button class="carrusel__btn carrusel__btn--der" data-accion="carrusel" data-dir="1" aria-label="Siguiente">${icono('der')}</button>
      <div class="carrusel__puntos">${medios.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
      <span class="carrusel__contador">1/${medios.length}</span>` : ''}
  </div>`;
}
// El recuadro toma la forma de la primera imagen (entre vertical 4:5 y horizontal 1.91:1)
document.addEventListener('load', e => {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.parentElement?.classList.contains('carrusel__item')) return;
  const c = img.closest('[data-carrusel]');
  if (!c || c.dataset.proporcion || img.parentElement !== c.querySelector('.carrusel__item')) return;
  const r = Math.min(Math.max(img.naturalWidth / img.naturalHeight, 0.8), 1.91);
  c.dataset.proporcion = r; c.style.setProperty('--proporcion', r);
}, true);

ACCIONES.carrusel = el => {
  const c = el.closest('[data-carrusel]');
  const n = $$('.carrusel__item', c).length;
  const i = ((+c.dataset.i + +el.dataset.dir) % n + n) % n;
  c.dataset.i = i;
  $('.carrusel__pista', c).style.transform = `translateX(-${i * 100}%)`;
  $$('.carrusel__puntos i', c).forEach((p, k) => p.classList.toggle('on', k === i));
  $('.carrusel__contador', c).textContent = `${i + 1}/${n}`;
  $$('video', c).forEach(v => v.pause());
};

function tarjetaPost(p) {
  estado.posts.set(p.id, p);
  const a = p.autor;
  const reacs = p.reacciones || [];
  const mia = reacs.find(r => r.usuario_id === yo())?.tipo;
  const conteo = {};
  reacs.forEach(r => { conteo[r.tipo] = (conteo[r.tipo] || 0) + 1; });
  const top = Object.entries(conteo).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([t]) => `<span>${REACCIONES[t].emoji}</span>`).join('');
  const nCom = p.comentarios?.[0]?.count || 0;
  const vis = VISIBILIDAD[p.visibilidad];
  const etiquetas = (p.publicacion_etiquetas || []).map(e => e.usuario).filter(Boolean);
  const est = estadoPost(p);
  const avisos = {
    borrador: ['info', 'Borrador: solo tú puedes verlo.'],
    programada: ['info', `Programada para el ${fechaHora(p.fecha_publicacion)}.`],
    en_revision: ['aviso', `En revisión por el equipo docente.${p.motivo_moderacion ? ' ' + p.motivo_moderacion : ''}`],
    oculta: ['error', `Oculta por moderación.${p.motivo_moderacion ? ' Motivo: ' + p.motivo_moderacion : ''}`],
  }[est.clave];

  return `<article class="post" data-post="${p.id}">
    <header class="post__cabeza">
      <a href="#/perfil/${esc(a?.nombre_usuario)}">${avatar(a)}</a>
      <div class="persona__txt" style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;min-width:0">
          <a href="#/perfil/${esc(a?.nombre_usuario)}" style="color:inherit;min-width:0"><b>${esc(a?.nombre_completo || 'Cuenta no disponible')}</b></a>${badgeRol(a?.rol, true)}
        </div>
        <div class="post__meta">
          <span>@${esc(a?.nombre_usuario)}</span>·
          <a href="#/publicacion/${p.id}" style="color:inherit" title="${esc(fechaHora(p.fecha_publicacion))}">${tiempo(p.fecha_publicacion)}</a>·
          <span title="${vis.texto}">${icono(vis.icono)}</span>
          ${p.ubicacion ? `· ${icono('ubicacion')}<span>${esc(p.ubicacion)}</span>` : ''}
          ${p.fecha_edicion && p.estado === 'publicada' ? '· <span>editada</span>' : ''}
        </div>
      </div>
      <div class="desplegable"><button class="btn-icono" data-menu data-accion="menu-post" data-id="${p.id}" aria-label="Opciones">${icono('puntos')}</button></div>
    </header>
    ${avisos ? `<div class="post__aviso alerta alerta--${avisos[0]}">${esc(avisos[1])}</div>` : ''}
    ${p.titulo || p.contenido || etiquetas.length ? `<div class="post__cuerpo">
      ${p.titulo ? `<h3 class="post__titulo">${esc(p.titulo)}</h3>` : ''}
      ${p.contenido ? `<p class="post__texto">${formatearTexto(p.contenido)}</p>` : ''}
      ${etiquetas.length ? `<div class="post__etiquetas"><span class="texto-suave chico">con</span>${etiquetas.map(u => `<a class="chip" style="padding:3px 10px" href="#/perfil/${esc(u.nombre_usuario)}">@${esc(u.nombre_usuario)}</a>`).join('')}</div>` : ''}
    </div>` : ''}
    ${carrusel(p.medios)}
    <div class="post__resumen">
      ${reacs.length ? `<button class="emojis" data-accion="ver-reacciones" data-id="${p.id}">${top}<b style="margin-left:6px;font-weight:500">${reacs.length}</b></button>` : '<span></span>'}
      <button data-accion="alternar-comentarios" data-id="${p.id}">${plural(nCom, 'comentario', 'comentarios')}</button>
    </div>
    <div class="post__acciones">
      <div class="reaccion-grupo">
        <button class="accion ${mia ? 'marcada' : ''}" data-accion="reaccion-rapida" data-id="${p.id}">
          ${mia ? `<span class="emoji">${REACCIONES[mia].emoji}</span><span class="txt">${REACCIONES[mia].texto}</span>` : `${icono('corazon')}<span class="txt">Reaccionar</span>`}
        </button>
        <button class="accion accion--mas" data-accion="abrir-reacciones" data-id="${p.id}" aria-label="Elegir reacción">${icono('abajo')}</button>
      </div>
      <button class="accion" data-accion="comentar" data-id="${p.id}">${icono('comentario')}<span class="txt">Comentar</span></button>
      <button class="accion" data-accion="copiar-enlace" data-id="${p.id}">${icono('enlace')}<span class="txt">Compartir</span></button>
    </div>
    <div class="comentarios" data-comentarios="${p.id}" hidden></div>
  </article>`;
}

async function refrescarPost(id) {
  const el = $(`[data-post="${id}"]`);
  if (!el) return navegar();
  const abiertos = !$(`[data-comentarios="${id}"]`, el).hidden;
  const p = await ejecutar(sb.from('publicaciones').select(SELECT_POST).eq('id', id).maybeSingle());
  if (!p) { el.remove(); return; }
  el.outerHTML = tarjetaPost(p);
  if (abiertos) await abrirComentarios(id);
}

/* ---------- Reacciones ---------- */
async function reaccionar(id, tipo) {
  const p = estado.posts.get(id);
  const mia = p.reacciones.find(r => r.usuario_id === yo())?.tipo;
  if (mia === tipo) await ejecutar(sb.from('reacciones').delete().eq('publicacion_id', id).eq('usuario_id', yo()));
  else await ejecutar(sb.from('reacciones').upsert({ publicacion_id: id, usuario_id: yo(), tipo }, { onConflict: 'publicacion_id,usuario_id' }));
  await refrescarPost(id);
}
ACCIONES['reaccion-rapida'] = el => {
  const p = estado.posts.get(el.dataset.id);
  const mia = p.reacciones.find(r => r.usuario_id === yo())?.tipo;
  return reaccionar(el.dataset.id, mia || 'me_gusta');
};
ACCIONES['abrir-reacciones'] = el => {
  const ya = el.closest('.reaccion-grupo').querySelector('.selector-reacciones');
  cerrarMenus();
  if (ya) return;
  el.closest('.reaccion-grupo').insertAdjacentHTML('beforeend',
    `<div class="selector-reacciones">${Object.entries(REACCIONES).map(([k, r]) =>
      `<button data-accion="reaccionar" data-id="${el.dataset.id}" data-tipo="${k}" title="${r.texto}" aria-label="${r.texto}">${r.emoji}</button>`).join('')}</div>`);
};
ACCIONES.reaccionar = el => { cerrarMenus(); return reaccionar(el.dataset.id, el.dataset.tipo); };
ACCIONES['ver-reacciones'] = async el => {
  const filas = await ejecutar(sb.from('reacciones')
    .select(`tipo, usuario:usuarios_sociales!reacciones_usuario_id_fkey(${CAMPOS_USUARIO})`)
    .eq('publicacion_id', el.dataset.id));
  abrirModal({
    titulo: `Reacciones (${filas.length})`,
    cuerpo: `<div class="lista">${filas.filter(f => f.usuario).map(f =>
      `<div class="lista__fila">${persona(f.usuario)}<span style="font-size:22px">${REACCIONES[f.tipo].emoji}</span></div>`).join('')}</div>`,
  });
};

/* ---------- Comentarios ---------- */
function comentarioHTML(c, p) {
  const mio = c.autor_id === yo();
  const puedoBorrar = mio || p.autor_id === yo() || esModerador();
  const oculto = c.estado === 'oculto';
  return `<div class="comentario ${oculto ? 'comentario--oculto' : ''}">
    <a href="#/perfil/${esc(c.autor?.nombre_usuario)}">${avatar(c.autor, 'sm')}</a>
    <div style="flex:1;min-width:0">
      <div class="comentario__burbuja">
        <a href="#/perfil/${esc(c.autor?.nombre_usuario)}" style="color:inherit"><b>${esc(c.autor?.nombre_completo || 'Cuenta no disponible')}</b></a> ${badgeRol(c.autor?.rol, true)}
        <p>${formatearTexto(c.contenido)}</p>
        ${oculto ? `<small class="error-campo">Oculto${c.motivo_moderacion ? ': ' + esc(c.motivo_moderacion) : ''}</small>` : ''}
      </div>
      <div class="comentario__pie">
        <span>${tiempo(c.fecha_creacion)}</span>
        ${!mio ? `<button data-accion="reportar-comentario" data-id="${c.id}" data-post="${p.id}" data-autor="${c.autor_id}">Reportar</button>` : ''}
        ${esModerador() && !mio ? `<button data-accion="moderar-comentario" data-id="${c.id}" data-post="${p.id}" data-modo="${oculto ? 'restaurar' : 'ocultar'}">${oculto ? 'Restaurar' : 'Ocultar'}</button>` : ''}
        ${puedoBorrar ? `<button data-accion="borrar-comentario" data-id="${c.id}" data-post="${p.id}" data-mio="${mio}">Eliminar</button>` : ''}
      </div>
    </div>
  </div>`;
}
async function abrirComentarios(id, enfocar = false) {
  const cont = $(`[data-comentarios="${id}"]`);
  if (!cont) return;
  cont.hidden = false;
  if (!cont.innerHTML) cont.innerHTML = '<div class="spinner spinner--chico"></div>';
  const lista = await ejecutar(sb.from('comentarios')
    .select(`*, autor:usuarios_sociales!comentarios_autor_id_fkey(${CAMPOS_USUARIO})`)
    .eq('publicacion_id', id).order('fecha_creacion'));
  const p = estado.posts.get(id);
  const permitido = estado.config.permitir_comentarios && p.permitir_comentarios && p.estado === 'publicada';
  cont.innerHTML = lista.map(c => comentarioHTML(c, p)).join('')
    + (permitido
      ? `<form class="nuevo-comentario" data-form="comentar" data-id="${id}">${avatar(estado.perfil, 'sm')}
           <input name="texto" maxlength="1000" placeholder="Escribe un comentario…" autocomplete="off" required>
           <button class="btn-icono" type="submit" aria-label="Enviar" style="color:var(--azul)">${icono('enviar')}</button></form>`
      : `<p class="texto-suave chico">${p.estado !== 'publicada' ? 'Los comentarios se habilitan cuando la publicación esté visible.' : 'Los comentarios están desactivados en esta publicación.'}</p>`);
  if (enfocar) $('input', cont)?.focus();
}
ACCIONES['alternar-comentarios'] = el => {
  const cont = $(`[data-comentarios="${el.dataset.id}"]`);
  if (!cont.hidden) { cont.hidden = true; return; }
  return abrirComentarios(el.dataset.id);
};
ACCIONES.comentar = el => abrirComentarios(el.dataset.id, true);
FORMULARIOS.comentar = async f => {
  const input = $('input', f), texto = input.value.trim();
  if (!texto) return;
  input.disabled = true;
  try {
    const c = await ejecutar(sb.from('comentarios').insert({ publicacion_id: f.dataset.id, autor_id: yo(), contenido: texto }).select('estado').single());
    if (c.estado === 'oculto') aviso('Tu comentario contiene palabras no permitidas y quedó en revisión.', 'error');
    await refrescarPost(f.dataset.id);
  } finally { input.disabled = false; }
};
ACCIONES['borrar-comentario'] = async el => {
  if (!await confirmar({ titulo: 'Eliminar comentario', mensaje: 'Esta acción no se puede deshacer.', boton: 'Eliminar', peligro: true })) return;
  if (el.dataset.mio !== 'true' && esModerador()) await ejecutar(sb.rpc('moderar_comentario', { p_id: el.dataset.id, p_accion: 'eliminar', p_motivo: null }));
  else await ejecutar(sb.from('comentarios').delete().eq('id', el.dataset.id));
  aviso('Comentario eliminado', 'exito');
  await refrescarPost(el.dataset.post);
};
ACCIONES['moderar-comentario'] = async el => {
  let motivo = null;
  if (el.dataset.modo === 'ocultar') {
    motivo = await pedirTexto({ titulo: 'Ocultar comentario', etiqueta: 'Motivo (la estudiante lo verá)', placeholder: 'Ej. Lenguaje inapropiado', boton: 'Ocultar', peligro: true });
    if (motivo === null) return;
  }
  await ejecutar(sb.rpc('moderar_comentario', { p_id: el.dataset.id, p_accion: el.dataset.modo, p_motivo: motivo }));
  aviso(el.dataset.modo === 'ocultar' ? 'Comentario ocultado' : 'Comentario restaurado', 'exito');
  if (el.dataset.post && $(`[data-post="${el.dataset.post}"]`)) await refrescarPost(el.dataset.post); else navegar();
};
ACCIONES['reportar-comentario'] = el => reportar({ tipo_objetivo: 'comentario', comentario_id: el.dataset.id, publicacion_id: el.dataset.post, usuario_reportado_id: el.dataset.autor });

/* ---------- Menú de publicación ---------- */
ACCIONES['menu-post'] = el => {
  const id = el.dataset.id, p = estado.posts.get(id), mio = p.autor_id === yo(), mod = esModerador() && !mio;
  abrirMenu(el, [
    mio && p.estado !== 'oculta' && { icono: 'editar', texto: 'Editar', fn: () => { location.hash = '#/editar/' + id; } },
    { icono: 'enlace', texto: 'Copiar enlace', fn: () => copiarEnlace(id) },
    !mio && { icono: 'bandera', texto: 'Reportar publicación', fn: () => reportar({ tipo_objetivo: 'publicacion', publicacion_id: id, usuario_reportado_id: p.autor_id }) },
    mod && p.estado === 'en_revision' && { icono: 'check', texto: 'Aprobar publicación', fn: () => moderarPublicacion(id, 'aprobar') },
    mod && p.estado === 'publicada' && { icono: 'ojoNo', texto: 'Ocultar (moderación)', fn: () => moderarPublicacion(id, 'ocultar') },
    mod && p.estado === 'oculta' && { icono: 'ojo', texto: 'Restaurar publicación', fn: () => moderarPublicacion(id, 'restaurar') },
    mio && { icono: 'basura', texto: 'Eliminar', peligro: true, fn: () => eliminarPublicacion(id) },
    mod && { icono: 'basura', texto: 'Eliminar (moderación)', peligro: true, fn: () => moderarPublicacion(id, 'eliminar') },
  ]);
};
ACCIONES['copiar-enlace'] = el => copiarEnlace(el.dataset.id);
async function copiarEnlace(id) {
  const url = location.href.split('#')[0] + '#/publicacion/' + id;
  try { await navigator.clipboard.writeText(url); aviso('Enlace copiado. Solo miembros de la comunidad pueden abrirlo.', 'exito'); }
  catch { pedirTexto({ titulo: 'Copia el enlace', etiqueta: 'Enlace', valor: url }); }
}
async function eliminarPublicacion(id, alTerminar) {
  if (!await confirmar({ titulo: 'Eliminar publicación', mensaje: 'Se eliminará junto con sus comentarios y reacciones. No se puede deshacer.', boton: 'Eliminar', peligro: true })) return;
  await ejecutar(sb.from('publicaciones').delete().eq('id', id));
  aviso('Publicación eliminada', 'exito');
  const el = $(`[data-post="${id}"]`);
  if (el && !alTerminar) el.remove(); else (alTerminar || navegar)();
}
async function moderarPublicacion(id, accion, alTerminar) {
  let motivo = null;
  if (accion === 'ocultar' || accion === 'eliminar') {
    motivo = await pedirTexto({
      titulo: accion === 'ocultar' ? 'Ocultar publicación' : 'Eliminar publicación',
      mensaje: accion === 'eliminar' ? 'La publicación se eliminará de forma permanente.' : 'La publicación dejará de verse. La autora recibirá una notificación.',
      etiqueta: 'Motivo (la autora lo verá)', placeholder: 'Ej. No respeta las normas de la comunidad',
      boton: accion === 'ocultar' ? 'Ocultar' : 'Eliminar', peligro: true,
    });
    if (motivo === null) return;
  }
  await ejecutar(sb.rpc('moderar_publicacion', { p_id: id, p_accion: accion, p_motivo: motivo || null }));
  aviso({ ocultar: 'Publicación ocultada', aprobar: 'Publicación aprobada', restaurar: 'Publicación restaurada', eliminar: 'Publicación eliminada' }[accion], 'exito');
  if (alTerminar) return alTerminar();
  if (accion === 'eliminar') { const el = $(`[data-post="${id}"]`); el ? el.remove() : navegar(); }
  else await refrescarPost(id);
}

/* ---------- Reportar ---------- */
function reportar(objetivo) {
  const opciones = Object.entries(MOTIVOS_REPORTE).filter(([k]) => k !== 'filtro_automatico');
  const nombre = { publicacion: 'publicación', comentario: 'comentario', usuario: 'perfil' }[objetivo.tipo_objetivo];
  abrirModal({
    titulo: `Reportar ${nombre}`,
    cuerpo: `<p class="texto-suave">Tu reporte es confidencial y lo revisará el equipo docente.</p>
      <div class="campo"><span>¿Cuál es el problema?</span>
        ${opciones.map(([k, t], i) => `<label class="radio"><input type="radio" name="motivo" value="${k}" ${i ? '' : 'checked'}> ${t}</label>`).join('')}
      </div>
      <label class="campo"><span>Detalles (opcional)</span><textarea id="rep-detalle" rows="3" maxlength="500" placeholder="Cuéntanos qué pasó"></textarea></label>`,
    acciones: [{ texto: 'Cancelar' }, {
      texto: 'Enviar reporte', clase: 'btn--rojo', accion: async m => {
        await ejecutar(sb.from('reportes').insert({
          ...objetivo, reportante_id: yo(),
          motivo: $('input[name="motivo"]:checked', m).value,
          detalle: $('#rep-detalle', m).value.trim() || null,
        }));
        aviso('Gracias. Tu reporte fue enviado al equipo docente.', 'exito');
      }
    }],
  });
}

/* =====================================================
   SEGUIR
   ===================================================== */
function botonSeguir(id, chico = true) {
  const sigo = estado.siguiendo.has(id);
  return `<button class="btn ${sigo ? 'btn--gris' : 'btn--azul'} ${chico ? 'btn--chico' : ''}" data-accion="seguir" data-id="${id}" data-chico="${chico}">${sigo ? icono('personaCheck') + 'Siguiendo' : icono('personaMas') + 'Seguir'}</button>`;
}
ACCIONES.seguir = async el => {
  const id = el.dataset.id, sigo = estado.siguiendo.has(id);
  el.disabled = true;
  try {
    if (sigo) {
      await ejecutar(sb.from('seguidores').delete().eq('seguidor_id', yo()).eq('seguido_id', id));
      estado.siguiendo.delete(id);
    } else {
      await ejecutar(sb.from('seguidores').insert({ seguidor_id: yo(), seguido_id: id }));
      estado.siguiendo.add(id);
    }
  } finally {
    $$(`[data-accion="seguir"][data-id="${id}"]`).forEach(b => { b.outerHTML = botonSeguir(id, b.dataset.chico === 'true'); });
  }
  const c = $(`#cnt-seguidores[data-id="${id}"]`);
  if (c) c.textContent = Math.max(0, +c.textContent + (sigo ? -1 : 1));
};

/* =====================================================
   INICIO (FEED)
   ===================================================== */
ruta(/^\/inicio$/, async (_, params) => {
  const siguiendo = params.ver === 'siguiendo';
  const nombre = esc(estado.perfil.nombre_completo.split(' ')[0]);
  cabecera('Inicio');
  vista().innerHTML = `<div class="contenedor--feed">
    <div class="columna">
      <div class="tarjeta compositor">
        ${avatar(estado.perfil)}
        <button class="compositor__falso" data-accion="ir" data-href="#/crear">¿Qué quieres compartir hoy, ${nombre}?</button>
        <a class="btn btn--verde" href="#/crear">${icono('imagen')}<span>Publicar</span></a>
      </div>
      <div class="barra-herr" style="margin:0">
        <div class="pestanas">
          <a class="pestana ${siguiendo ? '' : 'activa'}" href="#/inicio">Para ti</a>
          <a class="pestana ${siguiendo ? 'activa' : ''}" href="#/inicio?ver=siguiendo">Siguiendo</a>
        </div>
        <button class="btn btn--borde btn--chico" data-accion="recargar">${icono('refrescar')}Actualizar</button>
      </div>
      <div id="feed" class="columna"></div>
      <div id="feed-mas" class="centrado" hidden><button class="btn btn--borde">Cargar más</button></div>
    </div>
    <aside class="lateral" id="lateral">${CARGANDO}</aside>
  </div>`;

  let desde = 0;
  const TAM = 10;
  const cargar = async () => {
    let q = sb.from('publicaciones').select(SELECT_POST)
      .eq('estado', 'publicada').lte('fecha_publicacion', new Date().toISOString())
      .order('fecha_publicacion', { ascending: false }).range(desde, desde + TAM - 1);
    if (siguiendo) q = q.in('autor_id', [...estado.siguiendo, yo()]);
    const lista = await ejecutar(q);
    desde += lista.length;
    // Docentes ven todo por RLS; en el inicio solo mostramos lo que vería una estudiante
    const visibles = lista.filter(p => p.autor_id === yo() || p.visibilidad === 'publica'
      || (p.visibilidad === 'seguidores' && estado.siguiendo.has(p.autor_id)));
    $('#feed').insertAdjacentHTML('beforeend', visibles.map(tarjetaPost).join(''));
    $('#feed-mas').hidden = lista.length < TAM;
    if (!$('#feed').children.length) {
      $('#feed').innerHTML = `<div class="tarjeta">${siguiendo
        ? vacio('personas', 'Aún no hay publicaciones aquí', 'Sigue a otras compañeras para ver sus publicaciones.', '<a class="btn btn--azul" href="#/explorar">Descubrir perfiles</a>')
        : vacio('imagen', 'Todavía no hay publicaciones', '¡Sé la primera en compartir algo!', '<a class="btn btn--verde" href="#/crear">Crear publicación</a>')}</div>`;
    }
  };
  $('#feed-mas button').onclick = async function () { this.disabled = true; await cargar().catch(avisoError); this.disabled = false; };
  await cargar();
  pintarLateral().catch(e => console.warn(e));
});

async function contarConexiones(id) {
  const [a, b, c] = await Promise.all([
    sb.from('seguidores').select('seguidor_id', { count: 'exact', head: true }).eq('seguido_id', id),
    sb.from('seguidores').select('seguido_id', { count: 'exact', head: true }).eq('seguidor_id', id),
    sb.from('publicaciones').select('id', { count: 'exact', head: true }).eq('autor_id', id).eq('estado', 'publicada').lte('fecha_publicacion', new Date().toISOString()),
  ]);
  return { seguidores: a.count || 0, siguiendo: b.count || 0, publicaciones: c.count || 0 };
}

async function pintarLateral() {
  const p = estado.perfil;
  const [n, candidatos] = await Promise.all([
    contarConexiones(p.id),
    ejecutar(sb.from('usuarios_sociales').select(CAMPOS_USUARIO).eq('estado', 'activo').neq('id', p.id).order('fecha_creacion', { ascending: false }).limit(40)),
  ]);
  const sugerencias = candidatos.filter(u => !estado.siguiendo.has(u.id)).sort(() => Math.random() - .5).slice(0, 5);
  const lat = $('#lateral');
  if (!lat) return;
  lat.innerHTML = `
    <div class="tarjeta" style="text-align:center">
      <div style="display:flex;justify-content:center;margin-bottom:10px">${avatar(p, 'lg')}</div>
      <h3 style="font-size:17px">${esc(p.nombre_completo)}</h3>
      <p class="texto-suave chico">@${esc(p.nombre_usuario)}</p>
      <div style="display:flex;justify-content:space-around;margin:16px 0 14px">
        <div><b style="font-size:18px">${n.publicaciones}</b><br><span class="texto-suave chico">Publicaciones</span></div>
        <a href="#/seguidores" style="color:inherit"><b style="font-size:18px">${n.seguidores}</b><br><span class="texto-suave chico">Seguidores</span></a>
        <a href="#/seguidores?tab=siguiendo" style="color:inherit"><b style="font-size:18px">${n.siguiendo}</b><br><span class="texto-suave chico">Siguiendo</span></a>
      </div>
      <a class="btn btn--gris btn--bloque btn--chico" href="#/perfil/${esc(p.nombre_usuario)}">Ver mi perfil</a>
    </div>
    ${sugerencias.length ? `<div class="tarjeta">
      <div class="tarjeta__cabeza" style="margin-bottom:6px"><h3>Sugerencias para seguir</h3><a href="#/explorar" class="chico">Ver todas</a></div>
      <div class="lista">${sugerencias.map(u => `<div class="lista__fila">${persona(u, '', 'sm')}${botonSeguir(u.id)}</div>`).join('')}</div>
    </div>` : ''}
    <div class="tarjeta">
      <div class="tarjeta__cabeza" style="margin-bottom:8px"><h3>Normas de la comunidad</h3></div>
      <p class="texto-suave chico">Respeta a las demás, no compartas datos personales y reporta lo que te haga sentir incómoda.</p>
      <a href="#/normas" class="chico" style="display:inline-block;margin-top:10px">Leer normas completas</a>
    </div>`;
}

/* ---------- Publicación individual ---------- */
ruta(/^\/publicacion\/([\w-]+)$/, async ([id]) => {
  cabecera('Publicación', [['Publicación']]);
  const p = await ejecutar(sb.from('publicaciones').select(SELECT_POST).eq('id', id).maybeSingle());
  if (!p) { vista().innerHTML = `<div class="tarjeta" style="max-width:720px;margin:0 auto">${vacio('ojoNo', 'Publicación no disponible', 'Puede que se haya eliminado o que no tengas permiso para verla.', '<a class="btn btn--azul" href="#/inicio">Volver al inicio</a>')}</div>`; return; }
  vista().innerHTML = `<div style="max-width:720px;margin:0 auto" class="columna">
    <a href="javascript:history.back()" class="btn btn--borde btn--chico" style="align-self:flex-start">${icono('atras')}Volver</a>
    ${tarjetaPost(p)}</div>`;
  await abrirComentarios(id);
});

/* =====================================================
   CREAR / EDITAR PUBLICACIÓN
   ===================================================== */
ruta(/^\/crear$/, () => vistaCrear(null));
ruta(/^\/editar\/([\w-]+)$/, ([id]) => vistaCrear(id));

function aLocal(fecha) {
  const d = new Date(fecha), z = n => String(n).padStart(2, '0');
  return { fecha: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, hora: `${z(d.getHours())}:${z(d.getMinutes())}` };
}

async function vistaCrear(id) {
  const cfg = estado.config;
  let p = null;
  if (id) {
    p = await ejecutar(sb.from('publicaciones').select(SELECT_POST).eq('id', id).maybeSingle());
    if (!p || p.autor_id !== yo()) { cabecera('Editar publicación'); vista().innerHTML = `<div class="tarjeta">${vacio('ojoNo', 'No se encontró la publicación')}</div>`; return; }
  }
  cabecera(p ? 'Editar publicación' : 'Crear publicación', [['Mis publicaciones', '#/mis-publicaciones'], [p ? 'Editar' : 'Crear publicación']]);

  const f = {
    medios: p ? [...p.medios] : [],
    etiquetas: p ? (p.publicacion_etiquetas || []).map(e => e.usuario).filter(Boolean) : [],
  };
  const etiquetasOriginales = f.etiquetas.map(u => u.id);
  const yaPublicada = p && p.estado !== 'borrador' && yaSalio(p);
  const prog = p?.programada_para && !yaPublicada ? aLocal(p.programada_para) : { fecha: '', hora: '' };
  const hoy = aLocal(new Date()).fecha;
  let biblioteca = [];

  vista().innerHTML = `<div class="crear">
    <div class="crear__envoltorio">
      <div class="tarjeta__cabeza">
        <div><h2>${p ? 'Editar publicación' : 'Crear publicación'}</h2><p>Crea y programa tu próxima publicación fácilmente.</p></div>
        ${p ? badgeEstadoPost(p) : '<span class="badge badge--azul">Nueva</span>'}
      </div>
      <div class="crear__cuerpo">
        <div class="tarjeta">
          <div class="tarjeta__cabeza" style="margin-bottom:14px"><div><h3>Subir medios</h3><p>Comparte fotos o un video (máx. ${cfg.max_imagenes})</p></div></div>
          <label class="zona-subida" id="zona-subida">
            ${icono('subir')}<b id="zona-texto">Haz clic para subir o arrastra y suelta</b><small>Imagen, video o carrusel · hasta 20 MB</small>
            <input type="file" id="input-archivos" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" multiple hidden>
          </label>
          <div class="separador">o agrega desde tu biblioteca</div>
          <div class="tarjeta__cabeza" style="margin-bottom:10px"><div><h3>Biblioteca de medios</h3><p id="bib-total">Cargando…</p></div></div>
          <div class="biblioteca" id="biblioteca"></div>
          <div class="seleccionados" id="seleccionados"></div>
        </div>

        <div class="tarjeta form-post">
          <label class="campo"><span>Título</span>
            <input id="f-titulo" maxlength="120" placeholder="Agrega un título" value="${esc(p?.titulo || '')}"></label>
          <label class="campo"><span>Descripción</span>
            <textarea id="f-contenido" maxlength="${cfg.max_caracteres}" placeholder="Escribe algo… puedes usar #hashtags">${esc(p?.contenido || '')}</textarea>
            <span class="contador" id="f-contador"></span></label>
          <label class="campo"><span>Ubicación</span>
            <div class="campo__icono">${icono('ubicacion')}<input id="f-ubicacion" list="lugares" maxlength="120" placeholder="Agregar ubicación" value="${esc(p?.ubicacion || '')}"></div>
            <datalist id="lugares">${['Colegio', 'Salón de clases', 'Biblioteca', 'Laboratorio', 'Cancha deportiva', 'Ciudad de Guatemala', 'Antigua Guatemala', 'Quetzaltenango', 'Lago de Atitlán', 'Petén'].map(l => `<option value="${l}">`).join('')}</datalist></label>
          <div class="campo"><span>Etiquetar</span>
            <div style="position:relative">
              <div class="campo__icono">${icono('personaMas')}<input id="f-etiqueta" placeholder="Agrega personas por nombre o usuario" autocomplete="off"></div>
              <div class="sugerencias" id="sug-etiquetas" hidden></div>
            </div>
            <div class="chips" id="chips-etiquetas"></div></div>
          ${yaPublicada
            ? `<div class="alerta alerta--info">Publicada el ${fechaHora(p.fecha_publicacion)}.</div>`
            : `<div class="campo"><span>Programar publicación <small>(opcional)</small></span>
                <div class="fila">
                  <div><div class="campo__icono" id="c-fecha">${icono('calendario')}<input type="date" id="f-fecha" min="${hoy}" value="${prog.fecha}"></div><small class="error-campo" id="e-fecha" hidden>Por favor elige una fecha.</small></div>
                  <div><div class="campo__icono" id="c-hora">${icono('reloj')}<input type="time" id="f-hora" value="${prog.hora}"></div><small class="error-campo" id="e-hora" hidden>La hora es obligatoria.</small></div>
                </div></div>`}
          <div class="campo"><span>Visibilidad</span>
            ${Object.entries(VISIBILIDAD).map(([k, v]) => `<label class="radio"><input type="radio" name="f-vis" value="${k}" ${(p?.visibilidad || 'publica') === k ? 'checked' : ''}> ${v.texto}</label>`).join('')}
          </div>
          <label class="interruptor"><input type="checkbox" id="f-comentarios" ${p && !p.permitir_comentarios ? '' : 'checked'}> Permitir comentarios</label>
          ${cfg.moderacion_previa && !esModerador() ? '<div class="alerta alerta--aviso chico">La comunidad tiene moderación previa: una docente revisará tu publicación antes de que se muestre.</div>' : ''}
        </div>
      </div>
      <div class="crear__botones">
        <a class="btn btn--gris" href="${p ? '#/mis-publicaciones' : '#/inicio'}">Cancelar</a>
        ${!yaPublicada ? '<button class="btn btn--borde" id="btn-borrador">Guardar borrador</button>' : ''}
        <button class="btn btn--verde" id="btn-publicar">Publicar</button>
      </div>
    </div>

    <aside class="vista-previa">
      <h3>Vista previa</h3>
      <div class="telefono">
        <div class="telefono__cabeza">${avatar(estado.perfil, 'xs')}<span>${esc(estado.perfil.nombre_usuario)}</span><span style="margin-left:auto;color:var(--suave)" id="pv-vis"></span></div>
        <div class="telefono__medio" id="pv-medio"></div>
        <div class="telefono__acciones">${icono('corazon')}${icono('comentario')}${icono('enviar')}</div>
        <div class="telefono__texto" id="pv-texto"></div>
      </div>
      <p class="texto-suave chico" style="margin-top:12px">Así se verá tu publicación en el inicio.</p>
    </aside>
  </div>`;

  const el = s => $(s, vista());

  /* --- vista previa --- */
  const actualizarPrevia = () => {
    const t = el('#f-titulo').value.trim(), c = el('#f-contenido').value, u = el('#f-ubicacion').value.trim();
    el('#f-contador').textContent = `${c.length} / ${cfg.max_caracteres}`;
    el('#pv-medio').innerHTML = f.medios.length
      ? medioHTML(f.medios[0], 'muted playsinline') + (f.medios.length > 1 ? `<span class="carrusel__contador">1/${f.medios.length}</span>` : '')
      : icono('imagen');
    el('#pv-texto').innerHTML = (u ? `<div class="post__meta" style="margin-bottom:6px">${icono('ubicacion')}${esc(u)}</div>` : '')
      + (t ? `<b>${esc(t)}</b><br>` : '') + (c ? formatearTexto(c) : (t ? '' : '<span class="texto-suave">Tu texto aparecerá aquí…</span>'))
      + (f.etiquetas.length ? `<div class="texto-suave" style="margin-top:6px">con ${f.etiquetas.map(x => '@' + esc(x.nombre_usuario)).join(', ')}</div>` : '');
    const vis = el('input[name="f-vis"]:checked').value;
    el('#pv-vis').innerHTML = icono(VISIBILIDAD[vis].icono);
    const programando = !yaPublicada && el('#f-fecha').value && el('#f-hora').value;
    el('#btn-publicar').innerHTML = p && yaPublicada ? 'Guardar cambios' : programando ? `${icono('calendario')}Programar` : 'Publicar';
  };
  ['#f-titulo', '#f-contenido', '#f-ubicacion'].forEach(s => el(s).addEventListener('input', actualizarPrevia));
  $$('input[name="f-vis"]', vista()).forEach(r => r.addEventListener('change', actualizarPrevia));
  if (!yaPublicada) ['#f-fecha', '#f-hora'].forEach(s => el(s).addEventListener('input', () => {
    el('#e-fecha').hidden = el('#e-hora').hidden = true;
    el('#c-fecha').classList.remove('campo--error'); el('#c-hora').classList.remove('campo--error');
    actualizarPrevia();
  }));

  /* --- biblioteca y seleccionados --- */
  const pintarBiblioteca = () => {
    const todos = [...new Set([...f.medios.filter(u => !biblioteca.includes(u)), ...biblioteca])];
    el('#bib-total').textContent = `Todos (${todos.length})`;
    el('#biblioteca').innerHTML = `<label class="biblioteca__item biblioteca__agregar" for="input-archivos" title="Subir">${icono('mas')}</label>`
      + todos.map(u => {
        const sel = f.medios.includes(u);
        return `<button type="button" class="biblioteca__item ${sel ? 'sel' : ''}" data-url="${esc(u)}">${medioHTML(u, 'muted playsinline preload="metadata"')}<span class="marca">${sel ? icono('check') : ''}</span></button>`;
      }).join('');
    $$('.biblioteca__item[data-url]', vista()).forEach(b => b.onclick = () => alternarMedio(b.dataset.url));
    el('#seleccionados').innerHTML = f.medios.map((u, i) => `<div class="seleccionado">
        ${medioHTML(u, 'muted playsinline')}<span>${i === 0 ? 'Portada · ' : ''}${esc(decodeURIComponent(u.split('/').pop()).replace(/^\d+-/, ''))}</span>
        ${i > 0 ? `<button class="btn-icono" data-sube="${i}" title="Mover antes">${icono('izq')}</button>` : ''}
        <button class="btn-icono" data-quita="${i}" title="Quitar">${icono('basura')}</button></div>`).join('');
    $$('[data-quita]', vista()).forEach(b => b.onclick = () => { f.medios.splice(+b.dataset.quita, 1); pintarBiblioteca(); });
    $$('[data-sube]', vista()).forEach(b => b.onclick = () => { const i = +b.dataset.sube; [f.medios[i - 1], f.medios[i]] = [f.medios[i], f.medios[i - 1]]; pintarBiblioteca(); });
    actualizarPrevia();
  };
  const alternarMedio = url => {
    const i = f.medios.indexOf(url);
    if (i >= 0) f.medios.splice(i, 1);
    else if (f.medios.length >= cfg.max_imagenes) return aviso(`Puedes elegir máximo ${cfg.max_imagenes} archivos`, 'error');
    else f.medios.push(url);
    pintarBiblioteca();
  };
  const cargarBiblioteca = async () => {
    try {
      const archivos = await ejecutar(sb.storage.from('medios').list(yo(), { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }));
      biblioteca = archivos.filter(a => a.id && !a.name.startsWith('avatar-'))
        .map(a => sb.storage.from('medios').getPublicUrl(`${yo()}/${a.name}`).data.publicUrl);
    } catch (e) { console.warn(e); }
    pintarBiblioteca();
  };
  const subir = async archivos => {
    archivos = [...archivos];
    if (!archivos.length) return;
    const zona = el('#zona-texto');
    for (let i = 0; i < archivos.length; i++) {
      zona.textContent = `Subiendo ${i + 1} de ${archivos.length}…`;
      try {
        const url = await subirArchivo(archivos[i]);
        biblioteca.unshift(url);
        if (f.medios.length < cfg.max_imagenes) f.medios.push(url);
        pintarBiblioteca();
      } catch (e) { avisoError(e); }
    }
    zona.textContent = 'Haz clic para subir o arrastra y suelta';
  };
  el('#input-archivos').onchange = e => { subir(e.target.files); e.target.value = ''; };
  const zona = el('#zona-subida');
  ['dragenter', 'dragover'].forEach(t => zona.addEventListener(t, e => { e.preventDefault(); zona.classList.add('arrastrando'); }));
  ['dragleave', 'drop'].forEach(t => zona.addEventListener(t, e => { e.preventDefault(); zona.classList.remove('arrastrando'); }));
  zona.addEventListener('drop', e => subir(e.dataTransfer.files));

  /* --- etiquetas --- */
  const pintarChips = () => {
    el('#chips-etiquetas').innerHTML = f.etiquetas.map((u, i) =>
      `<span class="chip">${avatar(u, 'xs')}@${esc(u.nombre_usuario)}<button type="button" data-quitar-et="${i}" aria-label="Quitar">×</button></span>`).join('');
    $$('[data-quitar-et]', vista()).forEach(b => b.onclick = () => { f.etiquetas.splice(+b.dataset.quitarEt, 1); pintarChips(); actualizarPrevia(); });
  };
  let tBusqueda;
  el('#f-etiqueta').addEventListener('input', e => {
    clearTimeout(tBusqueda);
    const t = e.target.value.trim().replace(/[%,()*\\]/g, '').replace(/^@/, '');
    const caja = el('#sug-etiquetas');
    if (t.length < 2) { caja.hidden = true; return; }
    tBusqueda = setTimeout(async () => {
      const res = await ejecutar(sb.from('usuarios_sociales').select(CAMPOS_USUARIO).eq('estado', 'activo').neq('id', yo())
        .or(`nombre_completo.ilike.%${t}%,nombre_usuario.ilike.%${t}%`).limit(6));
      const nuevos = res.filter(u => !f.etiquetas.some(x => x.id === u.id));
      caja.hidden = false;
      caja.innerHTML = nuevos.length ? nuevos.map(u => `<button type="button" data-id="${u.id}">${persona({ ...u }, '', 'sm').replace(/^<a /, '<div ').replace(/<\/a>$/, '</div>')}</button>`).join('')
        : '<p class="texto-suave chico" style="padding:8px">Sin resultados</p>';
      $$('button', caja).forEach(b => b.onclick = () => {
        f.etiquetas.push(nuevos.find(u => u.id === b.dataset.id));
        el('#f-etiqueta').value = ''; caja.hidden = true; pintarChips(); actualizarPrevia();
      });
    }, 250);
  });
  el('#f-etiqueta').addEventListener('blur', () => setTimeout(() => { const c = el('#sug-etiquetas'); if (c) c.hidden = true; }, 200));

  /* --- guardar --- */
  const guardar = async (destino, boton) => {
    const titulo = el('#f-titulo').value.trim();
    const contenido = el('#f-contenido').value.trim();
    let programada = p?.programada_para || null;
    if (!yaPublicada) {
      const fe = el('#f-fecha').value, ho = el('#f-hora').value;
      let mal = false;
      if (ho && !fe) { el('#e-fecha').hidden = false; el('#c-fecha').classList.add('campo--error'); mal = true; }
      if (fe && !ho) { el('#e-hora').hidden = false; el('#c-hora').classList.add('campo--error'); mal = true; }
      if (mal) return;
      programada = fe && ho ? new Date(`${fe}T${ho}`).toISOString() : null;
      if (programada && destino === 'publicada' && new Date(programada) < new Date()) {
        el('#e-hora').hidden = false; el('#e-hora').textContent = 'Elige una fecha y hora futuras.'; el('#c-hora').classList.add('campo--error'); return;
      }
    }
    if (destino === 'publicada' && !contenido && !f.medios.length && !titulo) return aviso('Escribe algo o agrega una imagen', 'error');

    const datos = {
      titulo: titulo || null, contenido, medios: f.medios,
      ubicacion: el('#f-ubicacion').value.trim() || null,
      visibilidad: el('input[name="f-vis"]:checked').value,
      permitir_comentarios: el('#f-comentarios').checked,
      estado: yaPublicada ? p.estado : destino,
      programada_para: programada,
    };
    const texto = boton.innerHTML;
    boton.disabled = true; boton.innerHTML = '<span class="spinner spinner--chico"></span>';
    try {
      const g = p
        ? await ejecutar(sb.from('publicaciones').update(datos).eq('id', p.id).select('id,estado,fecha_publicacion').single())
        : await ejecutar(sb.from('publicaciones').insert({ ...datos, autor_id: yo() }).select('id,estado,fecha_publicacion').single());
      const nuevos = f.etiquetas.map(u => u.id);
      const quitar = etiquetasOriginales.filter(x => !nuevos.includes(x));
      const agregar = nuevos.filter(x => !etiquetasOriginales.includes(x));
      if (quitar.length) await ejecutar(sb.from('publicacion_etiquetas').delete().eq('publicacion_id', g.id).in('usuario_id', quitar));
      if (agregar.length) await ejecutar(sb.from('publicacion_etiquetas').insert(agregar.map(u => ({ publicacion_id: g.id, usuario_id: u }))));

      if (g.estado === 'borrador') { aviso('Borrador guardado', 'exito'); location.hash = '#/mis-publicaciones?tab=borrador'; }
      else if (g.estado === 'en_revision') { aviso('Tu publicación será revisada por el equipo docente antes de mostrarse.'); location.hash = '#/mis-publicaciones?tab=en_revision'; }
      else if (!yaSalio(g)) { aviso(`Publicación programada para el ${fechaHora(g.fecha_publicacion)}`, 'exito'); location.hash = '#/mis-publicaciones?tab=programada'; }
      else { aviso(p ? 'Cambios guardados' : '¡Publicación compartida!', 'exito'); location.hash = '#/publicacion/' + g.id; }
    } catch (e) { avisoError(e); boton.disabled = false; boton.innerHTML = texto; }
  };
  el('#btn-publicar').onclick = e => guardar('publicada', e.currentTarget);
  if (el('#btn-borrador')) el('#btn-borrador').onclick = e => guardar('borrador', e.currentTarget);

  pintarChips();
  pintarBiblioteca();
  cargarBiblioteca();
}

/* =====================================================
   MIS PUBLICACIONES
   ===================================================== */
ruta(/^\/mis-publicaciones$/, async (_, params) => {
  cabecera('Mis publicaciones', [['Mis publicaciones']]);
  const lista = await ejecutar(sb.from('publicaciones')
    .select('id,titulo,contenido,medios,estado,visibilidad,fecha_publicacion,programada_para,motivo_moderacion,reacciones(count),comentarios(count)')
    .eq('autor_id', yo()).order('fecha_creacion', { ascending: false }));
  const pestanas = [['todas', 'Todas'], ['publicada', 'Publicadas'], ['programada', 'Programadas'], ['borrador', 'Borradores'], ['en_revision', 'En revisión'], ['oculta', 'Ocultas']];
  let actual = pestanas.some(x => x[0] === params.tab) ? params.tab : 'todas';

  const pintar = () => {
    const filtrada = lista.filter(p => actual === 'todas' || estadoPost(p).clave === actual);
    vista().innerHTML = `<div class="contenedor">
      <div class="barra-herr">
        <div class="pestanas">${pestanas.map(([k, t]) => {
          const n = k === 'todas' ? lista.length : lista.filter(p => estadoPost(p).clave === k).length;
          return `<button class="pestana ${k === actual ? 'activa' : ''}" data-tab="${k}">${t}<span class="num">${n}</span></button>`;
        }).join('')}</div>
        <a class="btn btn--verde" href="#/crear">${icono('mas')}Nueva publicación</a>
      </div>
      <div class="tarjeta">
        ${filtrada.length ? `<div class="lista">${filtrada.map(p => {
          const e = estadoPost(p);
          return `<div class="lista__fila" style="align-items:flex-start;flex-wrap:wrap">
            ${p.medios[0] ? (esVideo(p.medios[0]) ? `<span class="miniatura">${icono('imagen')}</span>` : `<img class="miniatura" src="${esc(p.medios[0])}" alt="">`) : `<span class="miniatura">${icono('documento')}</span>`}
            <div style="flex:1;min-width:200px">
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:4px">
                <b>${esc(p.titulo || 'Sin título')}</b>${badgeEstadoPost(p)}<span class="badge badge--gris">${icono(VISIBILIDAD[p.visibilidad].icono)}${VISIBILIDAD[p.visibilidad].texto}</span>
              </div>
              <p class="recorte chico">${esc(p.contenido || '(sin texto)')}</p>
              ${p.motivo_moderacion && ['oculta', 'en_revision'].includes(p.estado) ? `<p class="chico" style="color:var(--rojo);margin-top:4px">${esc(p.motivo_moderacion)}</p>` : ''}
              <p class="texto-suave chico" style="margin-top:6px">${e.clave === 'programada' ? 'Se publicará el ' : ''}${fechaHora(p.fecha_publicacion)} · ❤️ ${p.reacciones[0]?.count || 0} · 💬 ${p.comentarios[0]?.count || 0}</p>
            </div>
            <div style="display:flex;gap:6px">
              ${e.clave !== 'borrador' ? `<a class="btn btn--gris btn--chico" href="#/publicacion/${p.id}">${icono('ojo')}Ver</a>` : ''}
              ${p.estado !== 'oculta' ? `<a class="btn btn--gris btn--chico" href="#/editar/${p.id}">${icono('editar')}Editar</a>` : ''}
              <button class="btn btn--rojo-suave btn--chico" data-borrar="${p.id}">${icono('basura')}</button>
            </div>
          </div>`;
        }).join('')}</div>` : vacio('publicaciones', 'No hay publicaciones aquí', 'Cuando crees publicaciones aparecerán en esta lista.')}
      </div></div>`;
    $$('[data-tab]', vista()).forEach(b => b.onclick = () => { actual = b.dataset.tab; pintar(); });
    $$('[data-borrar]', vista()).forEach(b => b.onclick = () => eliminarPublicacion(b.dataset.borrar, () => navegar()).catch(avisoError));
  };
  pintar();
});

/* =====================================================
   PERFILES (EXPLORAR)
   ===================================================== */
ruta(/^\/explorar$/, async () => {
  cabecera('Perfiles', [['Perfiles']]);
  const usuarios = await ejecutar(sb.from('usuarios_sociales').select(CAMPOS_USUARIO + ',biografia')
    .eq('estado', 'activo').neq('id', yo()).order('nombre_completo'));
  vista().innerHTML = `<div class="contenedor">
    <div class="barra-herr">
      <div class="buscador">${icono('buscar')}<input id="buscar-personas" placeholder="Buscar por nombre o usuario"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <select class="select-chico" id="filtro-rol"><option value="">Todos los roles</option><option value="estudiante">Estudiantes</option><option value="docente">Docentes</option><option value="administrador">Administración</option></select>
        <select class="select-chico" id="filtro-seg"><option value="">Todas</option><option value="si">Las que sigo</option><option value="no">Las que no sigo</option></select>
      </div>
    </div>
    <div class="grid-personas" id="grid-personas"></div></div>`;
  const pintar = () => {
    const t = sinAcentos($('#buscar-personas').value.toLowerCase());
    const rol = $('#filtro-rol').value, seg = $('#filtro-seg').value;
    const res = usuarios.filter(u =>
      (!t || sinAcentos((u.nombre_completo + ' ' + u.nombre_usuario).toLowerCase()).includes(t))
      && (!rol || u.rol === rol)
      && (!seg || (seg === 'si') === estado.siguiendo.has(u.id)));
    $('#grid-personas').innerHTML = res.length ? res.map(u => `<div class="tarjeta-persona">
        <a href="#/perfil/${esc(u.nombre_usuario)}">${avatar(u, 'lg')}</a>
        <a href="#/perfil/${esc(u.nombre_usuario)}"><h3>${esc(u.nombre_completo)}</h3></a>
        <span class="texto-suave chico">@${esc(u.nombre_usuario)} ${badgeRol(u.rol, true)}</span>
        <p>${esc(u.biografia || 'Sin biografía todavía.')}</p>
        ${botonSeguir(u.id, false)}
      </div>`).join('') : `<div class="tarjeta" style="grid-column:1/-1">${vacio('buscar', 'No se encontraron perfiles')}</div>`;
  };
  ['#buscar-personas', '#filtro-rol', '#filtro-seg'].forEach(s => $(s).addEventListener('input', pintar));
  pintar();
});

/* ---------- Perfil individual ---------- */
ruta(/^\/perfil\/([a-z0-9._]+)$/, async ([usuario]) => {
  const u = await ejecutar(sb.from('usuarios_sociales').select('*').eq('nombre_usuario', usuario).maybeSingle());
  if (!u) { cabecera('Perfil'); vista().innerHTML = `<div class="tarjeta">${vacio('persona', 'Perfil no disponible', 'La cuenta no existe o no está activa.')}</div>`; return; }
  const mio = u.id === yo();
  cabecera(mio ? 'Mi perfil' : u.nombre_completo, [['Perfiles', '#/explorar'], [u.nombre_completo]]);
  const [n, posts] = await Promise.all([
    contarConexiones(u.id),
    ejecutar(sb.from('publicaciones').select(SELECT_POST).eq('autor_id', u.id).order('fecha_publicacion', { ascending: false }).limit(30)),
  ]);
  const visibles = posts.filter(p => p.estado !== 'borrador' && (!mio || (p.estado === 'publicada' && yaSalio(p))));
  vista().innerHTML = `<div style="max-width:900px;margin:0 auto" class="columna">
    <div class="perfil-cabeza">
      <div class="perfil-portada"></div>
      <div class="perfil-info">
        ${avatar(u, 'xl')}
        <div class="perfil-info__txt">
          <h2>${esc(u.nombre_completo)} ${badgeRol(u.rol, true)} ${u.estado !== 'activo' ? badgeEstadoUsuario(u.estado) : ''}</h2>
          <span class="texto-suave">@${esc(u.nombre_usuario)}</span>
          ${u.biografia ? `<p>${formatearTexto(u.biografia)}</p>` : ''}
        </div>
        <div class="perfil-info__acciones">
          ${mio ? `<a class="btn btn--gris" href="#/mi-perfil">${icono('editar')}Editar perfil</a>`
                : `${botonSeguir(u.id, false)}<div class="desplegable"><button class="btn btn--gris" data-menu data-accion="menu-perfil" data-id="${u.id}" data-usuario="${esc(u.nombre_usuario)}" aria-label="Más opciones">${icono('puntos')}</button></div>`}
        </div>
      </div>
      <div class="perfil-stats">
        <div><b>${n.publicaciones}</b>publicaciones</div>
        <a href="#/perfil/${esc(u.nombre_usuario)}/conexiones"><b id="cnt-seguidores" data-id="${u.id}">${n.seguidores}</b>seguidores</a>
        <a href="#/perfil/${esc(u.nombre_usuario)}/conexiones?tab=siguiendo"><b>${n.siguiendo}</b>siguiendo</a>
      </div>
    </div>
    ${visibles.length ? visibles.map(tarjetaPost).join('') : `<div class="tarjeta">${vacio('imagen', 'Sin publicaciones', mio ? 'Comparte tu primera publicación.' : 'Esta persona todavía no ha publicado nada que puedas ver.')}</div>`}
  </div>`;
});
ACCIONES['menu-perfil'] = el => abrirMenu(el, [
  { icono: 'bandera', texto: 'Reportar perfil', fn: () => reportar({ tipo_objetivo: 'usuario', usuario_reportado_id: el.dataset.id }) },
  { icono: 'personas', texto: 'Ver seguidores', fn: () => { location.hash = `#/perfil/${el.dataset.usuario}/conexiones`; } },
  esAdmin() && { icono: 'ajustes', texto: 'Administrar cuenta', fn: () => { location.hash = `#/admin/usuarios?buscar=${el.dataset.usuario}`; } },
]);

/* =====================================================
   SEGUIDORES
   ===================================================== */
ruta(/^\/seguidores$/, (_, params) => vistaConexiones(estado.perfil, params.tab));
ruta(/^\/perfil\/([a-z0-9._]+)\/conexiones$/, async ([usuario], params) => {
  const u = await ejecutar(sb.from('usuarios_sociales').select('*').eq('nombre_usuario', usuario).maybeSingle());
  if (!u) { vista().innerHTML = `<div class="tarjeta">${vacio('persona', 'Perfil no disponible')}</div>`; return; }
  return vistaConexiones(u, params.tab);
});
async function vistaConexiones(u, tab) {
  const mio = u.id === yo();
  cabecera(mio ? 'Seguidores' : `Conexiones de ${u.nombre_completo.split(' ')[0]}`,
    mio ? [['Seguidores']] : [['Perfiles', '#/explorar'], [u.nombre_completo, `#/perfil/${u.nombre_usuario}`], ['Conexiones']]);
  const campos = CAMPOS_USUARIO + ',biografia';
  const [seguidores, siguiendo] = await Promise.all([
    ejecutar(sb.from('seguidores').select(`fecha_creacion, persona:usuarios_sociales!seguidores_seguidor_id_fkey(${campos})`).eq('seguido_id', u.id).order('fecha_creacion', { ascending: false })),
    ejecutar(sb.from('seguidores').select(`fecha_creacion, persona:usuarios_sociales!seguidores_seguido_id_fkey(${campos})`).eq('seguidor_id', u.id).order('fecha_creacion', { ascending: false })),
  ]);
  const datos = { seguidores: seguidores.filter(x => x.persona), siguiendo: siguiendo.filter(x => x.persona) };
  let actual = tab === 'siguiendo' ? 'siguiendo' : 'seguidores';
  const pintar = () => {
    const lista = datos[actual];
    vista().innerHTML = `<div style="max-width:760px;margin:0 auto">
      <div class="barra-herr"><div class="pestanas">
        <button class="pestana ${actual === 'seguidores' ? 'activa' : ''}" data-tab="seguidores">${mio ? 'Mis seguidores' : 'Seguidores'}<span class="num">${datos.seguidores.length}</span></button>
        <button class="pestana ${actual === 'siguiendo' ? 'activa' : ''}" data-tab="siguiendo">${mio ? 'Sigo a' : 'Siguiendo'}<span class="num">${datos.siguiendo.length}</span></button>
      </div></div>
      <div class="tarjeta">${lista.length ? `<div class="lista">${lista.map(x => `<div class="lista__fila">
          ${persona(x.persona, ` · ${actual === 'seguidores' ? 'te sigue desde' : 'desde'} ${fechaCorta(x.fecha_creacion)}`)}
          ${badgeRol(x.persona.rol, true)}
          ${x.persona.id !== yo() ? botonSeguir(x.persona.id) : ''}
        </div>`).join('')}</div>`
        : vacio('personas', actual === 'seguidores' ? 'Aún no hay seguidores' : 'Aún no sigue a nadie', mio ? 'Explora perfiles para conectar con tu comunidad.' : '', mio ? '<a class="btn btn--azul" href="#/explorar">Explorar perfiles</a>' : '')}
      </div></div>`;
    $$('[data-tab]', vista()).forEach(b => b.onclick = () => { actual = b.dataset.tab; pintar(); });
  };
  pintar();
}

/* =====================================================
   NOTIFICACIONES
   ===================================================== */
const TIPOS_NOTIF = {
  reaccion: ['❤️', 'ic-rojo'], comentario: ['💬', 'ic-azul'], seguidor: ['👤', 'ic-verde'],
  mencion: ['@', 'ic-morado'], moderacion: ['🛡️', 'ic-naranja'], sistema: ['✔️', 'ic-verde'],
};
ruta(/^\/notificaciones$/, async () => {
  cabecera('Notificaciones', [['Notificaciones']]);
  const lista = await ejecutar(sb.from('notificaciones')
    .select(`*, actor:usuarios_sociales!notificaciones_actor_id_fkey(${CAMPOS_USUARIO})`)
    .order('fecha_creacion', { ascending: false }).limit(80));
  let soloNuevas = false;
  const pintar = () => {
    const filtrada = soloNuevas ? lista.filter(n => !n.leida) : lista;
    const nuevas = lista.filter(n => !n.leida).length;
    vista().innerHTML = `<div style="max-width:760px;margin:0 auto">
      <div class="barra-herr">
        <div class="pestanas">
          <button class="pestana ${soloNuevas ? '' : 'activa'}" data-f="0">Todas</button>
          <button class="pestana ${soloNuevas ? 'activa' : ''}" data-f="1">No leídas<span class="num">${nuevas}</span></button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn--borde btn--chico" id="marcar-todas" ${nuevas ? '' : 'disabled'}>${icono('check')}Marcar todas como leídas</button>
          <button class="btn btn--borde btn--chico" id="borrar-leidas">${icono('basura')}Borrar leídas</button>
        </div>
      </div>
      <div class="tarjeta" style="padding:10px">${filtrada.length ? filtrada.map(n => {
        const [emo, cls] = TIPOS_NOTIF[n.tipo] || TIPOS_NOTIF.sistema;
        return `<div class="notif ${n.leida ? '' : 'nueva'}" data-id="${n.id}">
          <div class="notif__ic">${avatar(n.actor)}<span class="notif__tipo ${cls}">${emo}</span></div>
          <div class="notif__txt"><p><b>${esc(n.actor?.nombre_completo || 'La comunidad')}</b> ${esc(n.mensaje)}</p><small>${tiempo(n.fecha_creacion)}</small></div>
        </div>`;
      }).join('') : vacio('campana', soloNuevas ? '¡Estás al día!' : 'Sin notificaciones', 'Aquí verás reacciones, comentarios, nuevas seguidoras y avisos.')}</div></div>`;

    $$('[data-f]', vista()).forEach(b => b.onclick = () => { soloNuevas = b.dataset.f === '1'; pintar(); });
    $$('.notif', vista()).forEach(div => div.onclick = async () => {
      const n = lista.find(x => x.id === div.dataset.id);
      if (!n.leida) { n.leida = true; sb.from('notificaciones').update({ leida: true }).eq('id', n.id).then(actualizarContadores); }
      if (n.publicacion_id) location.hash = '#/publicacion/' + n.publicacion_id;
      else if (n.tipo === 'seguidor' && n.actor) location.hash = '#/perfil/' + n.actor.nombre_usuario;
      else pintar();
    });
    $('#marcar-todas').onclick = async () => {
      await ejecutar(sb.from('notificaciones').update({ leida: true }).eq('destinatario_id', yo()).eq('leida', false));
      lista.forEach(n => { n.leida = true; }); actualizarContadores(); pintar();
    };
    $('#borrar-leidas').onclick = async () => {
      if (!await confirmar({ titulo: 'Borrar notificaciones leídas', mensaje: 'Se eliminarán todas las notificaciones que ya leíste.', boton: 'Borrar', peligro: true })) return;
      await ejecutar(sb.from('notificaciones').delete().eq('destinatario_id', yo()).eq('leida', true));
      lista.splice(0, lista.length, ...lista.filter(n => !n.leida)); pintar();
    };
  };
  pintar();
});

/* =====================================================
   MI PERFIL
   ===================================================== */
ruta(/^\/mi-perfil$/, async () => {
  cabecera('Mi perfil', [['Mi perfil']]);
  const p = estado.perfil;
  const f = { avatar_url: p.avatar_url || '', color: p.color_avatar };
  vista().innerHTML = `<div style="max-width:820px;margin:0 auto" class="columna">
    <div class="tarjeta">
      <div class="tarjeta__cabeza"><div><h2>Mi perfil</h2><p>Personaliza cómo te ven en la comunidad.</p></div>
        <a class="btn btn--gris btn--chico" href="#/perfil/${esc(p.nombre_usuario)}">${icono('ojo')}Ver perfil público</a></div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-bottom:22px">
        <div id="mp-avatar"></div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <label class="btn btn--azul btn--chico">${icono('subir')}Cambiar foto<input type="file" id="mp-foto" accept="image/png,image/jpeg,image/webp" hidden></label>
            <button class="btn btn--gris btn--chico" id="mp-quitar">Quitar foto</button>
          </div>
          <div><span class="etiqueta chico">Color del avatar</span>
            <div style="display:flex;gap:8px;margin-top:6px" id="mp-colores">${COLORES_AVATAR.map(c => `<button type="button" data-color="${c}" style="width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1.5px ${c === f.color ? 'var(--texto)' : 'var(--borde)'};background:${c};cursor:pointer" aria-label="Color ${c}"></button>`).join('')}</div>
          </div>
        </div>
      </div>
      <div class="form-post">
        <div class="fila">
          <label class="campo"><span>Nombre completo</span><input value="${esc(p.nombre_completo)}" disabled></label>
          <label class="campo"><span>Usuario</span><input value="@${esc(p.nombre_usuario)}" disabled></label>
        </div>
        <label class="campo"><span>Biografía</span><textarea id="mp-bio" maxlength="300" placeholder="Cuéntale a la comunidad algo sobre ti">${esc(p.biografia || '')}</textarea><span class="contador" id="mp-contador"></span></label>
        <div style="display:flex;justify-content:flex-end"><button class="btn btn--verde" id="mp-guardar">Guardar cambios</button></div>
      </div>
    </div>
    <div class="tarjeta">
      <div class="tarjeta__cabeza"><div><h3>Cuenta y seguridad</h3></div></div>
      <div class="lista">
        <div class="lista__fila"><span style="flex:1">Rol</span>${badgeRol(p.rol)}</div>
        <div class="lista__fila"><span style="flex:1">Miembro desde</span><span class="texto-suave">${fechaCorta(p.fecha_creacion)}</span></div>
        <div class="lista__fila"><span style="flex:1">Contraseña</span><span class="texto-suave">••••••••</span></div>
      </div>
      <div class="alerta alerta--info" style="margin-top:12px">${icono('candado')} Por seguridad, solo la administración puede cambiar o restablecer tu contraseña. Si la olvidaste, pídele ayuda.</div>
    </div>
  </div>`;
  const pintarAvatar = () => { $('#mp-avatar').innerHTML = avatar({ ...p, avatar_url: f.avatar_url, color_avatar: f.color }, 'xl'); };
  const contador = () => { $('#mp-contador').textContent = `${$('#mp-bio').value.length} / 300`; };
  $('#mp-bio').addEventListener('input', contador); contador(); pintarAvatar();
  $$('[data-color]').forEach(b => b.onclick = () => {
    f.color = b.dataset.color;
    $$('[data-color]').forEach(x => { x.style.boxShadow = `0 0 0 1.5px ${x.dataset.color === f.color ? 'var(--texto)' : 'var(--borde)'}`; });
    pintarAvatar();
  });
  $('#mp-quitar').onclick = () => { f.avatar_url = ''; pintarAvatar(); };
  $('#mp-foto').onchange = async e => {
    const a = e.target.files[0]; if (!a) return;
    if (!a.type.startsWith('image/')) return aviso('Elige una imagen', 'error');
    try { aviso('Subiendo foto…'); f.avatar_url = await subirArchivo(a, 'avatar-'); pintarAvatar(); }
    catch (ex) { avisoError(ex); }
  };
  $('#mp-guardar').onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try {
      await ejecutar(sb.rpc('actualizar_mi_perfil', { p_biografia: $('#mp-bio').value.trim(), p_avatar_url: f.avatar_url, p_color: f.color }));
      await recargarPerfil();
      aviso('Perfil actualizado', 'exito');
    } catch (ex) { avisoError(ex); } finally { b.disabled = false; }
  };
});

/* ---------- Normas ---------- */
ruta(/^\/normas$/, async () => {
  cabecera('Normas de la comunidad', [['Normas']]);
  vista().innerHTML = `<div class="tarjeta" style="max-width:760px;margin:0 auto">
    <div class="tarjeta__cabeza"><div><h2>${esc(estado.config.nombre_comunidad)}</h2><p>${esc(estado.config.descripcion || '')}</p></div></div>
    <ol class="normas">
      <li><b>Respeto ante todo.</b> No se permite el acoso, las burlas ni los comentarios ofensivos.</li>
      <li><b>Cuida tu privacidad.</b> No compartas direcciones, teléfonos ni contraseñas.</li>
      <li><b>Comparte con permiso.</b> Pide autorización antes de publicar fotos de otras personas.</li>
      <li><b>Información veraz.</b> Verifica antes de compartir noticias o datos.</li>
      <li><b>Reporta lo que no está bien.</b> Usa el botón «Reportar»: es confidencial.</li>
      <li><b>Tu cuenta es personal.</b> No compartas tu usuario ni tu contraseña con nadie.</li>
    </ol>
    <div class="alerta alerta--info" style="margin-top:14px">El equipo docente revisa los reportes y puede ocultar contenido que no cumpla estas normas.</div>
  </div>`;
});
