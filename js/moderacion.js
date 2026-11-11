/* =====================================================
   PANEL DOCENTE · reportes, moderación y supervisión
   ===================================================== */
'use strict';

const STAFF = ['docente', 'administrador'];
const ESTADOS_REPORTE = {
  pendiente: { texto: 'Pendiente', badge: 'naranja' },
  en_revision: { texto: 'En revisión', badge: 'azul' },
  resuelto: { texto: 'Resuelto', badge: 'verde' },
  descartado: { texto: 'Descartado', badge: 'gris' },
};
const MIGA_MOD = ['Panel docente', '#/moderacion'];

function miniaturaPost(p) {
  const m = p?.medios?.[0];
  if (m && !esVideo(m)) return `<img class="miniatura" src="${esc(m)}" alt="">`;
  return `<span class="miniatura">${icono(m ? 'imagen' : 'documento')}</span>`;
}
function tarjetaStat(ic, color, valor, texto, href) {
  const cont = `<div class="stat__ic ${color}">${icono(ic)}</div><div><b>${valor}</b><span>${texto}</span></div>`;
  return href ? `<a class="stat" href="${href}" style="color:inherit">${cont}</a>` : `<div class="stat">${cont}</div>`;
}

/* ---------- Resumen ---------- */
ruta(/^\/moderacion$/, async () => {
  cabecera('Panel docente', [['Panel docente']]);
  const [s, reportes, revision] = await Promise.all([
    ejecutar(sb.rpc('estadisticas_moderacion')),
    ejecutar(sb.from('reportes').select(SELECT_REPORTE).in('estado', ['pendiente', 'en_revision']).order('fecha_creacion', { ascending: false }).limit(4)),
    ejecutar(sb.from('publicaciones').select(`id,titulo,contenido,medios,estado,motivo_moderacion,fecha_creacion, autor:usuarios_sociales!publicaciones_autor_id_fkey(${CAMPOS_USUARIO})`).eq('estado', 'en_revision').order('fecha_creacion').limit(5)),
  ]);
  vista().innerHTML = `<div class="contenedor">
    <div class="stats">
      ${tarjetaStat('bandera', 'ic-rojo', s.reportes_pendientes, 'Reportes por revisar', '#/moderacion/reportes')}
      ${tarjetaStat('reloj', 'ic-naranja', s.en_revision, 'Publicaciones en revisión', '#/moderacion/contenido?estado=en_revision')}
      ${tarjetaStat('imagen', 'ic-azul', s.publicaciones_hoy, 'Publicaciones hoy', '#/moderacion/contenido?estado=publicada')}
      ${tarjetaStat('comentario', 'ic-morado', s.comentarios_hoy, 'Comentarios hoy', '#/moderacion/comentarios')}
      ${tarjetaStat('personas', 'ic-verde', s.usuarios_activos, 'Cuentas activas', esAdmin() ? '#/admin/usuarios' : '')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:22px;align-items:start">
      <div class="tarjeta">
        <div class="tarjeta__cabeza"><div><h3>Reportes recientes</h3><p>Lo último que reportó la comunidad</p></div><a class="chico" href="#/moderacion/reportes">Ver todos</a></div>
        <div class="columna" style="gap:12px">${reportes.length ? reportes.map(tarjetaReporte).join('') : vacio('escudo', 'Todo en orden', 'No hay reportes pendientes.')}</div>
      </div>
      <div class="tarjeta">
        <div class="tarjeta__cabeza"><div><h3>Esperando aprobación</h3><p>Publicaciones retenidas por moderación previa o el filtro</p></div><a class="chico" href="#/moderacion/contenido?estado=en_revision">Ver todas</a></div>
        <div class="lista">${revision.length ? revision.map(p => `<div class="lista__fila" style="flex-wrap:wrap">
            ${miniaturaPost(p)}
            <div style="flex:1;min-width:160px"><b>${esc(p.titulo || 'Sin título')}</b><p class="recorte chico">${esc(p.contenido)}</p>
              <small class="texto-suave">@${esc(p.autor?.nombre_usuario)} · ${tiempo(p.fecha_creacion)}</small></div>
            <div style="display:flex;gap:6px">
              <a class="btn btn--gris btn--chico" href="#/publicacion/${p.id}">${icono('ojo')}</a>
              <button class="btn btn--verde btn--chico" data-accion="mod-post" data-id="${p.id}" data-modo="aprobar">Aprobar</button>
              <button class="btn btn--rojo-suave btn--chico" data-accion="mod-post" data-id="${p.id}" data-modo="ocultar">Ocultar</button>
            </div></div>`).join('') : vacio('check', 'Nada pendiente', 'No hay publicaciones esperando aprobación.')}</div>
      </div>
    </div></div>`;
}, { roles: STAFF });

