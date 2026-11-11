-- =====================================================================
--  RED SOCIAL ESCOLAR · Base de datos completa para Supabase
--  Cómo usar: Supabase > SQL Editor > New query > pega TODO > Run
--  Se puede ejecutar varias veces sin romper nada (es idempotente).
-- =====================================================================
--  Cambios respecto a tu versión original:
--   * Tu política "Consultar miembros activos" consultaba la misma tabla
--     dentro de la política -> error de recursión infinita. Se reemplazó
--     por funciones SECURITY DEFINER (es_activo, es_admin, es_moderador).
--   * Las cuentas se crean SOLO desde funciones de administración.
--     No se necesita correo real: internamente se usa
--     usuario@comunidad.local (la estudiante solo escribe su usuario).
--   * Las contraseñas solo las cambia la administración (hay un trigger
--     que bloquea cualquier otro cambio).
--   * Suspender a alguien lo bloquea también en Auth y cierra sus sesiones.
--   * Nuevas tablas: publicaciones, etiquetas, comentarios, reacciones,
--     seguidores, notificaciones, reportes, registro de moderación y
--     configuración de la comunidad + bucket de imágenes.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Dominio interno para los "correos" ficticios (debe coincidir con config.js)
create or replace function public.dominio_interno()
returns text language sql immutable as $$ select 'comunidad.local' $$;


-- =========================================
-- 1. USUARIOS DE LA RED SOCIAL (tu tabla, mejorada)
-- =========================================
create table if not exists public.usuarios_sociales (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_completo VARCHAR(150) NOT NULL,
    nombre_usuario VARCHAR(40) NOT NULL UNIQUE,
    rol VARCHAR(20) NOT NULL DEFAULT 'estudiante'
        CHECK (rol IN ('administrador', 'docente', 'estudiante')),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo'
        CHECK (estado IN ('activo', 'pendiente', 'suspendido')),
    creado_por UUID REFERENCES auth.users(id),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

alter table public.usuarios_sociales
    add column if not exists biografia varchar(300) not null default '',
    add column if not exists avatar_url text,
    add column if not exists color_avatar varchar(9) not null default '#1d72f2',
    add column if not exists fecha_actualizacion timestamptz not null default now();

alter table public.usuarios_sociales alter column estado set default 'activo';

-- Si la cuenta que creó a alguien se borra, no se borra la otra
alter table public.usuarios_sociales drop constraint if exists usuarios_sociales_creado_por_fkey;
alter table public.usuarios_sociales
    add constraint usuarios_sociales_creado_por_fkey
    foreign key (creado_por) references auth.users(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_formato_usuario') then
    alter table public.usuarios_sociales
      add constraint usuarios_formato_usuario
      check (nombre_usuario ~ '^[a-z0-9._]{3,40}$');
  end if;
end $$;

alter table public.usuarios_sociales enable row level security;

-- Se eliminan tus políticas anteriores (la 2ª causaba recursión)
drop policy if exists "Consultar perfil propio"    on public.usuarios_sociales;
drop policy if exists "Consultar miembros activos" on public.usuarios_sociales;


-- =========================================
-- 2. FUNCIONES DE AYUDA (evitan la recursión en RLS)
-- =========================================
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.usuarios_sociales where id = auth.uid() and estado = 'activo'
$$;

create or replace function public.es_activo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios_sociales where id = auth.uid() and estado = 'activo')
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() = 'administrador', false)
$$;

create or replace function public.es_moderador()   -- docente o administrador
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('administrador', 'docente'), false)
$$;


-- =========================================
-- 3. CONFIGURACIÓN DE LA COMUNIDAD (una sola fila)
-- =========================================
create table if not exists public.configuracion_comunidad (
    id smallint primary key default 1 check (id = 1),
    nombre_comunidad varchar(80) not null default 'Red Escolar',
    descripcion varchar(300) not null default 'Un espacio seguro para compartir, aprender y crecer juntas.',
    anuncio_titulo varchar(80) not null default '¡Bienvenidas!',
    anuncio_texto varchar(300) not null default 'Recuerda ser respetuosa y amable en cada publicación y comentario.',
    permitir_comentarios boolean not null default true,
    moderacion_previa boolean not null default false,
    palabras_prohibidas text[] not null default '{}',
    max_caracteres int not null default 2000 check (max_caracteres between 100 and 10000),
    max_imagenes int not null default 4 check (max_imagenes between 1 and 10),
    actualizado_por uuid references auth.users(id) on delete set null,
    fecha_actualizacion timestamptz not null default now()
);
insert into public.configuracion_comunidad (id) values (1) on conflict (id) do nothing;


