# Matriz de trazabilidad: tabla → relaciones → API → pantalla

Ruta canónica en español; entre paréntesis, el alias v1 que se mantiene mientras haya pantallas viejas.
Permisos: **A** = solo administración · **T** = cualquier usuario autenticado · **P** = el vendedor solo lo propio.

| Tabla | Relaciones (FK → regla ON DELETE) | Endpoints | Permiso | Pantalla / componente |
|---|---|---|---|---|
| `usuarios` | — | `POST /auth/login` (`/users/login`), `GET /auth/me`, `POST /auth/cambiar-password`, `GET/POST/PUT/DELETE /usuarios` (`/users`), `GET/PUT /usuarios/:id/imagen` | login público; alta/baja A; edición propio o A | Login, Usuarios, Perfil |
| `usuario_localidades` | usuario → CASCADE · localidad → CASCADE | `GET/PUT /usuarios/:id/zona` | lectura propio o A; escritura A | Usuarios (zona del vendedor), Perfil (zona) |
| `provincias` | — | `GET /provincias` | T | Selector de localidad |
| `localidades` | provincia → SET NULL | `GET /localidades?q=`, `POST/PUT/DELETE /localidades` | lectura T; escritura A | `LocalidadSelect` en Empresas, alta rápida y Usuarios |
| `empresas` | localidad → RESTRICT · empresa_padre → SET NULL · creado_por → SET NULL | `GET/POST /empresas` (`/clientCompany`), `GET/PUT /empresas/:id`, `DELETE` (baja lógica), `POST /empresas/:id/restaurar`, `GET /empresas/:id/arbol` (`/tree`), `GET /empresas/:id/tablero` | lectura/alta T; edición A, creador o vendedor de la zona; baja A | Empresas, ficha de empresa, árbol, **tablero CUU06**, autocompletado |
| `cultivos`, `empresa_cultivos` | empresa → CASCADE · cultivo → CASCADE | `GET/POST /cultivos`, `cultivoIds` en empresa | T / alta A | Empresas |
| `contactos` | empresa → RESTRICT (la baja es lógica) | `GET/POST /contactos` (`/clientes`), `GET/PUT /contactos/:id` (acepta DNI en `/clientes/:x`), `DELETE` (baja lógica) | T; baja A | Contactos, ficha de contacto, autocompletado |
| `contacto_telefonos` | contacto → CASCADE | dentro de contactos (`telefono`, `telefonos[]`) | T | Contactos |
| `lineas_producto` | — | `GET/POST/PUT/DELETE /lineas-producto` (`/lineaProds`) | lectura T; escritura A | Productos |
| `items_catalogo` | linea → SET NULL | `GET /catalogo`, `/productos`, `/servicios`; `POST/PUT/DELETE` | lectura T; escritura A | Productos, Objetivos, Promociones, Órdenes |
| `oportunidades` | empresa → RESTRICT · usuario → RESTRICT · contacto → SET NULL · creado_por → SET NULL | `GET/POST /oportunidades` (`/opportunities`), `GET/PUT/DELETE /oportunidades/:id`, `POST …/restaurar` | P (reasignar solo A); para registrar actividad se ven las abiertas de la empresa de cualquier vendedor (P-4); baja: quien la cargó, si no tiene actividades de otros, o A (P-3) | Oportunidades (tabla y kanban de 5 estados), formulario de actividad |
| `oportunidad_items` | oportunidad → CASCADE · item → RESTRICT | `items[]` en oportunidad | P | Oportunidades |
| `actividades` | oportunidad → RESTRICT · orden_servicio → RESTRICT · parada → SET NULL · usuario → RESTRICT | `GET/POST /actividades` (`/formulario-actividad`), `GET/PUT/DELETE /actividades/:id` | P (editar y borrar: solo el autor o A) | Actividades (admin y vendedor) — **CUU01**, cola sin conexión |
| `adjuntos` | actividad → CASCADE · orden_servicio → CASCADE | `GET /adjuntos/:id`; alta dentro de la actividad | P | Actividades (fotos y notas de voz) |
| `tareas` | actividad → SET NULL · empresa → SET NULL · **contacto → SET NULL** (P-7) · creado_por / finalizado_por → SET NULL | `GET/POST /tareas` (`/tasks`), `PUT`, `PATCH /tareas/:id/finalizar`, `PATCH …/estado`, `DELETE`; `contactoId` (o `contacto` escrito: si no existe queda en notas) | ver: asignados o creador; editar y borrar: creador o A (P-3); finalizar: asignado o A | Tareas, Inicio, seguimiento de CUU01 |
| `tarea_asignados` | tarea → CASCADE · usuario → CASCADE | `asignadosIds[]` en tarea | — | Tareas |
| `hojas_ruta` | usuario → RESTRICT · creado_por → SET NULL | `GET/POST /hojas-ruta` (`/roadmaps`), `PUT`, `…/iniciar`, `…/finalizar`, `DELETE` | P (asignar a otro: A) | Hojas de Ruta (admin), Mi hoja de ruta (vendedor) |
| `paradas_ruta` | hoja_ruta → CASCADE · empresa → SET NULL | `PATCH /paradas/:id`, `POST /hojas-ruta/:id/paradas` | P | Mapa y lista de paradas |
| `objetivos` | usuario → RESTRICT · creado_por → SET NULL | `GET/POST /objetivos` (`/objectives`), `PUT/DELETE` | lectura P; escritura A | Objetivos — **CUU02**, Inicio del vendedor |
| `objetivo_empresas`, `objetivo_items`, `objetivo_promociones` | ambos lados → CASCADE | `empresaIds`, `itemIds`, `promocionIds` en objetivo | A | Objetivos |
| `promociones`, `promocion_items` | promoción → CASCADE · item → CASCADE · creado_por → SET NULL | `GET/POST /promociones` (`/promotions`), `PUT/DELETE` | lectura T; escritura A | Promociones (admin y vendedor) |
| `notas_internas` | usuario → RESTRICT | `GET/POST/PUT/DELETE /notas-internas` (`/internal-notes`) | A | Inicio de administración |
| `notificaciones` | usuario → CASCADE | `GET /notificaciones`, `PATCH /notificaciones/:id/leida`, `PATCH /notificaciones/leidas` | solo las propias | Campana de notificaciones |
| `empleados` | — | `GET/POST/PUT/DELETE /empleados` (`?rol=tecnico,supervisor`) | A | Empleados, selector de técnico |
| `ordenes_servicio` | empresa → RESTRICT · servicio → RESTRICT · oportunidad → SET NULL · creado_por → SET NULL | `GET/POST /ordenes-servicio`, `PUT`, `DELETE` (baja lógica), `…/restaurar` | A | Órdenes de servicio, PDF del acta |
| `orden_empleados` | orden → CASCADE · empleado → RESTRICT | `tecnicoIds[]` o `tecnicoAplicador` (rol técnico o supervisor) | A | Órdenes de servicio |
| `productos_aplicados` | orden → CASCADE · item → SET NULL | `productosAplicados[]` en orden | A | Órdenes de servicio |
| `evaluaciones_servicio` | orden → CASCADE (1:1) | `POST /ordenes-servicio/:id/evaluacion` | A | Evaluación (con satisfacción del cliente) → tablero CUU06 |
| `migraciones` | — | `npm run db:status` / `db:migrate` / `db:ensayo` | servidor | — |
| `_bak_v1_*` | — | — | — | Respaldo interno de la migración (incluye `_bak_v1_oportunidades_antigua`, la tabla vieja sin uso que tenía producción) |

Los usuarios no se borran si tienen historial (RESTRICT): el sistema propone desactivarlos.

Ninguna tabla queda sin pantalla: `cultivos` se usa solo desde el alta de empresas por API (falta el selector en la
pantalla de Empresas; está anotado como mejora).
