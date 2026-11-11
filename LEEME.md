# Red Escolar · Guía de instalación

Red social escolar en HTML, CSS y JavaScript con Supabase. Tú creas todas las cuentas: las estudiantes no necesitan correo.

## Archivos

| Archivo | Qué hace |
|---|---|
| `base_de_datos.sql` | Tu tabla mejorada, más publicaciones, comentarios, reacciones, seguidores, notificaciones, reportes, moderación, configuración, imágenes y seguridad (RLS) |
| `index.html` | Página principal |
| `css/estilos.css` | Diseño |
| `js/config.js` | **Aquí pegas tus datos de Supabase** |
| `js/nucleo.js` | Sesión, menú y utilidades |
| `js/social.js` | Panel de estudiante: inicio, publicaciones, perfiles, seguidores y notificaciones |
| `js/moderacion.js` | Panel docente: reportes, supervisión, comentarios y registro |
| `js/admin.js` | Panel de administración: usuarios y configuración |

## Pasos

1. **Base de datos:** en Supabase, abre *SQL Editor → New query*, pega todo `base_de_datos.sql` y presiona **Run**.
2. **Tu cuenta de administración:** al final del SQL está esta línea. Cambia el usuario y la contraseña, quítale los `--` y ejecútala una vez:
   ```sql
   select public._crear_usuario_interno('admin', 'Tu Nombre', 'TuClaveSegura', 'administrador');
   ```
3. **Desactiva el registro público:** *Authentication → Sign In / Providers →* apaga **Allow new users to sign up**.
4. **Conexión:** en *Project Settings → API* copia la **Project URL** y la **anon public key** y pégalas en `js/config.js`.
5. Abre `index.html` (o súbelo a Netlify, Vercel o GitHub Pages) e inicia sesión con `admin`.
6. En **Administración → Usuarios** crea a las estudiantes una por una o con **Crear varias** (pegas una lista de nombres).

## Cómo funciona el ingreso sin correo

Supabase pide un correo, así que cada usuario recibe uno interno que nadie ve: `ana.lopez` → `ana.lopez@comunidad.local`. La estudiante solo escribe `ana.lopez` y su contraseña. Si cambias el dominio, cámbialo en `config.js` y en la función `dominio_interno()` del SQL.

## Quién puede hacer qué

| | Estudiante | Docente | Administración |
|---|:-:|:-:|:-:|
| Publicar, comentar, reaccionar, seguir | ✅ | ✅ | ✅ |
| Revisar reportes, ocultar y aprobar contenido | — | ✅ | ✅ |
| Crear, editar, suspender y eliminar cuentas | — | — | ✅ |
| Cambiar contraseñas | — | — | ✅ |
| Configurar la comunidad | — | — | ✅ |

## Seguridad incluida

- La base de datos pone las reglas (RLS), no solo la página: aunque alguien intente saltarse la interfaz, no puede ver ni cambiar lo que no le corresponde.
- **Contraseñas:** un trigger revierte cualquier cambio que no venga de `admin_cambiar_password`.
- **Suspender** bloquea el ingreso en Supabase Auth y cierra las sesiones abiertas. Sus publicaciones dejan de verse.
- **Filtro de palabras:** si una publicación o comentario contiene una palabra prohibida, queda retenido y se crea un reporte automático.
- **Moderación previa (opcional):** una docente aprueba cada publicación antes de que se vea.
- Todas las acciones de docentes y administración quedan en el **Registro**.

## Corrección a tu tabla original

Tu política *"Consultar miembros activos"* consultaba la misma tabla `usuarios_sociales` dentro de la política. En Supabase eso da el error **infinite recursion detected in policy**. La reemplacé por funciones `SECURITY DEFINER` (`es_activo()`, `es_admin()`, `es_moderador()`). El script conserva tus datos y solo agrega columnas.