-- =========================================
-- 4. PUBLICACIONES
-- =========================================
create table if not exists public.publicaciones (
    id uuid primary key default gen_random_uuid(),
    autor_id uuid not null references public.usuarios_sociales(id) on delete cascade,
    titulo varchar(120),
    contenido text not null default '',
    medios text[] not null default '{}',                -- URLs de imágenes / videos
    ubicacion varchar(120),
    visibilidad varchar(20) not null default 'publica'
        check (visibilidad in ('publica', 'seguidores', 'privada')),
    permitir_comentarios boolean not null default true,
    estado varchar(20) not null default 'publicada'
        check (estado in ('borrador', 'publicada', 'en_revision', 'oculta')),
    programada_para timestamptz,                       -- null = publicar ya
    motivo_moderacion text,
    moderado_por uuid references auth.users(id) on delete set null,
    fecha_creacion timestamptz not null default now(),
    fecha_edicion timestamptz,
    fecha_publicacion timestamptz generated always as (coalesce(programada_para, fecha_creacion)) stored
);
create index if not exists idx_pub_autor  on public.publicaciones (autor_id);
create index if not exists idx_pub_fecha  on public.publicaciones (fecha_publicacion desc);
create index if not exists idx_pub_estado on public.publicaciones (estado);

create table if not exists public.publicacion_etiquetas (
    publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
    usuario_id uuid not null references public.usuarios_sociales(id) on delete cascade,
    primary key (publicacion_id, usuario_id)
);


-- =========================================
-- 5. COMENTARIOS, REACCIONES Y SEGUIDORES
-- =========================================
create table if not exists public.comentarios (
    id uuid primary key default gen_random_uuid(),
    publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
    autor_id uuid not null references public.usuarios_sociales(id) on delete cascade,
    contenido varchar(1000) not null check (char_length(trim(contenido)) > 0),
    estado varchar(20) not null default 'visible' check (estado in ('visible', 'oculto')),
    motivo_moderacion text,
    fecha_creacion timestamptz not null default now()
);
create index if not exists idx_com_pub on public.comentarios (publicacion_id, fecha_creacion);

create table if not exists public.reacciones (
    publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
    usuario_id uuid not null references public.usuarios_sociales(id) on delete cascade,
    tipo varchar(20) not null default 'me_gusta'
        check (tipo in ('me_gusta', 'me_encanta', 'me_divierte', 'me_asombra', 'me_entristece')),
    fecha_creacion timestamptz not null default now(),
    primary key (publicacion_id, usuario_id)
);

create table if not exists public.seguidores (
    seguidor_id uuid not null references public.usuarios_sociales(id) on delete cascade,
    seguido_id  uuid not null references public.usuarios_sociales(id) on delete cascade,
    fecha_creacion timestamptz not null default now(),
    primary key (seguidor_id, seguido_id),
    check (seguidor_id <> seguido_id)
);
create index if not exists idx_seg_seguido on public.seguidores (seguido_id);


-- =========================================
-- 6. NOTIFICACIONES
-- =========================================
create table if not exists public.notificaciones (
    id uuid primary key default gen_random_uuid(),
    destinatario_id uuid not null references public.usuarios_sociales(id) on delete cascade,
    actor_id uuid references public.usuarios_sociales(id) on delete cascade,
    tipo varchar(20) not null
        check (tipo in ('reaccion', 'comentario', 'seguidor', 'mencion', 'moderacion', 'sistema')),
    publicacion_id uuid references public.publicaciones(id) on delete cascade,
    mensaje text not null,
    leida boolean not null default false,
    fecha_creacion timestamptz not null default now()
);
create index if not exists idx_notif_dest on public.notificaciones (destinatario_id, leida, fecha_creacion desc);


-- =========================================
-- 7. REPORTES Y REGISTRO DE MODERACIÓN
-- =========================================
create table if not exists public.reportes (
    id uuid primary key default gen_random_uuid(),
    reportante_id uuid references public.usuarios_sociales(id) on delete set null, -- null = filtro automático
    tipo_objetivo varchar(20) not null check (tipo_objetivo in ('publicacion', 'comentario', 'usuario')),
    publicacion_id uuid references public.publicaciones(id) on delete cascade,
    comentario_id uuid references public.comentarios(id) on delete cascade,
    usuario_reportado_id uuid references public.usuarios_sociales(id) on delete cascade,
    motivo varchar(30) not null check (motivo in ('acoso', 'contenido_inapropiado', 'spam',
             'informacion_falsa', 'discurso_odio', 'otro', 'filtro_automatico')),
    detalle varchar(500),
    estado varchar(20) not null default 'pendiente'
        check (estado in ('pendiente', 'en_revision', 'resuelto', 'descartado')),
    revisado_por uuid references auth.users(id) on delete set null,
    nota_resolucion varchar(500),
    fecha_creacion timestamptz not null default now(),
    fecha_resolucion timestamptz
);
create index if not exists idx_rep_estado on public.reportes (estado, fecha_creacion desc);

create table if not exists public.registro_moderacion (
    id bigint generated always as identity primary key,
    moderador_id uuid references public.usuarios_sociales(id) on delete set null,
    accion varchar(60) not null,
    tipo_objetivo varchar(20),
    objetivo_id uuid,
    detalle text,
    fecha timestamptz not null default now()
);


