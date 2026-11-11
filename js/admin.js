/* =====================================================
   PANEL DE ADMINISTRACIÓN · usuarios y configuración
   ===================================================== */
'use strict';

const SOLO_ADMIN = ['administrador'];
const MIGA_ADMIN = ['Administración', '#/admin/usuarios'];
const PALABRAS_CLAVE = ['Sol', 'Luna', 'Mar', 'Flor', 'Nube', 'Rio', 'Cielo', 'Pino', 'Lago', 'Brisa', 'Roble', 'Ceiba', 'Quetzal', 'Jade', 'Coral', 'Lirio'];

function generarPassword() {
  const n = crypto.getRandomValues(new Uint32Array(2));
  return PALABRAS_CLAVE[n[0] % PALABRAS_CLAVE.length] + String(1000 + (n[1] % 9000));
}
function sugerirUsuario(nombre) {
  const partes = sinAcentos(nombre).toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  const apellido = partes.length >= 3 ? partes[partes.length - 2] : partes[1];
  return (partes[0] + (apellido ? '.' + apellido : '')).slice(0, 40);
}
const urlIngreso = () => location.href.split('#')[0];
function textoCredenciales(lista) {
  return lista.map(c => `${c.nombre}\nUsuario: ${c.usuario}\nContraseña: ${c.password}`).join('\n\n') + `\n\nIngresa en: ${urlIngreso()}`;
}
function mostrarCredenciales(titulo, lista) {
  const texto = textoCredenciales(lista);
  abrirModal({
    titulo,
    cuerpo: `<div class="alerta alerta--aviso chico">Copia o anota estos datos ahora: por seguridad la contraseña no se vuelve a mostrar.</div>
      <div class="credenciales" style="max-height:320px;overflow:auto">${lista.map(c => `<div><b>${esc(c.nombre)}</b><br>Usuario: <b>${esc(c.usuario)}</b><br>Contraseña: <b>${esc(c.password)}</b></div>`).join('<hr style="border:0;border-top:1px dashed #cdd6e3;width:100%">')}</div>
      <p class="texto-suave chico">Página de ingreso: ${esc(urlIngreso())}</p>`,
    acciones: [
      { texto: `${icono('copiar')}Copiar`, clase: 'btn--borde', accion: async () => { await navigator.clipboard.writeText(texto); aviso('Credenciales copiadas', 'exito'); return false; } },
      { texto: 'Listo', clase: 'btn--azul' },
    ],
  });
}
function campoPassword(id, valor = '') {
  return `<label class="campo"><span>Contraseña</span>
    <div style="display:flex;gap:8px">
      <div class="campo__con-boton" style="flex:1"><input id="${id}" type="text" minlength="6" value="${esc(valor)}" autocomplete="new-password" spellcheck="false">
        <button type="button" class="btn-icono" data-ver-pass="${id}" aria-label="Ocultar">${icono('ojoNo')}</button></div>
      <button type="button" class="btn btn--gris btn--chico" data-generar="${id}">${icono('refrescar')}Generar</button>
    </div><small>Mínimo 6 caracteres. Solo tú puedes cambiarla después.</small></label>`;
}
function activarCampoPassword(m) {
  $$('[data-generar]', m).forEach(b => b.onclick = () => { $('#' + b.dataset.generar, m).value = generarPassword(); });
  $$('[data-ver-pass]', m).forEach(b => b.onclick = () => {
    const i = $('#' + b.dataset.verPass, m), ver = i.type === 'password';
    i.type = ver ? 'text' : 'password'; b.innerHTML = icono(ver ? 'ojoNo' : 'ojo');
  });
}
const selectRol = (id, actual = 'estudiante') =>
  `<select id="${id}">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === actual ? 'selected' : ''}>${r.texto}</option>`).join('')}</select>`;

/* =====================================================
   GESTIÓN DE USUARIOS
   ===================================================== */
ruta(/^\/admin\/usuarios$/, async (_, params) => {
  cabecera('Gestión de usuarios', [MIGA_ADMIN, ['Usuarios']]);
  const lista = await ejecutar(sb.rpc('admin_listar_usuarios'));
  const cuenta = e => lista.filter(u => u.estado === e).length;
  vista().innerHTML = `<div class="contenedor">
    <div class="stats">
      ${tarjetaStat('personas', 'ic-azul', lista.length, 'Cuentas en total')}
      ${tarjetaStat('personaCheck', 'ic-verde', cuenta('activo'), 'Activas')}
      ${tarjetaStat('reloj', 'ic-naranja', cuenta('pendiente'), 'Pendientes')}
      ${tarjetaStat('bloqueo', 'ic-rojo', cuenta('suspendido'), 'Suspendidas')}
    </div>
    <div class="tarjeta">
      <div class="tarjeta__cabeza">
        <div><h2>Cuentas de la comunidad</h2><p>El registro público está deshabilitado: solo tú creas las cuentas.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn--borde" id="btn-importar">${icono('importar')}Crear varias</button>
          <button class="btn btn--verde" id="btn-crear">${icono('personaMas')}Crear usuario</button>
        </div>
      </div>
      <div class="barra-herr">
        <div class="buscador">${icono('buscar')}<input id="u-buscar" placeholder="Buscar por nombre o usuario" value="${esc(params.buscar || '')}"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select class="select-chico" id="u-rol"><option value="">Todos los roles</option>${Object.entries(ROLES).map(([k, r]) => `<option value="${k}">${r.texto}</option>`).join('')}</select>
          <select class="select-chico" id="u-estado"><option value="">Todos los estados</option>${Object.entries(ESTADOS_USUARIO).map(([k, r]) => `<option value="${k}">${r.texto}</option>`).join('')}</select>
        </div>
      </div>
      <div class="tabla-env"><table class="tabla">
        <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Creada</th><th>Último acceso</th><th>Actividad</th><th></th></tr></thead>
        <tbody id="u-cuerpo"></tbody>
      </table></div>
    </div></div>`;

  const pintar = () => {
    const t = sinAcentos($('#u-buscar').value.toLowerCase());
    const rol = $('#u-rol').value, est = $('#u-estado').value;
    const res = lista.filter(u => (!t || sinAcentos(`${u.nombre_completo} ${u.nombre_usuario}`.toLowerCase()).includes(t))
      && (!rol || u.rol === rol) && (!est || u.estado === est));
    $('#u-cuerpo').innerHTML = res.length ? res.map(u => `<tr>
        <td>${persona(u)}${u.id === yo() ? ' <span class="badge badge--azul">Tú</span>' : ''}</td>
        <td>${badgeRol(u.rol)}</td>
        <td>${badgeEstadoUsuario(u.estado)}</td>
        <td class="chico texto-suave" style="white-space:nowrap">${fechaCorta(u.fecha_creacion)}</td>
        <td class="chico texto-suave" style="white-space:nowrap">${u.ultimo_acceso ? tiempo(u.ultimo_acceso) : 'Nunca'}</td>
        <td class="chico" style="white-space:nowrap">${plural(+u.publicaciones, 'publicación', 'publicaciones')} · ${plural(+u.seguidores, 'seguidora', 'seguidoras')}</td>
        <td style="text-align:right"><div class="desplegable"><button class="btn btn--gris btn--chico" data-menu data-accion="menu-usuario" data-id="${u.id}">Gestionar ${icono('abajo')}</button></div></td>
      </tr>`).join('') : `<tr><td colspan="7">${vacio('buscar', 'No hay cuentas con esos filtros')}</td></tr>`;
  };
  ['#u-buscar', '#u-rol', '#u-estado'].forEach(s => $(s).addEventListener('input', pintar));
  $('#btn-crear').onclick = modalCrearUsuario;
  $('#btn-importar').onclick = modalImportar;
  ACCIONES['menu-usuario'] = el => {
    const u = lista.find(x => x.id === el.dataset.id), soyYo = u.id === yo();
    abrirMenu(el, [
      { icono: 'persona', texto: 'Ver perfil', fn: () => { location.hash = '#/perfil/' + u.nombre_usuario; } },
      { icono: 'editar', texto: 'Editar datos y rol', fn: () => modalEditarUsuario(u) },
      { icono: 'llave', texto: 'Cambiar contraseña', fn: () => modalPassword(u) },
      !soyYo && u.estado !== 'activo' && { icono: 'personaCheck', texto: 'Activar cuenta', fn: () => cambiarEstadoUsuario(u, 'activo') },
      !soyYo && u.estado !== 'suspendido' && { icono: 'bloqueo', texto: 'Suspender cuenta', fn: () => cambiarEstadoUsuario(u, 'suspendido') },
      !soyYo && u.estado === 'activo' && { icono: 'reloj', texto: 'Marcar como pendiente', fn: () => cambiarEstadoUsuario(u, 'pendiente') },
      !soyYo && { icono: 'basura', texto: 'Eliminar cuenta', peligro: true, fn: () => eliminarUsuario(u) },
    ]);
  };
  pintar();
}, { roles: SOLO_ADMIN });

function modalCrearUsuario() {
  let usuarioEditado = false;
  const { el: m } = abrirModal({
    titulo: 'Crear usuario',
    cuerpo: `<label class="campo"><span>Nombre completo</span><input id="cu-nombre" maxlength="150" placeholder="Ej. Ana Sofía López"></label>
      <label class="campo"><span>Usuario</span><input id="cu-usuario" maxlength="40" placeholder="ana.lopez" autocapitalize="none" spellcheck="false">
        <small>Minúsculas, números, punto o guion bajo. Con esto iniciará sesión (no necesita correo).</small></label>
      ${campoPassword('cu-pass', generarPassword())}
      <div class="fila">
        <label class="campo"><span>Rol</span>${selectRol('cu-rol')}</label>
        <label class="campo"><span>Estado inicial</span><select id="cu-estado"><option value="activo">Activa (puede entrar ya)</option><option value="pendiente">Pendiente (aún no puede entrar)</option></select></label>
      </div>`,
    acciones: [{ texto: 'Cancelar' }, {
      texto: 'Crear cuenta', clase: 'btn--verde', accion: async m => {
        const datos = {
          p_nombre: $('#cu-nombre', m).value.trim(), p_usuario: $('#cu-usuario', m).value.trim().toLowerCase(),
          p_password: $('#cu-pass', m).value, p_rol: $('#cu-rol', m).value, p_estado: $('#cu-estado', m).value,
        };
        if (datos.p_nombre.length < 3) { aviso('Escribe el nombre completo', 'error'); return false; }
        if (!/^[a-z0-9._]{3,40}$/.test(datos.p_usuario)) { aviso('El usuario no es válido', 'error'); return false; }
        if (datos.p_password.length < 6) { aviso('La contraseña debe tener al menos 6 caracteres', 'error'); return false; }
        await ejecutar(sb.rpc('admin_crear_usuario', datos));
        navegar();
        setTimeout(() => mostrarCredenciales('¡Cuenta creada!', [{ nombre: datos.p_nombre, usuario: datos.p_usuario, password: datos.p_password }]), 50);
      }
    }],
  });
  activarCampoPassword(m);
  $('#cu-usuario', m).addEventListener('input', () => { usuarioEditado = true; });
  $('#cu-nombre', m).addEventListener('input', e => { if (!usuarioEditado) $('#cu-usuario', m).value = sugerirUsuario(e.target.value); });
}

function modalImportar() {
  abrirModal({
    titulo: 'Crear varias cuentas',
    ancho: true,
    cuerpo: `<p class="texto-suave">Escribe una persona por línea. Separa con coma o punto y coma:<br>
      <code>Nombre completo, usuario, contraseña, rol</code><br>Solo el nombre es obligatorio: si omites usuario o contraseña se generan solos. El rol por defecto es estudiante.</p>
      <label class="campo"><span>Lista</span><textarea id="imp-texto" rows="9" placeholder="Ana Sofía López&#10;María José Pérez, maria.perez&#10;Lucía Gómez, lucia.g, Clave2026, estudiante&#10;Ruth Morales, profe.ruth, , docente"></textarea></label>
      <div id="imp-resultado"></div>`,
    acciones: [{ texto: 'Cerrar' }, {
      texto: 'Crear cuentas', clase: 'btn--verde', accion: async m => {
        const lineas = $('#imp-texto', m).value.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lineas.length) { aviso('Escribe al menos una línea', 'error'); return false; }
        const ok = [], errores = [];
        const res = $('#imp-resultado', m);
        for (let i = 0; i < lineas.length; i++) {
          res.innerHTML = `<div class="alerta alerta--info">Creando ${i + 1} de ${lineas.length}…</div>`;
          const [nombre, usuario, pass, rol] = lineas[i].split(/[;,\t]/).map(x => (x || '').trim());
          const datos = {
            p_nombre: nombre, p_usuario: (usuario || sugerirUsuario(nombre)).toLowerCase(),
            p_password: pass || generarPassword(), p_rol: ROLES[rol?.toLowerCase()] ? rol.toLowerCase() : 'estudiante', p_estado: 'activo',
          };
          try {
            await ejecutar(sb.rpc('admin_crear_usuario', datos));
            ok.push({ nombre: datos.p_nombre, usuario: datos.p_usuario, password: datos.p_password });
          } catch (e) { errores.push(`Línea ${i + 1} (${esc(nombre)}): ${esc(textoError(e))}`); }
        }
        res.innerHTML = `<div class="alerta ${errores.length ? 'alerta--aviso' : 'alerta--info'}">Se crearon ${ok.length} de ${lineas.length} cuentas.${errores.length ? '<br>' + errores.join('<br>') : ''}</div>`;
        if (ok.length) { navegar(); setTimeout(() => mostrarCredenciales(`${ok.length} cuentas creadas`, ok), 50); }
        return false;
      }
    }],
  });
}

function modalEditarUsuario(u) {
  abrirModal({
    titulo: 'Editar cuenta',
    cuerpo: `<label class="campo"><span>Nombre completo</span><input id="eu-nombre" maxlength="150" value="${esc(u.nombre_completo)}"></label>
      <label class="campo"><span>Usuario</span><input id="eu-usuario" maxlength="40" value="${esc(u.nombre_usuario)}" autocapitalize="none" spellcheck="false">
        <small>Si lo cambias, deberá iniciar sesión con el nuevo usuario.</small></label>
      <label class="campo"><span>Rol</span>${selectRol('eu-rol', u.rol)}</label>`,
    acciones: [{ texto: 'Cancelar' }, {
      texto: 'Guardar', clase: 'btn--azul', accion: async m => {
        await ejecutar(sb.rpc('admin_editar_usuario', {
          p_usuario_id: u.id, p_nombre: $('#eu-nombre', m).value.trim(),
          p_usuario: $('#eu-usuario', m).value.trim().toLowerCase(), p_rol: $('#eu-rol', m).value,
        }));
        aviso('Cuenta actualizada', 'exito');
        if (u.id === yo()) await recargarPerfil();
        navegar();
      }
    }],
  });
}

function modalPassword(u) {
  const { el: m } = abrirModal({
    titulo: 'Cambiar contraseña',
    cuerpo: `<div style="display:flex;align-items:center;gap:12px">${avatar(u)}<div><b>${esc(u.nombre_completo)}</b><br><small class="texto-suave">@${esc(u.nombre_usuario)}</small></div></div>
      ${campoPassword('cp-pass', generarPassword())}
      <div class="alerta alerta--info chico">Se cerrarán todas sus sesiones abiertas.</div>`,
    acciones: [{ texto: 'Cancelar' }, {
      texto: 'Cambiar contraseña', clase: 'btn--azul', accion: async m => {
        const pass = $('#cp-pass', m).value;
        if (pass.length < 6) { aviso('Mínimo 6 caracteres', 'error'); return false; }
        await ejecutar(sb.rpc('admin_cambiar_password', { p_usuario_id: u.id, p_password: pass }));
        setTimeout(() => mostrarCredenciales('Contraseña actualizada', [{ nombre: u.nombre_completo, usuario: u.nombre_usuario, password: pass }]), 50);
      }
    }],
  });
  activarCampoPassword(m);
}

async function cambiarEstadoUsuario(u, nuevo) {
  const textos = {
    activo: ['Activar cuenta', `${esc(u.nombre_completo)} podrá iniciar sesión de nuevo.`, 'Activar', false],
    suspendido: ['Suspender cuenta', `${esc(u.nombre_completo)} no podrá iniciar sesión y se cerrarán sus sesiones. Sus publicaciones dejarán de verse.`, 'Suspender', true],
    pendiente: ['Marcar como pendiente', `${esc(u.nombre_completo)} no podrá entrar hasta que actives la cuenta.`, 'Marcar pendiente', true],
  }[nuevo];
  if (!await confirmar({ titulo: textos[0], mensaje: textos[1], boton: textos[2], peligro: textos[3] })) return;
  await ejecutar(sb.rpc('admin_cambiar_estado', { p_usuario_id: u.id, p_estado: nuevo }));
  aviso('Estado actualizado', 'exito');
  navegar();
}

async function eliminarUsuario(u) {
  if (!await confirmar({
    titulo: 'Eliminar cuenta',
    mensaje: `Se eliminará <b>${esc(u.nombre_completo)}</b> (@${esc(u.nombre_usuario)}) junto con todas sus publicaciones, comentarios y reacciones. <b>No se puede deshacer.</b><br><br>Si solo quieres impedir que entre, mejor suspende la cuenta.`,
    boton: 'Eliminar definitivamente', peligro: true,
  })) return;
  await ejecutar(sb.rpc('admin_eliminar_usuario', { p_usuario_id: u.id }));
  aviso('Cuenta eliminada', 'exito');
  navegar();
}

/* =====================================================
   CONFIGURACIÓN DE LA COMUNIDAD
   ===================================================== */
ruta(/^\/admin\/configuracion$/, async () => {
  cabecera('Configuración de la comunidad', [MIGA_ADMIN, ['Configuración']]);
  await cargarConfig();
  const c = estado.config;
  vista().innerHTML = `<div class="contenedor" style="max-width:980px">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:22px;align-items:start">
      <div class="tarjeta form-post">
        <div class="tarjeta__cabeza" style="margin:0"><div><h3>Identidad</h3><p>Cómo se presenta tu comunidad</p></div></div>
        <label class="campo"><span>Nombre de la comunidad</span><input id="cf-nombre" maxlength="80" value="${esc(c.nombre_comunidad)}"></label>
        <label class="campo"><span>Descripción</span><textarea id="cf-desc" maxlength="300" rows="3">${esc(c.descripcion)}</textarea><small>Se muestra en la pantalla de inicio de sesión.</small></label>
        <label class="campo"><span>Título del anuncio</span><input id="cf-an-titulo" maxlength="80" value="${esc(c.anuncio_titulo)}"></label>
        <label class="campo"><span>Texto del anuncio</span><textarea id="cf-an-texto" maxlength="300" rows="3">${esc(c.anuncio_texto)}</textarea><small>Aparece en la tarjeta azul del menú lateral. Déjalo vacío para ocultarla.</small></label>
      </div>
      <div class="columna">
        <div class="tarjeta form-post">
          <div class="tarjeta__cabeza" style="margin:0"><div><h3>Publicaciones y moderación</h3><p>Reglas para todas las estudiantes</p></div></div>
          <label class="interruptor"><input type="checkbox" id="cf-comentarios" ${c.permitir_comentarios ? 'checked' : ''}> Permitir comentarios en la comunidad</label>
          <label class="interruptor"><input type="checkbox" id="cf-previa" ${c.moderacion_previa ? 'checked' : ''}> Moderación previa (una docente aprueba cada publicación)</label>
          <div class="fila">
            <label class="campo"><span>Máx. caracteres</span><input id="cf-max" type="number" min="100" max="10000" value="${c.max_caracteres}"></label>
            <label class="campo"><span>Máx. imágenes</span><input id="cf-img" type="number" min="1" max="10" value="${c.max_imagenes}"></label>
          </div>
          <label class="campo"><span>Palabras no permitidas</span><textarea id="cf-palabras" rows="4" placeholder="Separadas por comas">${esc((c.palabras_prohibidas || []).join(', '))}</textarea>
            <small>Si una publicación o comentario las contiene, se retiene y se crea un reporte automático para el equipo docente.</small></label>
        </div>
        <div class="tarjeta">
          <div class="tarjeta__cabeza"><div><h3>Seguridad de cuentas</h3></div></div>
          <div class="lista">
            <div class="lista__fila"><span style="flex:1">Registro público</span><span class="badge badge--rojo">Deshabilitado</span></div>
            <div class="lista__fila"><span style="flex:1">Creación de cuentas</span><span class="badge badge--morado">Solo administración</span></div>
            <div class="lista__fila"><span style="flex:1">Cambio de contraseñas</span><span class="badge badge--morado">Solo administración</span></div>
            <div class="lista__fila"><span style="flex:1">Correo electrónico</span><span class="badge badge--gris">No se necesita</span></div>
          </div>
          <p class="texto-suave chico" style="margin-top:10px">Recuerda también desactivar «Allow new users to sign up» en Supabase › Authentication › Sign In / Providers.</p>
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:22px"><button class="btn btn--verde" id="cf-guardar">Guardar configuración</button></div>
  </div>`;
  $('#cf-guardar').onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const datos = {
        nombre_comunidad: $('#cf-nombre').value.trim() || 'Red Escolar',
        descripcion: $('#cf-desc').value.trim(),
        anuncio_titulo: $('#cf-an-titulo').value.trim(),
        anuncio_texto: $('#cf-an-texto').value.trim(),
        permitir_comentarios: $('#cf-comentarios').checked,
        moderacion_previa: $('#cf-previa').checked,
        max_caracteres: Math.min(10000, Math.max(100, +$('#cf-max').value || 2000)),
        max_imagenes: Math.min(10, Math.max(1, +$('#cf-img').value || 4)),
        palabras_prohibidas: [...new Set($('#cf-palabras').value.split(/[,\n]/).map(p => p.trim().toLowerCase()).filter(Boolean))],
        actualizado_por: yo(),
        fecha_actualizacion: new Date().toISOString(),
      };
      await ejecutar(sb.from('configuracion_comunidad').update(datos).eq('id', 1));
      await cargarConfig();
      aviso('Configuración guardada', 'exito');
    } catch (ex) { avisoError(ex); } finally { b.disabled = false; }
  };
}, { roles: SOLO_ADMIN });
