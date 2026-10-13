# Migración de la base de datos a la v2

Este documento explica cómo pasar la base de producción (esquema v1) al modelo de dominio v2.1
**sin perder datos**, cómo ensayarlo antes sobre una copia y cómo desplegar en el orden correcto.

## Qué hace la migración

Las migraciones están en `src/db/migrations` y se aplican en orden. Cada una es *idempotente*
(se puede volver a correr si se corta a mitad de camino) y queda registrada en la tabla `migrations` (hasta la 0011 se llamaba `migraciones`; el migrador la renombra solo).

| Paso | Archivo | Qué cambia | Datos |
|---|---|---|---|
| 1 | `0001_base_v1` | Punto de partida. Solo crea tablas si la base está vacía (instalación nueva). | — |
| 2 | `0002_backup_v1` | Copia **cada tabla con datos** a `_bak_v1_<tabla>` dentro de la misma base. | Respaldo interno |
| 3 | `0003_users_territory` | Unifica la collation de todas las tablas; usuarios (email, rol, estado, token_version, teléfono), provincias, localidades con id propio, zona del vendedor. | `admin` → `administrador`, `activo` → `Activo` (escritura forzada, ver abajo) · `telefonos_usuario` → `usuarios.telefono` |
| 4 | `0004_companies_contacts` | `empresas_clientes` → `empresas`; `clientes` → `contactos` con id numérico; teléfonos y cultivos. | Se conservan todos los registros |
| 5 | `0005_catalog` | `productos` + `services` → `items_catalogo` (producto/servicio) con líneas. | Se conservan precio, costo, stock y frecuencia (P-1) |
| 6 | `0006_commercial` | `negocios` → `oportunidades` (5 estados, P-2) con `creado_por_id` (P-3); actividades con oportunidad; adjuntos en tabla propia; tareas con `contacto_id` (P-7). | Hora de actividades corregida (+3 h) · empresa/contacto escritos a mano se vinculan con comparación tolerante (mayúsculas, acentos, espacios) · lo que no se pudo vincular queda en descripción/notas |
| 7 | `0007_planning` | Hojas de ruta y paradas, objetivos con fechas y N:M, promociones con ítems, notas, notificaciones. | Semana del objetivo → fechas lunes a domingo |
| 8 | `0008_services` | Órdenes vinculadas a empresa/servicio/técnicos; empleados con rol (técnico, **supervisor**, ayudante, chofer, administrativo); evaluación con satisfacción. | Técnicos escritos a mano que no existían se dan de alta como empleados |
| 9 | `0009_integrity` | Crea 56 claves foráneas con reglas explícitas, corrige referencias huérfanas y quita las tablas v1 que ya no se usan (con su copia `_bak_v1_*`). | Ningún dato de negocio se pierde |
| 10 | `0010_placeholder_emails` | Emails inventados en la carga inicial (`no-email-…@ejemplo.com`) y valores como "2" quedan vacíos. Si era un texto escrito a mano no válido, se copia a las observaciones. | Contactos, empleados y usuarios · los originales quedan en `_bak_v1_*` |
| 11 | `0011_placeholder_national_ids` | DNI correlativos inventados en la carga inicial quedan vacíos. | Contactos · los originales quedan en `_bak_v1_*` |
| 12 | `0012_english_names` | **Nombres en inglés**: tablas, columnas, índices y las 56 FKs (ver `GLOSSARY.md`); claves del JSON de la planilla de evaluación. | Ningún valor cambia: solo nombres. Las `_bak_v1_*` quedan como estaban |

Las copias `_bak_v1_*` quedan en la base. Cuando la v2 esté funcionando bien en producción unas semanas,
se pueden borrar a mano (no lo hace ningún script).

## Pasar producción a los nombres en inglés (0011 + 0012)

Producción ya está en la v2 (0001–0010 aplicadas). Esta actualización aplica la 0011 y la 0012 y publica el código
con nombres en inglés. **Backend y frontend van juntos**: la API ya no tiene las rutas en español y el código nuevo
no arranca hasta que la base esté migrada. El sitio no funciona unos minutos, entre el paso 3 y el 5.

1. En el `.env` de tu PC, cambiar `ENSAYO_DB_NAME/USER/PASS` por `REHEARSAL_DB_NAME/USER/PASS` (mismos valores).
2. **Respaldo**: `npm run db:backup` (queda en `backups/`) y, si se quiere, la copia de hPanel.
3. Opcional, recomendado: **ensayo** sobre la base de ensayo, que ya tiene una copia vieja: `npm run db:rehearse -- --replace`.
   Tiene que terminar en «todo OK» (56 FKs, cada modelo contra su tabla, mismas cantidades antes y después).
