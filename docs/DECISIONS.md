# Decisiones del 11/10/2026 (P-1 a P-9)

Respuestas a los puntos «Para decidir» de la revisión de la v2. En el código se citan como `P-n`
(las decisiones anteriores del modelo, `D-n`, siguen vigentes). Los nombres de tablas y columnas están en inglés desde la
migración 0012 (ver `GLOSSARY.md`).

| # | Tema | Decisión | Cómo quedó |
|---|---|---|---|
| P-1 | Costo, stock y frecuencia de facturación de productos | Se conservan: se van a cargar productos más adelante. | `catalog_items` mantiene `unit_cost`, `stock_available` y `billing_frequency`. |
| P-2 | Estados de oportunidad | 5 estados (Prospecto, Contactado, Cotizado, Ganada, Perdida) + potencialidad. | Sin cambios respecto de la revisión. |
| P-3 | Bajas del vendedor | Solo lo que creó él: oportunidades, tareas y actividades. Empresas y contactos, solo administración. | Oportunidades con `created_by_id`; el vendedor no da de baja una que cargó otro ni una con actividades de otros usuarios. Tareas: editar y borrar solo quien la creó. Los botones se ocultan cuando no corresponde. |
| P-4 | Oportunidades de otros vendedores al registrar una actividad | Visibilidad global (puede servirle a los dos). | Sin cambios: al registrar una actividad se ven las oportunidades abiertas de la empresa de cualquier vendedor. |
| P-5 | Duración de la sesión | A criterio. | 8 h la sesión normal; «Mantener la sesión iniciada» baja de 7 a **3 días**. Cambiar contraseña, rol o estado corta la sesión igual. |
| P-6 | Reglas de contraseña | La estricta, para todos. | Servidor y pantallas: 8 a 64 caracteres, con mayúscula, número y símbolo. Las contraseñas actuales siguen funcionando; la regla se aplica al crear o cambiar. |
| P-7 | Contacto de una tarea | A criterio (preferencia: vínculo a un contacto). | `tasks.contact_id` → `contacts`. El formulario sugiere solo los contactos de la empresa elegida; la tabla muestra nombre y teléfono. Lo escrito a mano que no coincide con un contacto queda en las notas. Las tareas de seguimiento de una actividad toman el contacto de la oportunidad. |
| P-8 | Cuándo se migra la base | A criterio. | Manual desde tu PC, **con ensayo previo sobre una copia** (`db:rehearse`) y respaldo propio (`db:backup`); vuelta atrás probada (`db:restore`). Ver `MIGRACION_V2.md`. |
| P-9 | Localidades | Córdoba, Entre Ríos, Santa Fe, Buenos Aires, Corrientes, San Juan y San Luis. | `seed:localities` carga esas 7 por defecto (las 24 provincias se dan de alta igual). `--all` para el país completo. |

Además, a partir de la auditoría de producción: rol de empleado **Supervisor** (el empleado actual es «Supervisor de
Campo»), que también puede figurar como técnico de una orden de servicio.

## Nombres en inglés (13/10/2026)

| Tema | Decisión | Cómo quedó |
|---|---|---|
| Idioma de los nombres | Pedido de la cátedra: todo en inglés, incluida la base. | Clases, archivos, variables, rutas de la API, campos JSON, tablas, columnas, índices y FKs en inglés (migración `0012_english_names`, ensayada sobre una copia con la estructura de producción). |
| Qué queda en español | Mensajes al usuario, comentarios y el diagrama de dominio. | Además, los **valores guardados** (estados, tipos, roles, códigos de notificación): son datos, no nombres. Cambiarlos obligaba a reescribir filas reales sin beneficio. |
| Alias de rutas v1 | Se quitan. | La API solo responde en las rutas nuevas; backend y frontend se publican juntos. |