-- =========================================
-- 8. ¿PUEDO VER ESTA PUBLICACIÓN?
-- =========================================
create or replace function public.puede_ver_publicacion(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.publicaciones p
    join public.usuarios_sociales a on a.id = p.autor_id
    where p.id = p_id
      and public.es_activo()
      and (
        p.autor_id = auth.uid()
        or (public.es_moderador() and p.estado <> 'borrador')
        or (
          a.estado = 'activo'
          and p.estado = 'publicada'
          and p.fecha_publicacion <= now()
          and (
            p.visibilidad = 'publica'
            or (p.visibilidad = 'seguidores' and exists (
                  select 1 from public.seguidores s
                  where s.seguidor_id = auth.uid() and s.seguido_id = p.autor_id))
          )
        )
      )
  )
$$;

create or replace function public.contiene_palabra_prohibida(p_texto text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.configuracion_comunidad c, unnest(c.palabras_prohibidas) w
    where c.id = 1 and length(trim(w)) > 0
      and lower(coalesce(p_texto, '')) like '%' || lower(trim(w)) || '%'
  )
$$;


-- =========================================
-- 9. POLÍTICAS DE SEGURIDAD (RLS)
-- =========================================
alter table public.configuracion_comunidad enable row level security;
alter table public.publicaciones          enable row level security;
alter table public.publicacion_etiquetas  enable row level security;
alter table public.comentarios            enable row level security;
alter table public.reacciones             enable row level security;
alter table public.seguidores             enable row level security;
alter table public.notificaciones         enable row level security;
alter table public.reportes               enable row level security;
alter table public.registro_moderacion    enable row level security;

-- Usuarios: solo lectura. Crear/editar/eliminar SOLO con funciones admin.
drop policy if exists "usuarios_ver" on public.usuarios_sociales;
create policy "usuarios_ver" on public.usuarios_sociales for select to authenticated
using (id = auth.uid() or public.es_moderador() or (public.es_activo() and estado = 'activo'));

-- Configuración: todos leen (para mostrar el nombre en el login), solo admin edita
drop policy if exists "config_ver" on public.configuracion_comunidad;
create policy "config_ver" on public.configuracion_comunidad for select to anon, authenticated using (true);
drop policy if exists "config_editar" on public.configuracion_comunidad;
create policy "config_editar" on public.configuracion_comunidad for update to authenticated
using (public.es_admin()) with check (public.es_admin());

-- Publicaciones
-- (Las condiciones van escritas directamente sobre las columnas para que
--  insert(...).select() funcione al crear una publicación nueva)
create or replace function public.usuario_esta_activo(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios_sociales where id = p_id and estado = 'activo')
$$;
create or replace function public.sigo_a(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.seguidores where seguidor_id = auth.uid() and seguido_id = p_id)
$$;

drop policy if exists "pub_ver" on public.publicaciones;
create policy "pub_ver" on public.publicaciones for select to authenticated
using (
  public.es_activo() and (
    autor_id = auth.uid()
    or (public.es_moderador() and estado <> 'borrador')
    or (estado = 'publicada' and fecha_publicacion <= now()
        and public.usuario_esta_activo(autor_id)
        and (visibilidad = 'publica' or (visibilidad = 'seguidores' and public.sigo_a(autor_id))))
  )
);
drop policy if exists "pub_crear" on public.publicaciones;
create policy "pub_crear" on public.publicaciones for insert to authenticated
with check (autor_id = auth.uid() and public.es_activo());
drop policy if exists "pub_editar" on public.publicaciones;
create policy "pub_editar" on public.publicaciones for update to authenticated
using (autor_id = auth.uid() and public.es_activo()) with check (autor_id = auth.uid());
drop policy if exists "pub_eliminar" on public.publicaciones;
create policy "pub_eliminar" on public.publicaciones for delete to authenticated
using ((autor_id = auth.uid() and public.es_activo()) or public.es_moderador());

-- Etiquetas
drop policy if exists "etq_ver" on public.publicacion_etiquetas;
create policy "etq_ver" on public.publicacion_etiquetas for select to authenticated
using (public.puede_ver_publicacion(publicacion_id));
drop policy if exists "etq_crear" on public.publicacion_etiquetas;
create policy "etq_crear" on public.publicacion_etiquetas for insert to authenticated
with check (exists (select 1 from public.publicaciones p where p.id = publicacion_id and p.autor_id = auth.uid()));
drop policy if exists "etq_eliminar" on public.publicacion_etiquetas;
create policy "etq_eliminar" on public.publicacion_etiquetas for delete to authenticated
using (exists (select 1 from public.publicaciones p where p.id = publicacion_id and p.autor_id = auth.uid()));

-- Comentarios
drop policy if exists "com_ver" on public.comentarios;
create policy "com_ver" on public.comentarios for select to authenticated
using (public.puede_ver_publicacion(publicacion_id)
       and (estado = 'visible' or autor_id = auth.uid() or public.es_moderador()));
