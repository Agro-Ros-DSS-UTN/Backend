# AgroRosario

**Aplicación web de comunicación interna para Agroquímica Rosario**
Trabajo Práctico — UTN FRRo, Ingeniería en Sistemas de Información

---

## Descripción

AgroRosario digitaliza la comunicación entre los vendedores y la administración de una empresa agroquímica, reemplazando la gestión manual (llamadas telefónicas y mensajes de WhatsApp) por una plataforma centralizada. Permite planificar objetivos comerciales, organizar hojas de ruta, registrar el resultado de cada visita o llamada, y hacer seguimiento del proceso de ventas de punta a punta.

## Objetivo

Optimizar la operativa comercial de la empresa mediante:

- La asignación de objetivos semanales de visitas y ventas a cada vendedor.
- La organización de hojas de ruta.
- El registro estructurado de actividades en campo (visitas, llamadas, adjuntos).
- El seguimiento del proceso comercial de cada cliente, desde el primer contacto hasta el cierre de la venta.
- La generación de tareas de seguimiento y reportes para la administración.

## Roles de usuario

| Rol | Permisos principales |
|---|---|
| **Administración** | Asigna objetivos y hojas de ruta a los vendedores, crea tareas de seguimiento, gestiona promociones, visualiza reportes y estadísticas de todo el equipo. |
| **Vendedor** | Consulta sus objetivos y hoja de ruta asignados, registra actividades (visitas/llamadas) con adjuntos, hace seguimiento de sus clientes y oportunidades. |

## Funcionalidades principales

- **Gestión de usuarios**: registro, login y permisos diferenciados por rol (JWT).
- **Objetivos y hoja de ruta**: la administración define metas semanales (clientes a visitar, productos a ofrecer, promociones vigentes) y arma rutas para cada vendedor.
- **Registro de actividades**: formulario de carga de visitas/llamadas, con adjuntos (fotos, documentos, audios) y generación automática de tareas de seguimiento.
- **Seguimiento comercial (pipeline)**: cada relación comercial se rastrea como una oportunidad, con su propio estado (Prospecto → Lead → Negociación → Activo/Perdido), volumen potencial y facturado.
- **Panel de administración**: visualización del progreso del equipo, reportes semanales/mensuales y alertas (clientes sin contacto, oportunidades estancadas).

## Arquitectura y stack tecnológico

| Parte | Tecnología |
|---|---|
| Frontend | React 18 + Vite + React Router (JavaScript), Leaflet para los mapas — repositorio aparte |
| Backend | Node.js + Express 5 + Sequelize 6 (JavaScript, módulos ES), API REST |
| Base de datos | MariaDB 11 (compatible con MySQL) en Hostinger; el esquema lo manejan migraciones versionadas |
| Autenticación | JWT con permisos por rol (administrador / vendedor) |
| Servicios externos | Correo SMTP (recordatorios de tareas) y Google Calendar (opcionales) |
| Despliegue | Hostinger publica la rama `main` de cada repositorio |

### Backend en capas

Cada entidad del modelo de dominio tiene su carpeta en `src/modules/<entidad>/` con estas capas:

| Capa | Archivo | Qué hace | Qué **no** hace |
|---|---|---|---|
| Rutas | `xxx.routes.js` | Dice qué método y dirección llama a qué controlador, y qué middlewares pasan antes (rol de administrador, límite de intentos). | No tiene lógica. |
| Controller | `xxx.controller.js` | Recibe la request, toma los datos (`req.body`, `req.params`, el usuario del token) y devuelve la response con su código HTTP. | No decide reglas de negocio ni toca la base. |
| Service | `xxx.service.js` | La **lógica de negocio**: validaciones, permisos de propiedad (un vendedor solo ve lo suyo), cálculos, transacciones y cómo se arma el JSON de respuesta. | No escribe consultas: le pide los datos al repository. |
| Repository | `xxx.repository.js` | Todo el **acceso a datos**: consultas Sequelize a la base. Las APIs externas también son repositories (`src/shared/repositories/mail.repository.js`, `googleCalendar.repository.js`). | No decide reglas. |
| Entity | `xxx.entity.js` | El modelo Sequelize de **una tabla**: columnas, tipos y valores permitidos. | No tiene lógica de negocio. |

Las tablas de detalle o intermedias (por ejemplo `opportunityItem`, `roadmapStop`, `taskAssignee`) tienen solo su
entity, en la carpeta de su entidad principal, y las maneja el repository de esa entidad. Las relaciones entre
entities están todas juntas en `src/shared/models/index.js`.

**Ejemplo: `POST /opportunities` (crear una oportunidad)**

1. `server.js` aplica lo común a toda la API: cabeceras de seguridad, CORS, límite de pedidos y
   `authenticateAll`, que verifica el token y deja el usuario en `req.user`.