ACCIONES['mod-post'] = el => moderarPublicacion(el.dataset.id, el.dataset.modo, () => navegar());

/* ---------- Reportes ---------- */
const SELECT_REPORTE = `*,
  reportante:usuarios_sociales!reportes_reportante_id_fkey(${CAMPOS_USUARIO}),
  usuario_reportado:usuarios_sociales!reportes_usuario_reportado_id_fkey(${CAMPOS_USUARIO},estado),
  publicacion:publicaciones!reportes_publicacion_id_fkey(id,titulo,contenido,medios,estado,autor_id),
  comentario:comentarios!reportes_comentario_id_fkey(id,contenido,estado)`;

function tarjetaReporte(r) {
  const er = ESTADOS_REPORTE[r.estado];
  const abierto = ['pendiente', 'en_revision'].includes(r.estado);
  let objetivo = '';
  if (r.tipo_objetivo === 'comentario' && r.comentario) {
    objetivo = `<div class="reporte__objetivo">${icono('comentario')}<div style="min-width:0;flex:1">
      <small class="texto-suave">Comentario de @${esc(r.usuario_reportado?.nombre_usuario)} ${r.comentario.estado === 'oculto' ? '<span class="badge badge--rojo">Oculto</span>' : ''}</small>
      <p class="recorte">${esc(r.comentario.contenido)}</p></div></div>`;
  } else if (r.tipo_objetivo === 'publicacion' && r.publicacion) {
    objetivo = `<div class="reporte__objetivo">${miniaturaPost(r.publicacion)}<div style="min-width:0;flex:1">
      <small class="texto-suave">Publicación de @${esc(r.usuario_reportado?.nombre_usuario)} ${badgeEstadoPost({ ...r.publicacion, fecha_publicacion: 0 })}</small>
      <b style="display:block">${esc(r.publicacion.titulo || 'Sin título')}</b><p class="recorte">${esc(r.publicacion.contenido)}</p></div></div>`;
  } else if (r.tipo_objetivo === 'usuario' && r.usuario_reportado) {
    objetivo = `<div class="reporte__objetivo" style="align-items:center">${persona(r.usuario_reportado)}${badgeEstadoUsuario(r.usuario_reportado.estado)}</div>`;
  } else {
    objetivo = '<div class="reporte__objetivo texto-suave">El contenido reportado ya fue eliminado.</div>';
  }
  const pub = r.publicacion, com = r.comentario;
  return `<div class="reporte">
    <div class="reporte__cabeza">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span class="badge ${r.motivo === 'filtro_automatico' ? 'badge--morado' : 'badge--rojo'}">${icono('bandera')}${MOTIVOS_REPORTE[r.motivo]}</span>
        <span class="badge badge--${er.badge}">${er.texto}</span>
      </div>
      <small class="texto-suave">${r.reportante ? 'Reportado por @' + esc(r.reportante.nombre_usuario) : 'Detectado automáticamente'} · ${tiempo(r.fecha_creacion)}</small>
    </div>
    ${r.detalle ? `<p class="chico" style="color:var(--texto-2)">“${esc(r.detalle)}”</p>` : ''}
    ${objetivo}
    ${r.nota_resolucion ? `<p class="chico texto-suave"><b>Nota:</b> ${esc(r.nota_resolucion)}</p>` : ''}
    <div class="reporte__acciones">
      ${pub ? `<a class="btn btn--gris btn--chico" href="#/publicacion/${pub.id}">${icono('ojo')}Ver publicación</a>` : ''}
      ${r.tipo_objetivo === 'usuario' && r.usuario_reportado ? `<a class="btn btn--gris btn--chico" href="#/perfil/${esc(r.usuario_reportado.nombre_usuario)}">${icono('persona')}Ver perfil</a>` : ''}
      ${abierto && pub && r.tipo_objetivo === 'publicacion' && pub.estado !== 'oculta' ? `<button class="btn btn--rojo-suave btn--chico" data-accion="rep-ocultar-post" data-id="${r.id}" data-pub="${pub.id}">${icono('ojoNo')}Ocultar publicación</button>` : ''}
      ${abierto && pub && r.tipo_objetivo === 'publicacion' && pub.estado === 'en_revision' ? `<button class="btn btn--verde btn--chico" data-accion="rep-aprobar-post" data-id="${r.id}" data-pub="${pub.id}">${icono('check')}Aprobar</button>` : ''}
      ${abierto && com && com.estado === 'visible' ? `<button class="btn btn--rojo-suave btn--chico" data-accion="rep-ocultar-com" data-id="${r.id}" data-com="${com.id}">${icono('ojoNo')}Ocultar comentario</button>` : ''}
      ${abierto && com && com.estado === 'oculto' && r.motivo === 'filtro_automatico' ? `<button class="btn btn--verde btn--chico" data-accion="rep-restaurar-com" data-id="${r.id}" data-com="${com.id}">${icono('check')}Permitir comentario</button>` : ''}
      ${esAdmin() && abierto && r.usuario_reportado && r.usuario_reportado.estado === 'activo' && r.usuario_reportado.rol === 'estudiante' ? `<button class="btn btn--rojo-suave btn--chico" data-accion="rep-suspender" data-id="${r.id}" data-usuario="${r.usuario_reportado.id}" data-nombre="${esc(r.usuario_reportado.nombre_completo)}">${icono('bloqueo')}Suspender cuenta</button>` : ''}
      ${r.estado === 'pendiente' ? `<button class="btn btn--borde btn--chico" data-accion="rep-estado" data-id="${r.id}" data-estado="en_revision">Marcar en revisión</button>` : ''}
      ${abierto ? `<button class="btn btn--azul btn--chico" data-accion="rep-estado" data-id="${r.id}" data-estado="resuelto">${icono('check')}Resolver</button>
                   <button class="btn btn--gris btn--chico" data-accion="rep-estado" data-id="${r.id}" data-estado="descartado">Descartar</button>`
               : `<button class="btn btn--borde btn--chico" data-accion="rep-estado" data-id="${r.id}" data-estado="pendiente">${icono('refrescar')}Reabrir</button>`}
    </div>
  </div>`;
}
async function cambiarEstadoReporte(id, nuevo, notaPredef = null) {
  let nota = notaPredef;
  if (nota === null && ['resuelto', 'descartado'].includes(nuevo)) {
    nota = await pedirTexto({ titulo: nuevo === 'resuelto' ? 'Resolver reporte' : 'Descartar reporte', etiqueta: 'Nota (opcional)', placeholder: 'Ej. Se habló con la estudiante', boton: nuevo === 'resuelto' ? 'Resolver' : 'Descartar' });
    if (nota === null) return false;
  }
  await ejecutar(sb.rpc('resolver_reporte', { p_id: id, p_estado: nuevo, p_nota: nota || null }));
  return true;
}
const trasReporte = () => { actualizarContadores(); navegar(); };
ACCIONES['rep-estado'] = async el => {
  if (await cambiarEstadoReporte(el.dataset.id, el.dataset.estado)) { aviso('Reporte actualizado', 'exito'); trasReporte(); }
};
ACCIONES['rep-ocultar-post'] = el => moderarPublicacion(el.dataset.pub, 'ocultar', async () => {
  await cambiarEstadoReporte(el.dataset.id, 'resuelto', 'Publicación ocultada'); trasReporte();
});
ACCIONES['rep-aprobar-post'] = el => moderarPublicacion(el.dataset.pub, 'aprobar', async () => {
  await cambiarEstadoReporte(el.dataset.id, 'descartado', 'Publicación aprobada'); trasReporte();
});
ACCIONES['rep-ocultar-com'] = async el => {
  const motivo = await pedirTexto({ titulo: 'Ocultar comentario', etiqueta: 'Motivo (la estudiante lo verá)', boton: 'Ocultar', peligro: true });
  if (motivo === null) return;
  await ejecutar(sb.rpc('moderar_comentario', { p_id: el.dataset.com, p_accion: 'ocultar', p_motivo: motivo || null }));
  await cambiarEstadoReporte(el.dataset.id, 'resuelto', 'Comentario ocultado');
  aviso('Comentario ocultado', 'exito'); trasReporte();
};
ACCIONES['rep-restaurar-com'] = async el => {
  await ejecutar(sb.rpc('moderar_comentario', { p_id: el.dataset.com, p_accion: 'restaurar', p_motivo: null }));
  await cambiarEstadoReporte(el.dataset.id, 'descartado', 'Comentario permitido');
  aviso('Comentario visible de nuevo', 'exito'); trasReporte();
};
ACCIONES['rep-suspender'] = async el => {
  if (!await confirmar({ titulo: 'Suspender cuenta', mensaje: `${esc(el.dataset.nombre)} no podrá iniciar sesión hasta que la reactives.`, boton: 'Suspender', peligro: true })) return;
  await ejecutar(sb.rpc('admin_cambiar_estado', { p_usuario_id: el.dataset.usuario, p_estado: 'suspendido' }));
  await cambiarEstadoReporte(el.dataset.id, 'resuelto', 'Cuenta suspendida');
  aviso('Cuenta suspendida', 'exito'); trasReporte();
};