drop policy if exists "com_crear" on public.comentarios;
create policy "com_crear" on public.comentarios for insert to authenticated
with check (autor_id = auth.uid() and public.es_activo() and public.puede_ver_publicacion(publicacion_id));
drop policy if exists "com_eliminar" on public.comentarios;
create policy "com_eliminar" on public.comentarios for delete to authenticated
using (autor_id = auth.uid() or public.es_moderador()
       or exists (select 1 from public.publicaciones p where p.id = publicacion_id and p.autor_id = auth.uid()));

-- Reacciones
drop policy if exists "rea_ver" on public.reacciones;
create policy "rea_ver" on public.reacciones for select to authenticated
using (public.puede_ver_publicacion(publicacion_id));
drop policy if exists "rea_crear" on public.reacciones;
create policy "rea_crear" on public.reacciones for insert to authenticated
with check (usuario_id = auth.uid() and public.es_activo() and public.puede_ver_publicacion(publicacion_id));
drop policy if exists "rea_editar" on public.reacciones;
create policy "rea_editar" on public.reacciones for update to authenticated
using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists "rea_eliminar" on public.reacciones;
create policy "rea_eliminar" on public.reacciones for delete to authenticated
using (usuario_id = auth.uid());

-- Seguidores
drop policy if exists "seg_ver" on public.seguidores;
create policy "seg_ver" on public.seguidores for select to authenticated using (public.es_activo());
drop policy if exists "seg_crear" on public.seguidores;
create policy "seg_crear" on public.seguidores for insert to authenticated
with check (seguidor_id = auth.uid() and public.es_activo());
drop policy if exists "seg_eliminar" on public.seguidores;
create policy "seg_eliminar" on public.seguidores for delete to authenticated
using (seguidor_id = auth.uid());

-- Notificaciones (las crean los triggers)
drop policy if exists "not_ver" on public.notificaciones;
create policy "not_ver" on public.notificaciones for select to authenticated using (destinatario_id = auth.uid());
drop policy if exists "not_editar" on public.notificaciones;
create policy "not_editar" on public.notificaciones for update to authenticated
using (destinatario_id = auth.uid()) with check (destinatario_id = auth.uid());
drop policy if exists "not_eliminar" on public.notificaciones;
create policy "not_eliminar" on public.notificaciones for delete to authenticated using (destinatario_id = auth.uid());

-- Reportes
drop policy if exists "rep_crear" on public.reportes;
create policy "rep_crear" on public.reportes for insert to authenticated
with check (reportante_id = auth.uid() and public.es_activo() and estado = 'pendiente');
drop policy if exists "rep_ver" on public.reportes;
create policy "rep_ver" on public.reportes for select to authenticated
using (reportante_id = auth.uid() or public.es_moderador());

-- Registro de moderación
drop policy if exists "log_ver" on public.registro_moderacion;
create policy "log_ver" on public.registro_moderacion for select to authenticated using (public.es_moderador());


-- =========================================
-- 10. REGLAS AUTOMÁTICAS (triggers)
-- =========================================

-- 10.1 Reglas al crear / editar publicaciones
create or replace function public.tg_reglas_publicacion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cfg public.configuracion_comunidad;
  v_staff boolean := public.es_moderador();
begin
  select * into cfg from public.configuracion_comunidad where id = 1;

  if tg_op = 'UPDATE' then
    new.autor_id := old.autor_id;
    new.fecha_creacion := old.fecha_creacion;
    new.fecha_edicion := now();
  else
    new.moderado_por := null;
  end if;

  if not v_staff then
    if char_length(coalesce(new.contenido, '')) > cfg.max_caracteres then
      raise exception 'La publicación supera el máximo de % caracteres', cfg.max_caracteres;
    end if;
    if coalesce(array_length(new.medios, 1), 0) > cfg.max_imagenes then
      raise exception 'Solo se permiten % imágenes por publicación', cfg.max_imagenes;
    end if;

    if tg_op = 'INSERT' and new.estado not in ('borrador', 'publicada') then
      new.estado := 'borrador';
    end if;

    if tg_op = 'UPDATE' and old.estado in ('oculta', 'en_revision') then
      -- La estudiante no puede "des-ocultar" su publicación
      new.estado := old.estado;
      new.motivo_moderacion := old.motivo_moderacion;
      new.moderado_por := old.moderado_por;
    elsif new.estado = 'publicada' then
      if public.contiene_palabra_prohibida(coalesce(new.titulo, '') || ' ' || new.contenido) then
        new.estado := 'en_revision';
        new.motivo_moderacion := 'Filtro automático: contiene palabras no permitidas';
      elsif cfg.moderacion_previa and (tg_op = 'INSERT' or old.estado = 'borrador') then
        new.estado := 'en_revision';
        new.motivo_moderacion := 'Pendiente de aprobación (moderación previa)';
      end if;
    elsif new.estado not in ('borrador') then
      new.estado := 'borrador';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists reglas_publicacion on public.publicaciones;
create trigger reglas_publicacion before insert or update on public.publicaciones
for each row execute function public.tg_reglas_publicacion();