2. **Rutas** — `src/shared/routes/index.js` monta `opportunity.routes.js`, que tiene
   `router.post('/opportunities', opportunities.create)`.
3. **Controller** — `opportunity.controller.create` le pasa a la capa de servicio el body y quién es el usuario
   (`admin`, `currentUserId`) y responde `201 { message: 'Oportunidad creada', data }`.
4. **Service** — `opportunity.service.createNewOpportunity` abre una transacción y aplica las reglas: título por
   defecto, empresa obligatoria, un vendedor solo puede crearla a su nombre, la empresa, el contacto y el responsable
   tienen que existir, estado inicial `Prospecto`, y guarda los productos/servicios ofrecidos.
5. **Repository** — `opportunity.repository` hace las consultas: `findCompanyById`, `create`, `replaceItems`,
   `findByIdWithSummary`.
6. **Entity** — `Opportunity` (`opportunity.entity.js`) y `OpportunityItem` (`opportunityItem.entity.js`).
7. **Base** — se insertan filas en `opportunities` y `opportunity_items`.

Si algo falla, el service lanza un error (`badRequest`, `forbidden`…) y `errorHandler.middleware.js` lo
convierte en `{ message, code, fields }` con el código HTTP correspondiente.

### Carpetas del backend

```text
server.js                      Arranque: seguridad, autenticación, rutas, verificación de migraciones
src/
├── modules/                   Una carpeta por entidad
│   ├── activity/              activity.{routes,controller,service,repository,entity}.js + attachment.entity.js
│   ├── catalog-item/          catalogItem.* (productos y servicios: /catalog, /products, /services)
│   ├── company/               company.* + companyCrop.entity.js
│   ├── contact/               contact.* + contactPhone.entity.js
│   ├── crop/                  crop.*
│   ├── dashboard/             dashboard.{routes,controller,service,repository}.js (tablero general, sin tabla propia)
│   ├── employee/              employee.*
│   ├── internal-note/         internalNote.*
│   ├── locality/              locality.*
│   ├── notification/          notification.*
│   ├── objective/             objective.* + objectiveCompany/objectiveItem/objectivePromotion.entity.js
│   ├── opportunity/           opportunity.* + opportunityItem.entity.js
│   ├── product-line/          productLine.*
│   ├── promotion/             promotion.* + promotionItem.entity.js
│   ├── province/              province.*
│   ├── roadmap/               roadmap.* + roadmapStop.entity.js
│   ├── service-order/         serviceOrder.* + serviceOrderEmployee/appliedProduct/serviceEvaluation.entity.js
│   ├── task/                  task.* + taskAssignee.entity.js + taskReminders.job.js
│   └── user/                  user.* (incluye /auth) + userLocality.entity.js (zona del vendedor)
└── shared/                    Lo que usan todos los módulos
    ├── config/                Variables de entorno validadas (env.js) y conexión a la base (database.js)
    ├── db/                    Motor de migraciones (migrator.js, schema.js); las migraciones quedan solo en la PC
    ├── middlewares/           Autenticación y roles, seguridad (CORS, límites), manejo de errores
    ├── models/index.js        Importa cada entity y declara las relaciones entre tablas
    ├── repositories/          APIs externas: mail.repository.js (SMTP), googleCalendar.repository.js
    ├── routes/index.js        Monta los xxx.routes.js de cada entidad
    └── utils/                 Respuestas y errores HTTP (http.js), validación de datos (validation.js)
```

`xxx.*` indica los cinco archivos de la entidad: `routes`, `controller`, `service`, `repository` y `entity`.

## Modelo de dominio (resumen)

Entidades principales del sistema:

- **Usuario** (superclase) → `Administrador`, `Vendedor`
- **Cliente** (contacto de una empresa) y **EmpresaCliente** (cuenta comercial: CUIT, superficie, tipo de empresa)
- **Oportunidad**: negociación puntual entre un vendedor y una empresa cliente, con su propio estado y volumen de venta
- **FormularioActividad**: registro de cada visita/llamada realizada, con adjuntos
- **Objetivo**: meta semanal asignada por la administración a un vendedor
- **HojaRuta** y **Tarea**: creadas por la administración y asignadas a un vendedor
- **Servicio, LineaProd, Cultivo, TipoProd**: catálogos comerciales y agronómicos
- **Localidad / Provincia**: ubicación geográfica de las empresas cliente
- **Promocion**: promociones vigentes sobre líneas de producto
- **Nota**: comunicación interna entre administradores (pedidos y despachos)

El modelo completo, con atributos y multiplicidades, se documenta por separado como parte del análisis de diseño del proyecto.

## Metodología de trabajo