ruta(/^\/moderacion\/reportes$/, async (_, params) => {
  cabecera('Reportes', [MIGA_MOD, ['Reportes']]);
  const filtro = ESTADOS_REPORTE[params.estado] ? params.estado : 'abiertos';
  let q = sb.from('reportes').select(SELECT_REPORTE).order('fecha_creacion', { ascending: false }).limit(100);
  q = filtro === 'abiertos' ? q.in('estado', ['pendiente', 'en_revision']) : q.eq('estado', filtro);
  const [lista, conteo] = await Promise.all([
    ejecutar(q),
    ejecutar(sb.from('reportes').select('estado').limit(1000)),
  ]);
  const n = e => conteo.filter(r => e === 'abiertos' ? ['pendiente', 'en_revision'].includes(r.estado) : r.estado === e).length;
  const pest = [['abiertos', 'Por revisar'], ['resuelto', 'Resueltos'], ['descartado', 'Descartados']];
  vista().innerHTML = `<div class="contenedor" style="max-width:920px">
    <div class="barra-herr">
      <div class="pestanas">${pest.map(([k, t]) => `<a class="pestana ${filtro === k ? 'activa' : ''}" href="#/moderacion/reportes${k === 'abiertos' ? '' : '?estado=' + k}">${t}<span class="num">${n(k)}</span></a>`).join('')}</div>
      <button class="btn btn--borde btn--chico" data-accion="recargar">${icono('refrescar')}Actualizar</button>
    </div>
    <div class="columna" style="gap:14px">${lista.length ? lista.map(tarjetaReporte).join('')
      : `<div class="tarjeta">${vacio('escudo', filtro === 'abiertos' ? '¡Todo en orden!' : 'Sin reportes', filtro === 'abiertos' ? 'No hay reportes por revisar.' : '')}</div>`}</div>
  </div>`;
}, { roles: STAFF });