-- 10.2 Reporte automático si el filtro detecta palabras prohibidas
create or replace function public.tg_reporte_auto_publicacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'en_revision'
     and coalesce(new.motivo_moderacion, '') like 'Filtro automático%'
     and (tg_op = 'INSERT' or old.estado <> 'en_revision') then
    insert into public.reportes (reportante_id, tipo_objetivo, publicacion_id, usuario_reportado_id, motivo, detalle)
    values (null, 'publicacion', new.id, new.autor_id, 'filtro_automatico', new.motivo_moderacion);
  end if;
  return new;
end $$;

drop trigger if exists reporte_auto_publicacion on public.publicaciones;
create trigger reporte_auto_publicacion after insert or update on public.publicaciones
for each row execute function public.tg_reporte_auto_publicacion();

-- 10.3 Reglas de comentarios
create or replace function public.tg_reglas_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
declare cfg public.configuracion_comunidad; v_pub public.publicaciones;
begin
  select * into cfg from public.configuracion_comunidad where id = 1;
  select * into v_pub from public.publicaciones where id = new.publicacion_id;
  new.estado := 'visible';
  new.motivo_moderacion := null;
  if not public.es_moderador() then
    if not cfg.permitir_comentarios then
      raise exception 'Los comentarios están desactivados en la comunidad';
    end if;
    if not v_pub.permitir_comentarios then
      raise exception 'Esta publicación no permite comentarios';
    end if;
    if public.contiene_palabra_prohibida(new.contenido) then
      new.estado := 'oculto';
      new.motivo_moderacion := 'Filtro automático: contiene palabras no permitidas';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists reglas_comentario on public.comentarios;
create trigger reglas_comentario before insert on public.comentarios
for each row execute function public.tg_reglas_comentario();

-- 10.4 Notificaciones automáticas
create or replace function public.tg_notificar_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_autor uuid;
begin
  select autor_id into v_autor from public.publicaciones where id = new.publicacion_id;
  if new.estado = 'visible' and v_autor <> new.autor_id then
    insert into public.notificaciones (destinatario_id, actor_id, tipo, publicacion_id, mensaje)
    values (v_autor, new.autor_id, 'comentario', new.publicacion_id, 'comentó tu publicación');
  elsif new.estado = 'oculto' then
    insert into public.reportes (reportante_id, tipo_objetivo, comentario_id, publicacion_id, usuario_reportado_id, motivo, detalle)
    values (null, 'comentario', new.id, new.publicacion_id, new.autor_id, 'filtro_automatico', new.motivo_moderacion);
  end if;
  return new;
end $$;
drop trigger if exists notificar_comentario on public.comentarios;
create trigger notificar_comentario after insert on public.comentarios
for each row execute function public.tg_notificar_comentario();

create or replace function public.tg_notificar_reaccion()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_autor uuid;
begin
  select autor_id into v_autor from public.publicaciones where id = new.publicacion_id;
  if v_autor <> new.usuario_id then
    delete from public.notificaciones
     where destinatario_id = v_autor and actor_id = new.usuario_id
       and publicacion_id = new.publicacion_id and tipo = 'reaccion';
    insert into public.notificaciones (destinatario_id, actor_id, tipo, publicacion_id, mensaje)
    values (v_autor, new.usuario_id, 'reaccion', new.publicacion_id, 'reaccionó a tu publicación');
  end if;
  return new;
end $$;
drop trigger if exists notificar_reaccion on public.reacciones;
create trigger notificar_reaccion after insert on public.reacciones
for each row execute function public.tg_notificar_reaccion();

create or replace function public.tg_notificar_seguidor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.notificaciones
   where destinatario_id = new.seguido_id and actor_id = new.seguidor_id and tipo = 'seguidor';
  insert into public.notificaciones (destinatario_id, actor_id, tipo, mensaje)
  values (new.seguido_id, new.seguidor_id, 'seguidor', 'comenzó a seguirte');
  return new;
end $$;
drop trigger if exists notificar_seguidor on public.seguidores;
create trigger notificar_seguidor after insert on public.seguidores
for each row execute function public.tg_notificar_seguidor();

create or replace function public.tg_notificar_mencion()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_autor uuid;
begin
  select autor_id into v_autor from public.publicaciones where id = new.publicacion_id;
  if v_autor <> new.usuario_id then
    insert into public.notificaciones (destinatario_id, actor_id, tipo, publicacion_id, mensaje)
    values (new.usuario_id, v_autor, 'mencion', new.publicacion_id, 'te etiquetó en una publicación');
  end if;
  return new;
end $$;
drop trigger if exists notificar_mencion on public.publicacion_etiquetas;
create trigger notificar_mencion after insert on public.publicacion_etiquetas
for each row execute function public.tg_notificar_mencion();


-- =========================================
-- 11. PROTECCIÓN DE CONTRASEÑAS
--  Cualquier cambio de contraseña que NO venga de admin_cambiar_password
--  se revierte en silencio (las estudiantes no pueden cambiarla).
-- =========================================
create or replace function public.tg_proteger_password()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and coalesce(current_setting('red.cambio_password_autorizado', true), '') <> 'si' then
    new.encrypted_password := old.encrypted_password;
  end if;
  return new;
