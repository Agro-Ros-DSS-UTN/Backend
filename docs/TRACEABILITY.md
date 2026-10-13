# Matriz de trazabilidad: tabla → relaciones → API → pantalla

Rutas de la API en inglés (sin los alias de la v1). Equivalencias con los nombres en español en `GLOSSARY.md`.
Permisos: **A** = solo administración · **T** = cualquier usuario autenticado · **P** = el vendedor solo lo propio.

| Tabla | Relaciones (FK → regla ON DELETE) | Endpoints | Permiso | Pantalla / componente |
|---|---|---|---|---|
| `users` | — | `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`, `GET/POST/PUT/DELETE /users`, `GET/PUT /users/:id/image` | login público; alta/baja A; edición propio o A | Login, Usuarios, Perfil |
| `user_localities` | usuario → CASCADE · localidad → CASCADE | `GET/PUT /users/:id/zone` | lectura propio o A; escritura A | Usuarios (zona del vendedor), Perfil (zona) |
| `provinces` | — | `GET /provinces` | T | Selector de localidad |
| `localities` | provincia → SET NULL | `GET /localities?q=`, `POST/PUT/DELETE /localities` | lectura T; escritura A | `LocalitySelect` en Empresas, alta rápida y Usuarios |
| `companies` | localidad → RESTRICT · empresa_padre → SET NULL · creado_por → SET NULL | `GET/POST /companies`, `GET/PUT /companies/:id`, `DELETE` (baja lógica), `POST /companies/:id/restore`, `GET /companies/:id/tree`, `GET /companies/:id/dashboard` | lectura/alta T; edición A, creador o vendedor de la zona; baja A | Empresas, ficha de empresa, árbol, **tablero CUU06**, autocompletado |
| `crops`, `company_crops` | empresa → CASCADE · cultivo → CASCADE | `GET/POST /crops`, `cropIds` en empresa | T / alta A | Empresas |
| `contacts` | empresa → RESTRICT (la baja es lógica) | `GET/POST /contacts`, `GET/PUT /contacts/:id` (acepta también el DNI como `:id`), `DELETE` (baja lógica) | T; baja A | Contactos, ficha de contacto, autocompletado |
| `contact_phones` | contacto → CASCADE | dentro de contactos (`phone`, `phones[]`) | T | Contactos |
| `product_lines` | — | `GET/POST/PUT/DELETE /product-lines` | lectura T; escritura A | Productos |
| `catalog_items` | linea → SET NULL | `GET /catalog`, `/products`, `/services`; `POST/PUT/DELETE` | lectura T; escritura A | Productos, Objetivos, Promociones, Órdenes |
| `opportunities` | empresa → RESTRICT · usuario → RESTRICT · contacto → SET NULL · creado_por → SET NULL | `GET/POST /opportunities`, `GET/PUT/DELETE /opportunities/:id`, `POST …/restore` | P (reasignar solo A); para registrar actividad se ven las abiertas de la empresa de cualquier vendedor (P-4); baja: quien la cargó, si no tiene actividades de otros, o A (P-3) | Oportunidades (tabla y kanban de 5 estados), formulario de actividad |
| `opportunity_items` | oportunidad → CASCADE · item → RESTRICT | `items[]` en oportunidad | P | Oportunidades |
| `activities` | oportunidad → RESTRICT · orden_servicio → RESTRICT · parada → SET NULL · usuario → RESTRICT | `GET/POST /activities`, `GET/PUT/DELETE /activities/:id` | P (editar y borrar: solo el autor o A) | Actividades (admin y vendedor) — **CUU01**, cola sin conexión |
| `attachments` | actividad → CASCADE · orden_servicio → CASCADE | `GET /attachments/:id`; alta dentro de la actividad | P | Actividades (fotos y notas de voz) |
| `tasks` | actividad → SET NULL · empresa → SET NULL · **contacto → SET NULL** (P-7) · creado_por / finalizado_por → SET NULL | `GET/POST /tasks`, `PUT`, `PATCH /tasks/:id/complete`, `PATCH …/status`, `DELETE`; `contactId` (o el contacto escrito: si no existe queda en notas) | ver: asignados o creador; editar y borrar: creador o A (P-3); finalizar: asignado o A | Tareas, Inicio, seguimiento de CUU01 |
| `task_assignees` | tarea → CASCADE · usuario → CASCADE | `assigneeIds[]` en tarea | — | Tareas |
| `roadmaps` | usuario → RESTRICT · creado_por → SET NULL | `GET/POST /roadmaps`, `PUT`, `…/start`, `…/complete`, `DELETE` | P (asignar a otro: A) | Hojas de Ruta (admin), Mi hoja de ruta (vendedor) |
| `roadmap_stops` | hoja_ruta → CASCADE · empresa → SET NULL | `PATCH /stops/:id`, `POST /roadmaps/:id/stops` | P | Mapa y lista de paradas |
| `objectives` | usuario → RESTRICT · creado_por → SET NULL | `GET/POST /objectives`, `PUT/DELETE` | lectura P; escritura A | Objetivos — **CUU02**, Inicio del vendedor |
| `objective_companies`, `objective_items`, `objective_promotions` | ambos lados → CASCADE | `companyIds`, `itemIds`, `promotionIds` en objetivo | A | Objetivos |
| `promotions`, `promotion_items` | promoción → CASCADE · item → CASCADE · creado_por → SET NULL | `GET/POST /promotions`, `PUT/DELETE` | lectura T; escritura A | Promociones (admin y vendedor) |
| `internal_notes` | usuario → RESTRICT | `GET/POST/PUT/DELETE /internal-notes` | A | Inicio de administración |
| `notifications` | usuario → CASCADE | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read` | solo las propias | Campana de notificaciones |
| `employees` | — | `GET/POST/PUT/DELETE /employees` (`?role=tecnico,supervisor`) | A | Empleados, selector de técnico |
| `service_orders` | empresa → RESTRICT · servicio → RESTRICT · oportunidad → SET NULL · creado_por → SET NULL | `GET/POST /service-orders`, `PUT`, `DELETE` (baja lógica), `…/restore` | A | Órdenes de servicio, PDF del acta |
| `service_order_employees` | orden → CASCADE · empleado → RESTRICT | `technicianIds[]` o `technicianName` (rol técnico o supervisor) | A | Órdenes de servicio |
| `applied_products` | orden → CASCADE · item → SET NULL | `appliedProducts[]` en orden | A | Órdenes de servicio |
| `service_evaluations` | orden → CASCADE (1:1) | `POST /service-orders/:id/evaluation` | A | Evaluación (con satisfacción del cliente) → tablero CUU06 |
| `migrations` | — | `npm run db:status` / `db:migrate` / `db:rehearse` | servidor | — |
| `_bak_v1_*` | — | — | — | Respaldo interno de la migración (incluye `_bak_v1_oportunidades_antigua`, la tabla vieja sin uso que tenía producción) |

Los usuarios no se borran si tienen historial (RESTRICT): el sistema propone desactivarlos.

Ninguna tabla queda sin pantalla: `crops` se usa solo desde el alta de empresas por API (falta el selector en la
pantalla de Empresas; está anotado como mejora).
