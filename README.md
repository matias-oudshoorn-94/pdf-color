# Jetcopy · Centro de impresiones online

Sistema web para que los clientes suban archivos, los reutilicen desde un catálogo y generen pedidos de impresión que el administrador gestiona desde un panel.

Pensado para **hosting compartido**: se sube por FTP, se importa el SQL y funciona. Sin Node, sin build, sin dependencias externas.


## Stack

| Capa | Tecnología |
| --- | --- |
| Backend | PHP 8.2+ en MVC (sin frameworks), PDO con sentencias preparadas |
| Frontend | JavaScript con módulos ES nativos, HTML y CSS (sin compilar) |
| Base de datos | MySQL 8 / MariaDB 10.4+ |
| Sesión | Sesiones nativas con cookie httpOnly + protección CSRF |

## Estructura

```
public_html/            ← esto va en la raíz web del hosting
  index.html            ← la web pública (SPA)
  .htaccess             ← ruteo SPA, cabeceras de seguridad, caché
  css/                  ← base / layout / components
  js/
    models/             ← datos y estado (API, sesión, carrito)
    views/              ← markup: layout, componentes, logo
    controllers/        ← lógica de cada página
    lib/                ← utilidades (DOM, formato, avisos)
    router.js  main.js
  admin/                ← panel de administración (app independiente)
    index.html          ← con su propio login
    css/admin.css
    js/
      models/           ← cliente de los endpoints /api/admin
      views/            ← modales reutilizables
      controllers/      ← resumen, pedidos, archivos, usuarios, mensajes
      main.js           ← shell + navegación
  assets/               ← logo e imagen de fondo
  api/                  ← backend
    index.php           ← front controller (autoload, errores, CSRF)
    config.php          ← credenciales y ajustes (editar al subir)
    .htaccess           ← enruta a index.php y bloquea el código fuente
    src/
      Core/             ← Router, Database, Request, Response, Auth, Csrf, Validator, RateLimiter
      Models/           ← User, FileRecord, Order, Settings
      Controllers/      ← Auth, File, Order, Contact, Settings, Admin
      Services/         ← Uploader, PageCounter
      routes.php        ← mapa de endpoints
  storage/
    uploads/            ← archivos de los clientes (acceso directo bloqueado por .htaccess)
    thumbs/             ← miniaturas generadas (idem)
database.sql            ← esquema completo + admin inicial
migrations/             ← cambios de esquema para bases ya creadas
server.php  dev.sh      ← servidor local de desarrollo
```

## Panel de administración

Aplicación separada del sitio público, en **`/admin`**, con su propia pantalla de acceso.
Solo entran usuarios con rol `admin`; el backend valida el rol en cada endpoint, no alcanza con conocer la URL.

| Sección | Qué permite |
| --- | --- |
| Resumen | Métricas de pedidos por estado, clientes, archivos, almacenamiento y últimos pedidos |
| Precios | Precio por hoja de impresión, usado para calcular el total de cada pedido |
| Pedidos | Búsqueda por cliente/email/número, filtro por estado, detalle de impresión, descarga de archivos, cambio de estado y borrado |
| Archivos | Listado global con búsqueda, descarga, edición (título, descripción, curso, hojas, visibilidad) y borrado |
| Localidades | ABM de localidades |
| Instituciones | ABM de instituciones, cada una dentro de una localidad |
| Cursos y materias | ABM de año + división + materia por institución (ej: 7mo · B · Física) |
| Clientes | ABM de cuentas de cliente, con sus contadores de archivos y pedidos |
| Administradores | ABM de cuentas con acceso al panel (protege que quede al menos un admin) |
| Mensajes | Bandeja del formulario de contacto, con respuesta por email y borrado |

Clientes y administradores viven en la misma tabla `users` diferenciados por la columna `role`,
pero se gestionan en secciones separadas. Cambiar el tipo de cuenta desde el formulario de edición
mueve al usuario de una sección a la otra.

### Localidades → Instituciones → Cursos

La clasificación de los archivos tiene tres niveles:

```
Localidad (Mar del Plata)
  └─ Institución (Escuela N° 2)
       └─ Curso (7mo · B · Física)
            └─ Archivos
```

Al subir un archivo el usuario elige localidad → institución → curso con selectores encadenados.
Es **opcional**: un archivo sin curso asignado funciona igual, solo no aparece en los filtros por institución.
El catálogo usa esos mismos tres niveles como filtros, combinables con la búsqueda por texto.

Borrar un curso deja los archivos sin clasificar (no los elimina). No se puede borrar una localidad
con instituciones ni una institución con cursos.

### Precios automáticos

El total de un pedido se calcula solo: **hojas del archivo × copias × precio por hoja**. Al subir un
archivo se detecta la cantidad de hojas automáticamente (PDF vía Imagick/Ghostscript si está disponible,
o si no con una lectura directa del archivo; el resto de los formatos cuenta como 1 hoja). El admin puede
corregir la cantidad de hojas de un archivo desde **Archivos** si la detección falla, y configura el
precio por hoja desde **Precios**. Color, tamaño de hoja, faz y terminación todavía no afectan el precio.

Cada ítem de un pedido guarda una foto del precio al momento de confirmarlo (hojas, precio por hoja y
total), así que cambiar el precio o corregir las hojas de un archivo no altera pedidos ya hechos.

Hay datos iniciales listos para cargar en `migrations/002_seed_localidades.sql`: 60 localidades de la
provincia de Buenos Aires e instituciones, cursos y materias de ejemplo para Mar del Plata.