/* ---------- Supervisión de contenido ---------- */
ruta(/^\/moderacion\/contenido$/, async (_, params) => {
  cabecera('Supervisión de contenido', [MIGA_MOD, ['Supervisión']]);
  const filtros = [['todas', 'Todas'], ['en_revision', 'En revisión'], ['publicada', 'Publicadas'], ['programada', 'Programadas'], ['oculta', 'Ocultas']];
  let actual = filtros.some(f => f[0] === params.estado) ? params.estado : 'todas';
  const lista = await ejecutar(sb.from('publicaciones')
    .select(`id,titulo,contenido,medios,estado,visibilidad,fecha_publicacion,motivo_moderacion,autor_id,
             autor:usuarios_sociales!publicaciones_autor_id_fkey(${CAMPOS_USUARIO}), reacciones(count), comentarios(count)`)
    .neq('estado', 'borrador').order('fecha_publicacion', { ascending: false }).limit(300));

  vista().innerHTML = `<div class="contenedor">
    <div class="barra-herr">
      <div class="pestanas" id="sup-tabs"></div>
      <div class="buscador">${icono('buscar')}<input id="sup-buscar" placeholder="Buscar texto o autora"></div>
    </div>
    <div class="tarjeta"><div class="tabla-env"><table class="tabla">
      <thead><tr><th>Publicación</th><th>Autora</th><th>Visibilidad</th><th>Estado</th><th>Fecha</th><th>Interacción</th><th style="text-align:right">Acciones</th></tr></thead>
      <tbody id="sup-cuerpo"></tbody></table></div></div></div>`;
  const pintar = () => {
    const t = sinAcentos($('#sup-buscar').value.toLowerCase());
    $('#sup-tabs').innerHTML = filtros.map(([k, tx]) => {
      const n = k === 'todas' ? lista.length : lista.filter(p => estadoPost(p).clave === k).length;
      return `<button class="pestana ${k === actual ? 'activa' : ''}" data-k="${k}">${tx}<span class="num">${n}</span></button>`;
    }).join('');
    $$('#sup-tabs [data-k]').forEach(b => b.onclick = () => { actual = b.dataset.k; pintar(); });
    const res = lista.filter(p => (actual === 'todas' || estadoPost(p).clave === actual)
      && (!t || sinAcentos(`${p.titulo} ${p.contenido} ${p.autor?.nombre_completo} ${p.autor?.nombre_usuario}`.toLowerCase()).includes(t)));
    $('#sup-cuerpo').innerHTML = res.length ? res.map(p => {
      const mio = p.autor_id === yo();
      return `<tr>
        <td><div style="display:flex;gap:12px;align-items:center">${miniaturaPost(p)}<div style="min-width:0"><b>${esc(p.titulo || 'Sin título')}</b><p class="recorte chico">${esc(p.contenido || '(sin texto)')}</p>
          ${p.motivo_moderacion ? `<small style="color:var(--rojo)">${esc(p.motivo_moderacion)}</small>` : ''}</div></div></td>
        <td>${persona(p.autor, '', 'sm')}</td>
        <td><span class="badge badge--gris">${icono(VISIBILIDAD[p.visibilidad].icono)}${VISIBILIDAD[p.visibilidad].texto}</span></td>
        <td>${badgeEstadoPost(p)}</td>
        <td class="chico texto-suave" style="white-space:nowrap">${fechaHora(p.fecha_publicacion)}</td>
        <td class="chico" style="white-space:nowrap">❤️ ${p.reacciones[0]?.count || 0} · 💬 ${p.comentarios[0]?.count || 0}</td>
        <td style="text-align:right;white-space:nowrap">
          <a class="btn btn--gris btn--chico" href="#/publicacion/${p.id}" title="Ver">${icono('ojo')}</a>
          ${!mio && p.estado === 'en_revision' ? `<button class="btn btn--verde btn--chico" data-accion="mod-post" data-id="${p.id}" data-modo="aprobar">Aprobar</button>` : ''}
          ${!mio && p.estado === 'publicada' ? `<button class="btn btn--rojo-suave btn--chico" data-accion="mod-post" data-id="${p.id}" data-modo="ocultar">Ocultar</button>` : ''}
          ${!mio && ['oculta', 'en_revision'].includes(p.estado) && p.estado === 'oculta' ? `<button class="btn btn--borde btn--chico" data-accion="mod-post" data-id="${p.id}" data-modo="restaurar">Restaurar</button>` : ''}
          ${!mio ? `<button class="btn btn--rojo-suave btn--chico" data-accion="mod-post" data-id="${p.id}" data-modo="eliminar" title="Eliminar">${icono('basura')}</button>` : ''}
        </td></tr>`;
    }).join('') : `<tr><td colspan="7">${vacio('escudo', 'Sin publicaciones en esta vista')}</td></tr>`;
  };
  $('#sup-buscar').addEventListener('input', pintar);
  pintar();
}, { roles: STAFF });

