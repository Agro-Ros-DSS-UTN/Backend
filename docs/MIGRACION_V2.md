# Migración de la base de datos a la v2

Este documento explica cómo pasar la base de producción (esquema v1) al modelo de dominio v2.1
**sin perder datos**, y cómo desplegar backend y frontend en el orden correcto.

## Qué hace la migración

Las migraciones están en `src/db/migrations` y se aplican en orden. Cada una es *idempotente*
(se puede volver a correr si se corta a mitad de camino) y queda registrada en la tabla `migraciones`.

| Paso | Archivo | Qué cambia | Datos |
|---|---|---|---|
| 1 | `0001_base_v1` | Punto de partida. Solo crea tablas si la base está vacía (instalación nueva). | — |
| 2 | `0002_respaldo_v1` | Copia **cada tabla con datos** a `_bak_v1_<tabla>` dentro de la misma base. | Respaldo completo |
| 3 | `0003_usuarios_territorio` | Usuarios (email, rol, estado, token_version), provincias, localidades con id propio, zona del vendedor. | Roles normalizados (`admin` → `administrador`) |
| 4 | `0004_empresas_contactos` | `empresas_clientes` → `empresas`; `clientes` → `contactos` con id numérico; teléfonos y cultivos. | Se conservan todos los registros |
| 5 | `0005_catalogo` | `productos` + `services` → `items_catalogo` (producto/servicio) con líneas. | Se conservan precio, costo, stock y frecuencia |
| 6 | `0006_comercial` | `negocios` → `oportunidades` (5 estados), actividades con oportunidad, adjuntos en tabla propia, tareas. | Hora de actividades corregida (+3 h) · texto libre que no se pudo vincular queda en descripción/notas |
| 7 | `0007_planificacion` | Hojas de ruta y paradas, objetivos con fechas y N:M, promociones con ítems, notas, notificaciones. | Semana del objetivo → fechas lunes a domingo |
| 8 | `0008_servicios` | Órdenes vinculadas a empresa/servicio/técnicos; empleados con rol; evaluación con satisfacción. | Técnicos escritos a mano que no existían se dan de alta como empleados con rol técnico |
| 9 | `0009_integridad` | Crea 54 claves foráneas con reglas explícitas, corrige referencias huérfanas y quita las tablas v1 que ya no se usan (con su copia `_bak_v1_*`). | Ningún dato de negocio se pierde |

Las copias `_bak_v1_*` quedan en la base. Cuando la v2 esté funcionando bien en producción unas semanas,
se pueden borrar a mano (no lo hace ningún script).

## Antes de migrar (en tu PC, contra producción)

1. **Auditoría de solo lectura.** No escribe nada (abre la sesión en modo `READ ONLY`):
   ```bash
   cd backend
   npm run db:audit
   ```
   Genera `auditoria-db-AAAA-MM-DD.txt` con tablas, cantidades, valores usados y controles de calidad.
   Mandámelo antes de seguir: confirma que la producción tiene el esquema esperado.
2. **Respaldo externo** desde el panel de Hostinger (phpMyAdmin → Exportar, o la copia automática del hosting).
   La migración ya hace su propio respaldo interno, pero conviene tener uno fuera de la base.

## Orden de despliegue

Hostinger vuelve a desplegar solo cuando se hace push, así que el orden importa:

1. **Variables nuevas en Hostinger** (backend):
   - `JWT_SECRET` con al menos 32 caracteres aleatorios:
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
     Al cambiarlo, todos tienen que volver a iniciar sesión (es lo esperado).
   - `FRONTEND_URL=https://portal.agroquimicarosario.com` (si hay más de un dominio, separarlos con coma).
   - `DB_SSL_CA` (opcional, recomendado): ruta o contenido del certificado de la base para verificar el servidor.
   - `DB_AUTO_MIGRATE` **no** se define (queda apagado).
2. **Migrar la base** desde tu PC, con el `.env` apuntando a producción:
   ```bash
   npm run db:status      # muestra las 9 migraciones pendientes
   npm run db:migrate     # las aplica, con log de cada paso
   npm run db:status      # todas en ✔
   npm run seed:localidades -- --dry-run   # simula la carga de provincias y localidades oficiales
   npm run seed:localidades                # la aplica (une las localidades cargadas a mano)
   ```
   Si algo falla, el error dice en qué paso; se corrige y se vuelve a correr `db:migrate` (retoma donde quedó).
3. **Push del backend.** El servidor nuevo **no arranca** si quedan migraciones pendientes: así es imposible
   que la v2 corra contra datos v1 por error.
4. **Push del frontend.**
5. **Verificación**: `GET /api/health` responde `{"status":"ok"}`; iniciar sesión con un admin y un vendedor
   y revisar Empresas, Oportunidades y Actividades.

Para las pruebas de seguridad automatizadas hay `npm run test:seguridad`, pero **solo contra una base de prueba**
(crea y modifica registros).

## Revisión manual después de migrar

La migración avisa en el log de lo que no pudo resolver solo. En los datos de prueba fueron:

- Actividades sin empresa reconocible: quedan sin oportunidad y con el nombre escrito en la descripción
  (`[Empresa: …]`). Se ven en Actividades y se pueden reasignar.
- Órdenes de servicio cuyo cliente no coincide con ninguna empresa: conservan el nombre del acta y quedan
  sin empresa vinculada (no cuentan en el tablero CUU06 hasta asignarla).
- Promociones que estaban ligadas a una línea sin productos: hay que elegir los productos desde Promociones.
- Objetivos v1 sin año: se interpretaron como semanas del año en curso.

## Volver atrás

Cada migración puede revertirse con `node scripts/db-migrate.mjs down` solo cuando define cómo hacerlo; las de
estructura no lo hacen. La vuelta atrás segura es restaurar el respaldo del paso «Antes de migrar» y volver
a desplegar la versión anterior del código.