## Desarrollo local

```bash
./dev.sh                 # http://localhost:8000
```

Requiere PHP 8.2+ con las extensiones `pdo_mysql`, `fileinfo` y `mbstring`, y un MySQL local.
Antes de arrancar, creá `public_html/api/config.local.php` con tus credenciales:

```php
<?php
return [
    'app' => ['env' => 'local'],
    'db'  => ['name' => 'pdfcolor', 'user' => 'root', 'pass' => 'secreto'],
];
```

Ese archivo no se versiona y pisa los valores de `config.php`.

## Subir al hosting

1. Subí el contenido de `public_html/` a la raíz web (`public_html`, `www` o `htdocs`), incluida la carpeta `storage/` (queda dentro de la raíz web; el `.htaccess` de `storage/uploads/` y `storage/thumbs/` impide el acceso directo a los archivos, así que solo se pueden descargar a través de la API).
2. Dale permisos de escritura (755) a `storage/uploads/` y `storage/thumbs/`.
3. Importá `database.sql` desde phpMyAdmin sobre una base vacía.
4. Editá `api/config.php` con los datos de la base y poné `'env' => 'production'`.
5. Ingresá con `admin@pdfcolor.local` / `cambiar123` y **cambiá la contraseña**.

## API

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/health` | público | Chequeo de estado |
| POST | `/api/auth/register` | público | Registro |
| POST | `/api/auth/login` | público | Login |
| POST | `/api/auth/logout` | público | Cierra sesión |
| GET | `/api/auth/me` | público | Usuario actual + token CSRF |
| GET | `/api/files` | sesión | Catálogo con filtros `search`, `locationId`, `institutionId`, `courseId` |
| GET | `/api/files/mine` | sesión | Mis archivos |
| POST | `/api/files` | sesión | Subida (multipart, campo `file`) |
| GET | `/api/files/{id}/download` | sesión | Descarga |
| DELETE | `/api/files/{id}` | sesión | Borra archivo propio |
| POST | `/api/orders` | sesión | Crea pedido |
| GET | `/api/orders/mine` | sesión | Mis pedidos |
| GET | `/api/orders/{id}` | sesión | Detalle |
| GET | `/api/orders/admin` | admin | Todos los pedidos |
| PATCH | `/api/orders/{id}/status` | admin | Cambia estado |
| GET | `/api/contact` | público | Datos de contacto |
| POST | `/api/contact` | público | Envía mensaje |
| GET | `/api/locations` | sesión | Localidades para los selectores |
| GET | `/api/institutions` | sesión | Instituciones (filtro `locationId`) |
| GET | `/api/courses` | sesión | Cursos de una institución (`institutionId`) |
| GET | `/api/settings` | sesión | Configuración pública (precio por hoja) |
| GET | `/api/admin/stats` | admin | Métricas del panel |
| PATCH | `/api/admin/settings` | admin | Cambia el precio por hoja |
| GET | `/api/admin/orders` | admin | Pedidos con filtro y búsqueda |
| PATCH | `/api/admin/orders/{id}/status` | admin | Cambia estado |
| DELETE | `/api/admin/orders/{id}` | admin | Borra pedido |
| GET | `/api/admin/files` | admin | Todos los archivos |
| PATCH | `/api/admin/files/{id}` | admin | Edita título/descripción/visibilidad |
| DELETE | `/api/admin/files/{id}` | admin | Borra archivo |
| GET | `/api/admin/clients` | admin | Usuarios con contadores (filtro `role`) |
| POST | `/api/admin/clients` | admin | Crea usuario |
| PATCH | `/api/admin/clients/{id}` | admin | Edita usuario |
| DELETE | `/api/admin/clients/{id}` | admin | Borra usuario |
| GET | `/api/admin/messages` | admin | Mensajes de contacto |
| DELETE | `/api/admin/messages/{id}` | admin | Borra mensaje |
| GET POST PATCH DELETE | `/api/admin/locations[/{id}]` | admin | ABM de localidades |
| GET POST PATCH DELETE | `/api/admin/institutions[/{id}]` | admin | ABM de instituciones |
| GET POST PATCH DELETE | `/api/admin/courses[/{id}]` | admin | ABM de cursos y materias |

## Seguridad aplicada

- Consultas siempre con sentencias preparadas (PDO, sin emulación).
- Contraseñas con `password_hash()` y rehash automático.
- Sesión con cookie `httpOnly`, `SameSite=Lax` y `Secure` bajo HTTPS; ID regenerado al iniciar sesión.
- CSRF por doble envío en todo método que modifica datos.
- Límite de intentos en login, registro y contacto.
- Subidas: MIME verificado con `finfo`, extensión derivada del MIME, nombre aleatorio, tamaño limitado y almacenamiento fuera de la web.
- Escapado de HTML en todo dato que se inyecta en el DOM.
- Cabeceras `nosniff`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.

## Cómo agregar una funcionalidad

1. **Backend**: método nuevo en un controlador de `api/src/Controllers/`, consultas en el modelo correspondiente y una línea en `api/src/routes.php`.
2. **Frontend público**: función en `js/models/resources.js`, controlador en `js/controllers/` y la ruta en `js/router.js`.
3. **Panel**: método en `admin/js/models/admin.api.js`, controlador en `admin/js/controllers/` y una entrada en el array `SECTIONS` de `admin/js/main.js`.
4. Si necesita tablas nuevas, agregalas a `database.sql`.