/* ---------- Comentarios ---------- */
ruta(/^\/moderacion\/comentarios$/, async (_, params) => {
  cabecera('Comentarios', [MIGA_MOD, ['Comentarios']]);
  const soloOcultos = params.ver === 'ocultos';
  let q = sb.from('comentarios')
    .select(`id,contenido,estado,motivo_moderacion,fecha_creacion,autor_id,publicacion_id,
             autor:usuarios_sociales!comentarios_autor_id_fkey(${CAMPOS_USUARIO}),
             publicacion:publicaciones!comentarios_publicacion_id_fkey(id,titulo,contenido)`)
    .order('fecha_creacion', { ascending: false }).limit(150);
  if (soloOcultos) q = q.eq('estado', 'oculto');
  const lista = await ejecutar(q);
  vista().innerHTML = `<div class="contenedor" style="max-width:980px">
    <div class="barra-herr">
      <div class="pestanas">
        <a class="pestana ${soloOcultos ? '' : 'activa'}" href="#/moderacion/comentarios">Recientes</a>
        <a class="pestana ${soloOcultos ? 'activa' : ''}" href="#/moderacion/comentarios?ver=ocultos">Ocultos</a>
      </div>
      <div class="buscador">${icono('buscar')}<input id="com-buscar" placeholder="Buscar en comentarios"></div>
    </div>
    <div class="tarjeta"><div class="lista" id="com-lista"></div></div></div>`;
  const pintar = () => {
    const t = sinAcentos($('#com-buscar').value.toLowerCase());
    const res = lista.filter(c => !t || sinAcentos(`${c.contenido} ${c.autor?.nombre_usuario}`.toLowerCase()).includes(t));
    $('#com-lista').innerHTML = res.length ? res.map(c => {
      const mio = c.autor_id === yo();
      return `<div class="lista__fila" style="align-items:flex-start;flex-wrap:wrap">
        ${avatar(c.autor, 'sm')}
        <div style="flex:1;min-width:220px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${esc(c.autor?.nombre_completo)}</b><small class="texto-suave">@${esc(c.autor?.nombre_usuario)} · ${tiempo(c.fecha_creacion)}</small>${c.estado === 'oculto' ? '<span class="badge badge--rojo">Oculto</span>' : ''}</div>
          <p style="margin:4px 0;white-space:pre-wrap">${esc(c.contenido)}</p>
          ${c.motivo_moderacion ? `<small style="color:var(--rojo)">${esc(c.motivo_moderacion)}</small><br>` : ''}
          <a class="chico" href="#/publicacion/${c.publicacion_id}">En: ${esc(c.publicacion?.titulo || (c.publicacion?.contenido || 'publicación').slice(0, 50))}</a>
        </div>
        ${!mio ? `<div style="display:flex;gap:6px">
          <button class="btn ${c.estado === 'oculto' ? 'btn--borde' : 'btn--rojo-suave'} btn--chico" data-accion="moderar-comentario" data-id="${c.id}" data-modo="${c.estado === 'oculto' ? 'restaurar' : 'ocultar'}">${c.estado === 'oculto' ? 'Restaurar' : 'Ocultar'}</button>
          <button class="btn btn--rojo-suave btn--chico" data-accion="borrar-comentario" data-id="${c.id}" data-mio="false" title="Eliminar">${icono('basura')}</button></div>` : ''}
      </div>`;
    }).join('') : vacio('comentario', 'Sin comentarios');
  };
  $('#com-buscar').addEventListener('input', pintar);
  pintar();
}, { roles: STAFF });