El proyecto sigue un enfoque en **cascada**, con documentación formal versionada en cada etapa (minutas de reunión, especificación de requerimientos, modelo de dominio). Cada entregable queda registrado con su fecha, versión y autor para mantener trazabilidad de los cambios.

## Repositorios

- **Backend**: [Agro-Ros-DSS-UTN/Backend](https://github.com/Agro-Ros-DSS-UTN/Backend)
- **Frontend**: [Agro-Ros-DSS-UTN/Frontend](https://github.com/Agro-Ros-DSS-UTN/Frontend)

## Integrantes

| Legajo | Nombre |
|---|---|
| 54756 | Jager, Mateo |
| 54508 | Torrezan, Marco |
| 54162 | Oertlin Merini, María Victoria |
| 54400 | Fernández González, Manuel |

## Instalación y uso

_Próximamente._

## Documentación

La especificación funcional completa y las minutas de reunión se encuentran en la carpeta de documentación del proyecto.

---

## Backend v2: puesta en marcha

### Variables de entorno 

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | sí | Conexión a MySQL/MariaDB |
| `DB_SSL` | no (`true`) | Conexión cifrada |
| `DB_SSL_CA` | recomendada | Certificado de la base para verificar el servidor |
| `JWT_SECRET` | sí | 32+ caracteres aleatorios. Sin esto el servidor no arranca |
| `FRONTEND_URL` | sí | Dominio(s) del frontend separados por coma (CORS) |
| `JWT_EXPIRES_IN` / `JWT_LONG_EXPIRES_IN` | no (`8h` / `3d`) | Duración de la sesión normal y de "mantener sesión" |
| `DB_AUTO_MIGRATE` | no (`false`) | Aplicar migraciones al arrancar. En producción, dejar apagado |
| `TRUST_PROXY` | no | Saltos de proxy (Hostinger: `1`) para ver la IP real en el límite de intentos |
| `SMTP_*`, `GOOGLE_*` | no | Recordatorios por mail y Google Calendar |
| `REHEARSAL_DB_NAME`, `REHEARSAL_DB_USER`, `REHEARSAL_DB_PASS` | no | Base de ensayo para `db:rehearse` y `dev:rehearsal` (solo en tu PC; antes `ENSAYO_DB_*`) |

### Comandos

```bash
npm run db:audit          # auditoría de solo lectura (sirve contra producción)
npm run db:backup         # respaldo completo en backups/*.sql (solo lectura)
npm run db:restore -- <archivo.sql> --target=<base>   # deja la base igual al respaldo (--replace si no está vacía)
npm run db:rehearse       # copia producción a la base de ensayo, la migra y verifica (no toca producción)
npm run dev:rehearsal     # API local contra la base de ensayo, sin mails ni calendario
npm run seed:localities:rehearsal  # localidades oficiales en la base de ensayo
npm run localities:resolve         # une las localidades manuales que quedaron sueltas (--apply)
npm run companies:afa              # ordena AFA en regiones y sedes con datos de afascl.coop (--apply)
npm run companies:cleanup          # duplicados, registros de prueba, empresas con sedes y localidades (--apply)
npm run companies:cuit             # CUIT reales (con fuente) donde había uno inventado (--apply)
npm run companies:geocode          # direcciones faltantes (con fuente) y coordenadas validadas con OpenStreetMap (--apply)
npm run db:status         # migraciones aplicadas / pendientes
npm run db:migrate        # aplica las pendientes (hace respaldo _bak_v1_* la primera vez)
npm run seed:localities   # provincias + localidades de las 7 provincias de trabajo (Georef); --all, --dry-run
npm run db:create-admin -- <id> "<Nombre>"   # crea o reactiva un administrador
npm run test:security     # pruebas de seguridad (solo contra una base de prueba)
npm start
```

### Nombres en inglés

Clases, archivos, variables, rutas de la API, campos JSON, tablas y columnas están en inglés; los mensajes al
usuario, los comentarios y los valores guardados (estados, tipos, roles) siguen en español. La equivalencia con
los nombres anteriores y con el diagrama está en [`docs/GLOSSARY.md`](docs/GLOSSARY.md).

### Qué no se sube a GitHub

`docs/`, `scripts/` y `src/shared/db/migrations/` quedan **solo en la PC** (están en `.gitignore`): son la documentación,
los comandos de mantenimiento (`npm run db:*`, `seed:*`, `test:security`) y las migraciones de la base, que se
corren a mano desde la PC. El servidor no los necesita: al arrancar solo verifica que la base tenga aplicada la
última migración que conoce el código (`LATEST_MIGRATION` en `src/shared/db/migrator.js`, que se actualiza al agregar una).
Quien clone el repositorio necesita una copia de esas carpetas para migrar o mantener la base.
