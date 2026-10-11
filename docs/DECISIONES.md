# Decisiones del 11/10/2026 (P-1 a P-9)

Respuestas a los puntos «Para decidir» de la revisión de la v2. En el código se citan como `P-n`
(las decisiones anteriores del modelo, `D-n`, siguen vigentes).

| # | Tema | Decisión | Cómo quedó |
|---|---|---|---|
| P-1 | Costo, stock y frecuencia de facturación de productos | Se conservan: se van a cargar productos más adelante. | `items_catalogo` mantiene `costo_unitario`, `stock_disponible` y `frecuencia_facturacion`. |
| P-2 | Estados de oportunidad | 5 estados (Prospecto, Contactado, Cotizado, Ganada, Perdida) + potencialidad. | Sin cambios respecto de la revisión. |
| P-3 | Bajas del vendedor | Solo lo que creó él: oportunidades, tareas y actividades. Empresas y contactos, solo administración. | Oportunidades con `creado_por_id`; el vendedor no da de baja una que cargó otro ni una con actividades de otros usuarios. Tareas: editar y borrar solo quien la creó. Los botones se ocultan cuando no corresponde. |
| P-4 | Oportunidades de otros vendedores al registrar una actividad | Visibilidad global (puede servirle a los dos). | Sin cambios: al registrar una actividad se ven las oportunidades abiertas de la empresa de cualquier vendedor. |
| P-5 | Duración de la sesión | A criterio. | 8 h la sesión normal; «Mantener la sesión iniciada» baja de 7 a **3 días**. Cambiar contraseña, rol o estado corta la sesión igual. |
| P-6 | Reglas de contraseña | La estricta, para todos. | Servidor y pantallas: 8 a 64 caracteres, con mayúscula, número y símbolo. Las contraseñas actuales siguen funcionando; la regla se aplica al crear o cambiar. |
| P-7 | Contacto de una tarea | A criterio (preferencia: vínculo a un contacto). | `tareas.contacto_id` → `contactos`. El formulario sugiere solo los contactos de la empresa elegida; la tabla muestra nombre y teléfono. Lo escrito a mano que no coincide con un contacto queda en las notas. Las tareas de seguimiento de una actividad toman el contacto de la oportunidad. |
| P-8 | Cuándo se migra la base | A criterio. | Manual desde tu PC, **con ensayo previo sobre una copia** (`db:ensayo`) y respaldo propio (`db:respaldo`); vuelta atrás probada (`db:restaurar`). Ver `MIGRACION_V2.md`. |
| P-9 | Localidades | Córdoba, Entre Ríos, Santa Fe, Buenos Aires, Corrientes, San Juan y San Luis. | `seed:localidades` carga esas 7 por defecto (las 24 provincias se dan de alta igual). `--todas` para el país completo. |

Además, a partir de la auditoría de producción: rol de empleado **Supervisor** (el empleado actual es «Supervisor de
Campo»), que también puede figurar como técnico de una orden de servicio.
