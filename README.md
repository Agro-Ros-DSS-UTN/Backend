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

El proyecto se desarrolla bajo arquitectura **MVC**.

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express (JavaScript) |
| Frontend | HTML + CSS |
| Base de datos | MySQL |
| Autenticación | JWT |

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

`docs/`, `scripts/` y `src/db/migrations/` quedan **solo en la PC** (están en `.gitignore`): son la documentación,
los comandos de mantenimiento (`npm run db:*`, `seed:*`, `test:security`) y las migraciones de la base, que se
corren a mano desde la PC. El servidor no los necesita: al arrancar solo verifica que la base tenga aplicada la
última migración que conoce el código (`LATEST_MIGRATION` en `src/db/migrator.js`, que se actualiza al agregar una).
Quien clone el repositorio necesita una copia de esas carpetas para migrar o mantener la base.