/* ---------- Registro de moderación ---------- */
const ACCIONES_LOG = {
  crear_usuario: ['Creó la cuenta', 'verde'], editar_usuario: ['Editó la cuenta', 'azul'], eliminar_usuario: ['Eliminó la cuenta', 'rojo'],
  cambiar_password: ['Cambió la contraseña', 'morado'], estado_activo: ['Activó la cuenta', 'verde'],
  estado_suspendido: ['Suspendió la cuenta', 'rojo'], estado_pendiente: ['Marcó como pendiente', 'naranja'],
  ocultar_publicacion: ['Ocultó una publicación', 'rojo'], aprobar_publicacion: ['Aprobó una publicación', 'verde'],
  restaurar_publicacion: ['Restauró una publicación', 'verde'], eliminar_publicacion: ['Eliminó una publicación', 'rojo'],
  ocultar_comentario: ['Ocultó un comentario', 'rojo'], restaurar_comentario: ['Restauró un comentario', 'verde'],
  eliminar_comentario: ['Eliminó un comentario', 'rojo'], reporte_resuelto: ['Resolvió un reporte', 'azul'],
  reporte_descartado: ['Descartó un reporte', 'gris'], reporte_en_revision: ['Revisa un reporte', 'naranja'], reporte_pendiente: ['Reabrió un reporte', 'naranja'],
};
ruta(/^\/moderacion\/registro$/, async () => {
  cabecera('Registro de moderación', [MIGA_MOD, ['Registro']]);
  const lista = await ejecutar(sb.from('registro_moderacion')
    .select(`*, moderador:usuarios_sociales!registro_moderacion_moderador_id_fkey(${CAMPOS_USUARIO})`)
    .order('fecha', { ascending: false }).limit(200));
  vista().innerHTML = `<div class="contenedor" style="max-width:980px"><div class="tarjeta">
    <div class="tarjeta__cabeza"><div><h2>Historial de acciones</h2><p>Todo lo que hacen docentes y administración queda registrado.</p></div></div>
    <div class="tabla-env"><table class="tabla" style="min-width:620px">
      <thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead>
      <tbody>${lista.length ? lista.map(l => {
        const [t, c] = ACCIONES_LOG[l.accion] || [l.accion, 'gris'];
        return `<tr><td class="chico texto-suave" style="white-space:nowrap">${fechaHora(l.fecha)}</td>
          <td>${l.moderador ? persona(l.moderador, '', 'xs') : '<span class="texto-suave">Sistema</span>'}</td>
          <td><span class="badge badge--${c}">${esc(t)}</span></td>
          <td class="chico">${esc(l.detalle || '—')}</td></tr>`;
      }).join('') : `<tr><td colspan="4">${vacio('lista', 'Aún no hay acciones registradas')}</td></tr>`}</tbody>
    </table></div></div></div>`;
}, { roles: STAFF });