4. **Migrar** producción:
   ```bash
   npm run db:status      # 0011 y 0012 pendientes
   npm run db:migrate
   npm run db:status      # todas en ✔
   ```
5. **Push del backend** y enseguida **push del frontend**.
6. **Verificación**: `GET /api/health`; entrar como admin y como vendedor y revisar Inicio, Empresas, Oportunidades,
   Actividades, Tareas y Hojas de ruta.

Lo que cambia para los usuarios: las direcciones de las pantallas pasan al inglés (`/admin/companies`,
`/seller/roadmap`…), así que un marcador guardado con la dirección vieja lleva al inicio. La sesión iniciada, los
borradores de formularios y las actividades pendientes de enviar sin conexión se pasan solos al formato nuevo.
Quien tenga la página abierta durante el cambio tiene que recargarla.

Volver atrás: restaurar el respaldo del paso 2 (`npm run db:restore -- backups/<archivo>.sql --target=<base> --replace`)
y volver a publicar los commits anteriores de backend y frontend.

## Lo que mostró la auditoría de producción (11/10/2026)

La base real es **MariaDB 11.8** con collation `utf8mb4_unicode_ci` (no distingue mayúsculas ni acentos) y tiene
diferencias con la base de prueba original. Todas se reprodujeron en una copia de prueba con la misma estructura
y la migración se ajustó:

| Hallazgo | Qué habría pasado | Cómo quedó |
|---|---|---|
| Existe una tabla `oportunidades` vieja (0 filas, modelo HubSpot con `seller_id`) además de `negocios`. | La migración se cortaba en el paso 6, con los pasos 3 a 5 ya aplicados: sitio caído hasta restaurar. | Se aparta como `_bak_v1_oportunidades_antigua` y `negocios` toma su nombre. |
| Usuarios con `role = 'admin'` y `account_statement = 'activo'` (minúscula). | Con la collation de producción el motor no escribía el cambio a `Activo` y **nadie podía iniciar sesión** con la v2. | Los valores se reescriben pasando por un valor intermedio (`setExact`); el ensayo verifica cada valor con comparación exacta. Lo mismo para tipos de contacto (`Visita` → `visita`), estados de tareas y de oportunidades. |
| Tablas `telefonos_usuario`, `vendedores` y `formularios_actividad` con otra forma y FKs con nombres generados (`…_ibfk_239`). | Tablas sin lugar en la v2. | Las FKs se sueltan por consulta, no por nombre; las tablas se respaldan y se eliminan; el teléfono del usuario pasa a `usuarios.telefono`. |
| 2 empresas con empresa madre inexistente. | La FK nueva fallaba. | Quedan sin madre (el valor viejo está en `_bak_v1_empresas_clientes`). |
| 3 CUIT repetidos. | — | Se conservan (no hay índice único); el alta nueva valida duplicados. |
| 2 actividades sin negocio con un nombre de empresa que no coincide exacto. | Quedaban sueltas. | Se buscan también ignorando mayúsculas, acentos y espacios, y por nombre de contacto; si igual no coinciden, el texto queda en la descripción. |
| 120 localidades cargadas a mano, `provincias` vacía. | — | Se unen con las oficiales con `seed:localities` (desempata por código postal). |

## Procedimiento original v1 → v2 (P-8: migración manual, con ensayo previo; ya aplicado)

### A. Una sola vez, en tu PC

1. Tener la rama `seguridad-modelo-v2` del backend (ver «Traer la rama» en el README) y correr `npm install` en `backend`.
2. El `.env` de producción queda **como está** (no se cambian credenciales).

### B. Ensayo sobre una copia (no toca producción)

1. En hPanel → Bases de datos, crear una base vacía (por ejemplo `u767704345_crm_ensayo`) con su usuario.
2. Agregar al `.env` (no se sube al repositorio):
   ```
   REHEARSAL_DB_NAME=u767704345_crm_ensayo
   REHEARSAL_DB_USER=<usuario de esa base>
   REHEARSAL_DB_PASS=<contraseña de esa base>
   ```
3. Correr:
   ```bash
   npm run db:rehearse
   ```
   Lee producción en modo solo lectura, la copia a la base de ensayo, migra la copia y verifica: migraciones al día,
   56 FKs, tablas viejas eliminadas, cada modelo contra su tabla, **cada valor contra las listas del modelo** y las
   cantidades antes/después. Deja el informe en `migration-rehearsal-AAAA-MM-DD-HHMM.txt` (sin datos personales).