end $$;
drop trigger if exists proteger_password on auth.users;
create trigger proteger_password before update on auth.users
for each row execute function public.tg_proteger_password();


-- =========================================
-- 12. FUNCIONES DE ADMINISTRACIÓN DE USUARIOS
-- =========================================
create or replace function public._registrar(p_accion text, p_tipo text, p_objetivo uuid, p_detalle text)
returns void language sql security definer set search_path = public as $$
  insert into public.registro_moderacion (moderador_id, accion, tipo_objetivo, objetivo_id, detalle)
  values (auth.uid(), p_accion, p_tipo, p_objetivo, p_detalle);
$$;

-- Función interna (NO accesible desde la web). Se usa para crear la 1ª cuenta admin.
create or replace function public._crear_usuario_interno(
    p_usuario text, p_nombre text, p_password text,
    p_rol text default 'estudiante', p_estado text default 'activo', p_creado_por uuid default null)
returns uuid language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_id uuid := gen_random_uuid();
  v_usuario text := lower(trim(p_usuario));
  v_email text;
begin
  if v_usuario !~ '^[a-z0-9._]{3,40}$' then
    raise exception 'El usuario solo puede tener minúsculas, números, punto o guion bajo (3 a 40 caracteres)';
  end if;
  if char_length(trim(coalesce(p_nombre, ''))) < 3 then
    raise exception 'Escribe el nombre completo';
  end if;
  if char_length(coalesce(p_password, '')) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
  end if;
  if p_rol not in ('administrador', 'docente', 'estudiante') then raise exception 'Rol no válido'; end if;
  if p_estado not in ('activo', 'pendiente', 'suspendido') then raise exception 'Estado no válido'; end if;

  v_email := v_usuario || '@' || public.dominio_interno();
  if exists (select 1 from public.usuarios_sociales where nombre_usuario = v_usuario)
     or exists (select 1 from auth.users where email = v_email) then
    raise exception 'El usuario "%" ya existe', v_usuario;
  end if;

  insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, banned_until)
  values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, crypt(p_password, gen_salt('bf', 10)), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nombre_usuario', v_usuario, 'nombre_completo', trim(p_nombre)),
      now(), now(), '', '', '', '',
      case when p_estado = 'activo' then null else now() + interval '100 years' end);

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());

  insert into public.usuarios_sociales (id, nombre_completo, nombre_usuario, rol, estado, creado_por)
  values (v_id, trim(p_nombre), v_usuario, p_rol, p_estado, p_creado_por);

  return v_id;
