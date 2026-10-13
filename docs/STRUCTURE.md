# Ayuda memoria: qué hay en cada carpeta

Para cada repositorio: qué hace funcionar al sistema, qué es apoyo (herramientas y documentación)
y qué queda solo en tu PC (nunca se sube a GitHub).

## Backend (`C:\CRM AgroRos\Develop\BackEnd AgroRos`)

### Lo que hace funcionar al sistema (se sube y Hostinger lo ejecuta)

| Carpeta / archivo | Para qué sirve |
|---|---|
| `server.js` | Punto de entrada: arranca la API, aplica la seguridad (CORS, cabeceras, límites), verifica que la base esté migrada y programa los recordatorios. |
| `package.json` / `package-lock.json` | Librerías que usa el backend y sus versiones exactas. Hostinger instala a partir de acá. |
| `src/config/` | Configuración: variables de entorno validadas (`env.js`) y conexión a la base (`database.js`). |
| `src/models/` | El modelo de dominio: una clase por tabla (`Company`, `Contact`, `Opportunity`…; equivalencias en `GLOSSARY.md`), agrupadas por tema, y en `index.js` todas las relaciones. |
| `src/controllers/` | La lógica de cada pantalla: validar lo que llega, aplicar los permisos y leer/escribir la base. |
| `src/routes/` | Qué dirección de la API llama a qué controlador y qué rol puede usarla. |
| `src/middlewares/` | Pasos comunes a todas las peticiones: verificar la sesión (token), el rol, los límites de intentos y el manejo de errores. |
| `src/services/` | Integraciones externas: mails de recordatorio y Google Calendar. |
| `src/jobs/` | Tareas programadas (barrido de recordatorios cada 30 minutos). |
| `src/utils/` | Funciones chicas que usan todos: respuestas de error y validación de datos. |
| `src/db/` | El motor de migraciones (`migrator.js`, `schema.js`) y las migraciones en `migrations/`. **Funcional**: el servidor no arranca si hay migraciones pendientes. |

### Apoyo: se sube, pero el sistema no lo usa para funcionar

| Carpeta | Para qué sirve |
|---|---|
| `scripts/` | Comandos que se corren a mano desde tu PC: respaldo y restauración de la base, ensayo de migración, carga de localidades, auditoría, alta de administrador y pruebas de seguridad. Cada uno tiene su `npm run …` (ver README). |
| `docs/` | Documentación: migración, seguridad, trazabilidad, decisiones, glosario español → inglés, el diagrama de dominio y este archivo. |
| `README.md` | Cómo instalar, variables de entorno y lista de comandos. |
| `.gitignore` | Qué archivos no se suben nunca. |

### Solo en tu PC (no se sube: está en `.gitignore`)

| Carpeta / archivo | Qué es | Cuidado |
|---|---|---|
| `.env` | Contraseñas y datos de conexión (base de producción, base de ensayo, clave de sesiones). | **Nunca** subirlo ni compartirlo. En Hostinger están cargadas aparte, en Variables de entorno. |
| `node_modules/` | Las librerías descargadas por `npm install`. | Se regenera sola; se puede borrar sin perder nada. |
| `backups/` | Los `.sql` de `npm run db:backup` (antes `respaldos/`). | Tienen **datos reales**: guardarlos en un lugar seguro. |
| `migration-rehearsal-*.txt`, `db-audit-*.txt` (y los viejos `ensayo-migracion-*`, `auditoria-db-*`) | Informes de los scripts. | Se pueden borrar. |

### Sobrantes para limpiar

`public/` (favicon.svg, icons.svg) y `src/assets/` (hero.png, vite.svg) quedaron de la plantilla con la
que se creó el proyecto: el backend no los usa.

## Frontend (`C:\CRM AgroRos\Develop\FrontEnd AgroRos`)

### Lo que hace funcionar al sistema (se sube; Hostinger lo compila con `npm run build`)

| Carpeta / archivo | Para qué sirve |
|---|---|
| `index.html`, `vite.config.js` | Página base y configuración de la compilación. |
| `package.json` / `package-lock.json` | Librerías del frontend y sus versiones. |
| `public/` | Archivos que se publican tal cual (logo, íconos, `.htaccess` para que las rutas del navegador funcionen en Hostinger). |
| `src/pages/` | Las pantallas, separadas en `admin/`, `seller/` (vendedor) y `auth/` (login). |
| `src/components/` | Piezas reutilizables: tablas de tareas y actividades, formularios, selectores, el menú, etc. |
| `src/api/` | Las llamadas al backend, una por tema (empresas, contactos, actividades…). `apiClient.js` agrega el token y maneja la sesión vencida. |
| `src/context/` | Estado compartido de la aplicación (la sesión del usuario). |
| `src/hooks/` | Funciones reutilizables de React (notificaciones, cerrar modales). |
| `src/data/` | Listas fijas (estados, tipos de contacto, roles) y adaptadores de datos. |
| `src/utils/` | Funciones chicas: escapar texto, validar enlaces, la cola de actividades sin conexión. |
| `src/styles/`, `src/assets/` | Estilos generales, colores e imágenes. |

### Apoyo

| Archivo | Para qué sirve |
|---|---|
| `eslint.config.js` | Reglas de estilo del código (lo revisa el editor, no afecta al sistema). |
| `README.md`, `.gitignore` | Igual que en el backend. |

### Solo en tu PC (no se sube)

| Carpeta | Qué es |
|---|---|
| `node_modules/` | Librerías descargadas; se regeneran con `npm install`. |
| `dist/` | El resultado de `npm run build`. Hostinger lo genera solo; el local se puede borrar. |
| `.claude/` | Configuración de Claude Code en tu PC. |