4. Opcional: probar la v2 con los datos reales de la copia:
   ```bash
   npm run dev:rehearsal          # API en http://localhost:3000 contra la base de ensayo (sin mails ni calendario)
   cd ../frontend && npm run dev
   ```

Si el ensayo da «todo OK», la migración de producción va a hacer exactamente lo mismo.

### C. Día de la migración

Entre el paso 3 y el 5 el sitio no funciona (el código viejo no entiende la base nueva y el nuevo no arranca hasta
que esté migrada): son unos minutos. Conviene hacerlo fuera del horario de trabajo.

1. **Variables nuevas en Hostinger** (backend):
   - `JWT_SECRET` con al menos 32 caracteres aleatorios:
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
     Al cambiarlo, todos tienen que volver a iniciar sesión (es lo esperado).
   - `FRONTEND_URL=https://portal.agroquimicarosario.com` (si hay más de un dominio, separarlos con coma).
   - `DB_SSL_CA` (opcional, recomendado): ruta o contenido del certificado de la base para verificar el servidor.
   - `DB_AUTO_MIGRATE` **no** se define (queda apagado).
2. **Respaldo**, dos copias independientes:
   ```bash
   npm run db:backup           # backups/<base>-AAAA-MM-DD-HHMM.sql (solo lectura sobre la base)
   ```
   y además la copia de Hostinger (hPanel → Bases de datos → Copias de seguridad, o phpMyAdmin → Exportar).
   El archivo tiene datos reales: guardarlo en un lugar seguro, nunca en el repositorio (`backups/` está ignorado).
3. **Migrar** desde tu PC, con el `.env` de producción:
   ```bash
   npm run db:status      # 9 pendientes
   npm run db:migrate     # las aplica, con log de cada paso
   npm run db:status      # todas en ✔
   npm run seed:localities -- --dry-run   # simula: 24 provincias y localidades de las 7 provincias de trabajo (P-9)
   npm run seed:localities                 # la aplica y une las 120 localidades cargadas a mano
   ```
   Si algo falla, el error dice en qué paso; se corrige y se vuelve a correr `db:migrate` (retoma donde quedó).
4. **Push del backend.** El servidor nuevo **no arranca** si quedan migraciones pendientes.
5. **Push del frontend.**
6. **Verificación**: `GET /api/health` responde `{"status":"ok"}`; iniciar sesión con un admin y un vendedor
   y revisar Empresas, Oportunidades, Actividades y Tareas.

`seed:localities` necesita internet (API Georef de datos.gob.ar). Para todo el país: `--all`.

Para las pruebas automatizadas hay `npm run test:security`, pero **solo contra una base de prueba**
(crea y modifica registros).

## Localidades que la carga automática no pudo unir

`npm run localities:resolve` (simulación) y `npm run localities:resolve -- --apply`:
- une las localidades manuales con nombre distinto al oficial (Monte de Oca → Montes de Oca, etc.) según una lista revisada contra Georef;
- para nombres repetidos en varias provincias (Villa Fontana, San Pedro) decide por la dirección de la empresa y la característica telefónica de sus contactos; si no hay pistas, no toca nada;
- borra los códigos postales heredados de la v1 (no eran reales) y las ciudades repetidas de Georef como "entidad".

## Revisión manual después de migrar

El informe del ensayo y el log de la migración listan lo que no se pudo resolver solo:

- Actividades sin empresa reconocible: quedan sin oportunidad y con el nombre escrito en la descripción
  (`[Empresa: …]`). Se ven en Actividades y se pueden reasignar.
- Tareas cuyo contacto escrito no está cargado: el nombre queda en las notas (`Contacto: …`).
- Localidades manuales que no coincidieron con ninguna oficial: se corrigen desde la ficha de la empresa.
- Promociones que estaban ligadas a una línea sin productos: hay que elegir los productos desde Promociones.
- Objetivos v1 sin año: se interpretaron como semanas del año en curso.

## Volver atrás

Restaurar el respaldo del paso C.2 deja la base **idéntica** a como estaba (se eliminan también las tablas v2 y el
registro de migraciones) y volver a desplegar `main`:

```bash
npm run db:restore -- backups/<archivo>.sql --target=<base de producción> --replace
```

Pide escribir el nombre de la base para confirmar. También se puede importar el `.sql` desde phpMyAdmin.
Probado: backup → migración → restauración da una base igual a la original.