end $$;
revoke all on function public._crear_usuario_interno(text, text, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.admin_crear_usuario(
    p_usuario text, p_nombre text, p_password text, p_rol text default 'estudiante', p_estado text default 'activo')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.es_admin() then raise exception 'Solo la administración puede crear cuentas'; end if;
  v_id := public._crear_usuario_interno(p_usuario, p_nombre, p_password, p_rol, p_estado, auth.uid());
  perform public._registrar('crear_usuario', 'usuario', v_id, lower(trim(p_usuario)) || ' (' || p_rol || ')');
  return v_id;
end $$;

create or replace function public.admin_cambiar_password(p_usuario_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_filas int;
begin
  if not public.es_admin() then raise exception 'Solo la administración puede cambiar contraseñas'; end if;
  if char_length(coalesce(p_password, '')) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres'; end if;
  perform set_config('red.cambio_password_autorizado', 'si', true);
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
   where id = p_usuario_id;
  get diagnostics v_filas = row_count;
  perform set_config('red.cambio_password_autorizado', 'no', true);
  if v_filas = 0 then raise exception 'Usuario no encontrado'; end if;
  delete from auth.sessions where user_id = p_usuario_id;   -- cierra sus sesiones abiertas
  perform public._registrar('cambiar_password', 'usuario', p_usuario_id, null);
end $$;

create or replace function public.admin_cambiar_estado(p_usuario_id uuid, p_estado text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.es_admin() then raise exception 'Solo la administración puede cambiar estados'; end if;
  if p_usuario_id = auth.uid() then raise exception 'No puedes cambiar el estado de tu propia cuenta'; end if;
  if p_estado not in ('activo', 'pendiente', 'suspendido') then raise exception 'Estado no válido'; end if;
  update public.usuarios_sociales set estado = p_estado, fecha_actualizacion = now() where id = p_usuario_id;
  if not found then raise exception 'Usuario no encontrado'; end if;
  update auth.users
     set banned_until = case when p_estado = 'activo' then null else now() + interval '100 years' end
   where id = p_usuario_id;
  if p_estado <> 'activo' then delete from auth.sessions where user_id = p_usuario_id; end if;
  perform public._registrar('estado_' || p_estado, 'usuario', p_usuario_id, null);
end $$;

create or replace function public.admin_editar_usuario(p_usuario_id uuid, p_nombre text, p_usuario text, p_rol text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_usuario text := lower(trim(p_usuario));
begin
  if not public.es_admin() then raise exception 'Solo la administración puede editar cuentas'; end if;
  if v_usuario !~ '^[a-z0-9._]{3,40}$' then
    raise exception 'El usuario solo puede tener minúsculas, números, punto o guion bajo (3 a 40 caracteres)';
  end if;
  if p_rol not in ('administrador', 'docente', 'estudiante') then raise exception 'Rol no válido'; end if;
  if p_usuario_id = auth.uid() and p_rol <> 'administrador' then
    raise exception 'No puedes quitarte el rol de administración a ti misma';
  end if;
  if exists (select 1 from public.usuarios_sociales where nombre_usuario = v_usuario and id <> p_usuario_id) then
    raise exception 'El usuario "%" ya existe', v_usuario;
  end if;
  update public.usuarios_sociales
     set nombre_completo = trim(p_nombre), nombre_usuario = v_usuario, rol = p_rol, fecha_actualizacion = now()
   where id = p_usuario_id;
  update auth.users set email = v_usuario || '@' || public.dominio_interno() where id = p_usuario_id;
  update auth.identities
     set identity_data = identity_data || jsonb_build_object('email', v_usuario || '@' || public.dominio_interno())
   where user_id = p_usuario_id and provider = 'email';
  perform public._registrar('editar_usuario', 'usuario', p_usuario_id, v_usuario || ' (' || p_rol || ')');
end $$;

create or replace function public.admin_eliminar_usuario(p_usuario_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_usuario text;
begin
  if not public.es_admin() then raise exception 'Solo la administración puede eliminar cuentas'; end if;
  if p_usuario_id = auth.uid() then raise exception 'No puedes eliminar tu propia cuenta'; end if;
  select nombre_usuario into v_usuario from public.usuarios_sociales where id = p_usuario_id;
  delete from auth.users where id = p_usuario_id;     -- borra en cascada perfil, publicaciones, etc.
  perform public._registrar('eliminar_usuario', 'usuario', p_usuario_id, v_usuario);
end $$;

create or replace function public.admin_listar_usuarios()
returns table (id uuid, nombre_completo text, nombre_usuario text, rol text, estado text,
               avatar_url text, color_avatar text, fecha_creacion timestamptz,
               ultimo_acceso timestamptz, publicaciones bigint, seguidores bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.es_admin() then raise exception 'Acceso solo para administración'; end if;
  return query
  select u.id, u.nombre_completo::text, u.nombre_usuario::text, u.rol::text, u.estado::text,
         u.avatar_url, u.color_avatar::text, u.fecha_creacion, au.last_sign_in_at,
         (select count(*) from public.publicaciones p where p.autor_id = u.id),
         (select count(*) from public.seguidores s where s.seguido_id = u.id)
  from public.usuarios_sociales u
  join auth.users au on au.id = u.id
  order by u.fecha_creacion desc;
end $$;


-- =========================================
-- 13. FUNCIONES DE PERFIL Y MODERACIÓN
-- =========================================
create or replace function public.actualizar_mi_perfil(p_biografia text, p_avatar_url text, p_color text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_activo() then raise exception 'Tu cuenta no está activa'; end if;
  update public.usuarios_sociales
     set biografia = left(coalesce(p_biografia, ''), 300),
         avatar_url = nullif(p_avatar_url, ''),
         color_avatar = coalesce(nullif(p_color, ''), color_avatar),
         fecha_actualizacion = now()
   where id = auth.uid();
end $$;

create or replace function public.moderar_publicacion(p_id uuid, p_accion text, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_autor uuid; v_titulo text;
begin
  if not public.es_moderador() then raise exception 'Acceso solo para docentes y administración'; end if;
  select autor_id, coalesce(nullif(titulo, ''), left(contenido, 40)) into v_autor, v_titulo
    from public.publicaciones where id = p_id;
  if v_autor is null then raise exception 'Publicación no encontrada'; end if;

  if p_accion = 'ocultar' then
    update public.publicaciones set estado = 'oculta', motivo_moderacion = p_motivo, moderado_por = auth.uid() where id = p_id;
    insert into public.notificaciones (destinatario_id, actor_id, tipo, publicacion_id, mensaje)
    values (v_autor, auth.uid(), 'moderacion', p_id,
            'ocultó tu publicación "' || v_titulo || '"' || coalesce('. Motivo: ' || nullif(p_motivo, ''), ''));
  elsif p_accion in ('aprobar', 'restaurar') then
    update public.publicaciones set estado = 'publicada', motivo_moderacion = null, moderado_por = auth.uid() where id = p_id;
    insert into public.notificaciones (destinatario_id, actor_id, tipo, publicacion_id, mensaje)
    values (v_autor, auth.uid(), 'moderacion', p_id, 'aprobó tu publicación "' || v_titulo || '"');
  elsif p_accion = 'eliminar' then
    insert into public.notificaciones (destinatario_id, actor_id, tipo, mensaje)
    values (v_autor, auth.uid(), 'moderacion',
            'eliminó tu publicación "' || v_titulo || '"' || coalesce('. Motivo: ' || nullif(p_motivo, ''), ''));
    delete from public.publicaciones where id = p_id;
  else
    raise exception 'Acción no válida';
  end if;
  perform public._registrar(p_accion || '_publicacion', 'publicacion', p_id, p_motivo);
end $$;

create or replace function public.moderar_comentario(p_id uuid, p_accion text, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_autor uuid; v_pub uuid;
begin
  if not public.es_moderador() then raise exception 'Acceso solo para docentes y administración'; end if;
  select autor_id, publicacion_id into v_autor, v_pub from public.comentarios where id = p_id;
  if v_autor is null then raise exception 'Comentario no encontrado'; end if;
  if p_accion = 'ocultar' then
    update public.comentarios set estado = 'oculto', motivo_moderacion = p_motivo where id = p_id;
    insert into public.notificaciones (destinatario_id, actor_id, tipo, publicacion_id, mensaje)
    values (v_autor, auth.uid(), 'moderacion', v_pub,
            'ocultó uno de tus comentarios' || coalesce('. Motivo: ' || nullif(p_motivo, ''), ''));
  elsif p_accion = 'restaurar' then
    update public.comentarios set estado = 'visible', motivo_moderacion = null where id = p_id;
  elsif p_accion = 'eliminar' then
    delete from public.comentarios where id = p_id;
  else
    raise exception 'Acción no válida';
  end if;
  perform public._registrar(p_accion || '_comentario', 'comentario', p_id, p_motivo);
end $$;

create or replace function public.resolver_reporte(p_id uuid, p_estado text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_reportante uuid;
begin
  if not public.es_moderador() then raise exception 'Acceso solo para docentes y administración'; end if;
  if p_estado not in ('pendiente', 'en_revision', 'resuelto', 'descartado') then raise exception 'Estado no válido'; end if;
  update public.reportes
     set estado = p_estado, nota_resolucion = p_nota, revisado_por = auth.uid(),
         fecha_resolucion = case when p_estado in ('resuelto', 'descartado') then now() else null end
   where id = p_id
   returning reportante_id into v_reportante;
  if v_reportante is not null and p_estado in ('resuelto', 'descartado') then
    insert into public.notificaciones (destinatario_id, actor_id, tipo, mensaje)
    values (v_reportante, auth.uid(), 'sistema',
            'revisó tu reporte. ¡Gracias por cuidar la comunidad!' || coalesce(' Nota: ' || nullif(p_nota, ''), ''));
  end if;
  perform public._registrar('reporte_' || p_estado, 'reporte', p_id, p_nota);
end $$;

create or replace function public.estadisticas_moderacion()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_moderador() then raise exception 'Acceso solo para docentes y administración'; end if;
  return json_build_object(
    'reportes_pendientes',   (select count(*) from public.reportes where estado in ('pendiente', 'en_revision')),
    'en_revision',           (select count(*) from public.publicaciones where estado = 'en_revision'),
    'ocultas',               (select count(*) from public.publicaciones where estado = 'oculta'),
    'publicaciones_hoy',     (select count(*) from public.publicaciones where estado = 'publicada' and fecha_creacion >= current_date),
    'comentarios_hoy',       (select count(*) from public.comentarios where fecha_creacion >= current_date),
    'usuarios_activos',      (select count(*) from public.usuarios_sociales where estado = 'activo'),
    'usuarios_suspendidos',  (select count(*) from public.usuarios_sociales where estado = 'suspendido'),
    'usuarios_pendientes',   (select count(*) from public.usuarios_sociales where estado = 'pendiente')
  );
end $$;

-- Nadie anónimo puede ejecutar funciones de la red
revoke execute on function public.admin_crear_usuario(text, text, text, text, text) from anon;
revoke execute on function public.admin_cambiar_password(uuid, text) from anon;
revoke execute on function public.admin_cambiar_estado(uuid, text) from anon;
revoke execute on function public.admin_editar_usuario(uuid, text, text, text) from anon;
revoke execute on function public.admin_eliminar_usuario(uuid) from anon;
revoke execute on function public.admin_listar_usuarios() from anon;


-- =========================================
-- 14. ALMACENAMIENTO DE IMÁGENES (bucket "medios")
-- =========================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medios', 'medios', true, 20971520,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do nothing;

drop policy if exists "medios_subir" on storage.objects;
create policy "medios_subir" on storage.objects for insert to authenticated
with check (bucket_id = 'medios' and (storage.foldername(name))[1] = auth.uid()::text and public.es_activo());

drop policy if exists "medios_ver_propios" on storage.objects;
create policy "medios_ver_propios" on storage.objects for select to authenticated
using (bucket_id = 'medios' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "medios_eliminar" on storage.objects;
create policy "medios_eliminar" on storage.objects for delete to authenticated
using (bucket_id = 'medios' and (storage.foldername(name))[1] = auth.uid()::text);


-- =====================================================================
-- 15. CREA TU CUENTA DE ADMINISTRACIÓN (solo la primera vez)
--     Cambia usuario, nombre y contraseña, quita el "--" y ejecuta:
-- =====================================================================
-- select public._crear_usuario_interno('admin', 'Administración', 'CambiaEsto123', 'administrador');
