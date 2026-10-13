# Glosario español → inglés

Desde la migración `0012_english_names` todos los nombres del código y de la base están en inglés
(pedido de la cátedra). **No se tradujo:**

- Los textos que ve el usuario (mensajes, etiquetas, errores) y los comentarios del código: siguen en español.
- Los **valores guardados** en la base: estados (`Pendiente`, `en_curso`, `Ganada`…), tipos (`visita`, `llamada`,
  `producto`, `servicio`), roles (`admin`, `vendedor`, `tecnico`, `supervisor`), códigos de notificación
  (`tarea`, `objetivo`, `hoja_ruta`), niveles (`madre`, `subsede`), tipos de trabajo (`fumigacionSilo`…).
  Son datos, no nombres: cambiarlos obligaría a reescribir filas de producción sin ganar nada.
- Las copias de respaldo `_bak_v1_*` (conservan la estructura original de la v1).
- El diagrama de dominio (`docs/DiagramaMD-DSS-v2.1.drawio`), que queda en español. Esta tabla sirve para leerlo
  junto al código.

Las columnas `id` y las que ya estaban en inglés (`email`, `password_hash`, `token_version`, `item_id`…) no cambian.

## Modelos (clases)

| Diagrama / v2 en español | Código |
|---|---|
| Usuario | `User` |
| Provincia | `Province` |
| Localidad | `Locality` |
| UsuarioLocalidad | `UserLocality` |
| Empresa | `Company` |
| Cultivo | `Crop` |
| EmpresaCultivo | `CompanyCrop` |
| Contacto | `Contact` |
| ContactoTelefono | `ContactPhone` |
| LineaProducto | `ProductLine` |
| ItemCatalogo | `CatalogItem` |
| Oportunidad | `Opportunity` |
| OportunidadItem | `OpportunityItem` |
| Actividad | `Activity` |
| Adjunto | `Attachment` |
| Tarea | `Task` |
| TareaAsignado | `TaskAssignee` |
| HojaRuta | `Roadmap` |
| ParadaRuta | `RoadmapStop` |
| Objetivo | `Objective` |
| ObjetivoEmpresa | `ObjectiveCompany` |
| ObjetivoItem | `ObjectiveItem` |
| ObjetivoPromocion | `ObjectivePromotion` |
| Promocion | `Promotion` |
| PromocionItem | `PromotionItem` |
| NotaInterna | `InternalNote` |
| Notificacion | `Notification` |
| Empleado | `Employee` |
| OrdenServicio | `ServiceOrder` |
| OrdenEmpleado | `ServiceOrderEmployee` |
| ProductoAplicado | `AppliedProduct` |
| EvaluacionServicio | `ServiceEvaluation` |

## Tablas y columnas

| Tabla anterior | Tabla nueva | Columnas renombradas |
|---|---|---|
| `actividades` | `activities` | tipo_contacto → contact_type, fecha_hora → occurred_at, descripcion → description, resultado → result, monto_venta → sale_amount, sin_seguimiento → no_follow_up, oportunidad_id → opportunity_id, orden_servicio_id → service_order_id, parada_id → roadmap_stop_id, usuario_id → user_id, fecha_registro → created_at |
| `productos_aplicados` | `applied_products` | orden_servicio_id → service_order_id, tipo_instalacion → facility_type, numero → number, capacidad_tn → capacity_tn, grano → grain, cantidad_tn → quantity_tn, estado_cereal → grain_condition, estado_instalaciones → facility_condition, estado_infestacion → infestation_level, producto → product, principio_activo → active_ingredient, dosis → dose, lote → batch, tiempo_carencia → withdrawal_period, cantidad_total → total_quantity |
| `adjuntos` | `attachments` | actividad_id → activity_id, orden_servicio_id → service_order_id, tipo → type, nombre_archivo → file_name, tamanio_kb → size_kb, contenido → content, fecha_carga → uploaded_at |
| `items_catalogo` | `catalog_items` | tipo → type, nombre → name, codigo → code, descripcion → description, precio_referencia → reference_price, costo_unitario → unit_cost, frecuencia_facturacion → billing_frequency, stock_disponible → stock_available, activo → active, imagen → image, linea_id → product_line_id, principio_activo → active_ingredient, presentacion → presentation, tipo_servicio → service_type, unidad_medida → unit_of_measure, fecha_alta → created_at |
| `empresas` | `companies` | razon_social → legal_name, nombre_fantasia → trade_name, descripcion → description, direccion → address, tipo_empresa → company_type, superficie_ha → area_ha, proveedor_actual → current_supplier, nivel → level, empresa_padre_id → parent_company_id, localidad_id → locality_id, latitud → latitude, longitud → longitude, creado_por_id → created_by_id, fecha_registro → created_at, fecha_baja → deleted_at |
| `empresa_cultivos` | `company_crops` | empresa_id → company_id, cultivo_id → crop_id |
| `contacto_telefonos` | `contact_phones` | contacto_id → contact_id, numero → number |
| `contactos` | `contacts` | dni → national_id, nombre_apellido → full_name, cargo → job_title, es_principal → is_primary, observaciones → notes, empresa_id → company_id, fecha_alta → created_at, fecha_baja → deleted_at |
| `cultivos` | `crops` | nombre → name, meses_necesidad → demand_months |
| `empleados` | `employees` | nombre_apellido → full_name, dni → national_id, matricula → license_number, rol → role, puesto → job_title, telefono → phone, empresa → company, fecha_ingreso → hire_date, activo → active, observaciones → notes, fecha_creacion → created_at |
| `notas_internas` | `internal_notes` | categoria → category, descripcion → description, estado → status, fecha_nota → created_at, usuario_id → user_id |
| `localidades` | `localities` | nombre → name, codigo_postal → postal_code, latitud → latitude, longitud → longitude, provincia_id → province_id |
| `notificaciones` | `notifications` | usuario_id → user_id, tipo → type, mensaje → message, entidad → entity, entidad_id → entity_id, leida → is_read, fecha_hora → occurred_at |
| `objetivo_empresas` | `objective_companies` | objetivo_id → objective_id, empresa_id → company_id |
| `objetivo_items` | `objective_items` | objetivo_id → objective_id |
| `objetivo_promociones` | `objective_promotions` | objetivo_id → objective_id, promocion_id → promotion_id |
| `objetivos` | `objectives` | descripcion → description, tipo_objetivo → objective_type, tipo_periodo → period_type, fecha_inicio → start_date, fecha_fin → end_date, cantidad_meta → target_amount, usuario_id → user_id, creado_por_id → created_by_id, fecha_creacion → created_at |
| `oportunidades` | `opportunities` | titulo → title, estado → status, potencialidad → potential, volumen_potencial → potential_volume, volumen_facturado → billed_volume, fecha_inicio → start_date, fecha_cierre_estimada → expected_close_date, fecha_ultima_actualizacion → last_activity_at, motivo_perdida → loss_reason, empresa_id → company_id, usuario_id → user_id, contacto_id → contact_id, creado_por_id → created_by_id, fecha_baja → deleted_at |
| `oportunidad_items` | `opportunity_items` | oportunidad_id → opportunity_id, cantidad → quantity |
| `lineas_producto` | `product_lines` | codigo → code, nombre → name, categoria → category |
| `promocion_items` | `promotion_items` | promocion_id → promotion_id |
| `promociones` | `promotions` | nombre → name, descripcion → description, beneficio → benefit, condiciones → conditions, fecha_inicio → start_date, fecha_fin → end_date, creado_por_id → created_by_id |
| `provincias` | `provinces` | nombre → name |
| `paradas_ruta` | `roadmap_stops` | hoja_ruta_id → roadmap_id, orden → sort_order, empresa_id → company_id, nombre_lugar → place_name, direccion → address, latitud → latitude, longitud → longitude, estado → status, hora_estimada → estimated_time, notas → notes, origen → source |
| `hojas_ruta` | `roadmaps` | nombre → name, descripcion → description, fecha → date, hora_inicio_plan → planned_start_time, fecha_fin_plan → planned_end_date, hora_fin_plan → planned_end_time, estado → status, usuario_id → user_id, creado_por_id → created_by_id, distancia_estimada_km → estimated_distance_km, observaciones → notes, inicio_real → actual_start_at, fin_real → actual_end_at, fecha_creacion → created_at |
| `evaluaciones_servicio` | `service_evaluations` | orden_servicio_id → service_order_id, fecha_evaluacion → evaluation_date, estado_cereal → grain_condition, lugar_toma → sampling_point, resultado → result, observaciones → notes, recomendaciones → recommendations, detalle → details, fotos → photos, firma_cliente → customer_signature, firma_tecnico → technician_signature, satisfaccion_cliente → customer_satisfaction, comentario_cliente → customer_comment |
| `orden_empleados` | `service_order_employees` | orden_servicio_id → service_order_id, empleado_id → employee_id |
| `ordenes_servicio` | `service_orders` | numero_orden → order_number, empresa_id → company_id, servicio_id → service_id, oportunidad_id → opportunity_id, fecha_programada → scheduled_date, fecha_realizada → completed_date, estado → status, cliente_id → customer_code, cliente_nombre → customer_name, centro_id → center_code, centro_nombre → center_name, planta_id → plant_code, planta_nombre → plant_name, direccion → address, localidad → locality, provincia → province, tipo_trabajo → work_type, observaciones → notes, recomendaciones → recommendations, firma_tecnico → technician_signature, firma_cliente → customer_signature, imagen_orden_original → original_order_image, creado_por_id → created_by_id, fecha_creacion → created_at, fecha_baja → deleted_at |
| `tarea_asignados` | `task_assignees` | tarea_id → task_id, usuario_id → user_id, recordatorio_48h_enviado → reminder_48h_sent, recordatorio_24h_enviado → reminder_24h_sent |
| `tareas` | `tasks` | titulo → title, descripcion → description, tipo → type, prioridad → priority, fecha_creacion → created_at, fecha_vencimiento → due_date, hora_vencimiento → due_time, notas → notes, estado → status, empresa_id → company_id, contacto_id → contact_id, actividad_id → activity_id, creado_por_id → created_by_id, finalizado_por_id → completed_by_id, fecha_finalizacion → completed_at |
| `usuario_localidades` | `user_localities` | usuario_id → user_id, localidad_id → locality_id |
| `usuarios` | `users` | nombre_apellido → full_name, telefono → phone, rol → role, estado_cuenta → account_status, fecha_ingreso → hire_date, fecha_alta → created_at, ultimo_acceso → last_login_at |
| `migraciones` | `migrations` | nombre → name, descripcion → description, ejecutada_en → executed_at, duracion_ms → duration_ms |

Los índices y las 56 claves foráneas se renombraron con el mismo criterio (`ix_activities_occurred_at`,
`fk_opportunities_company_id`…). En el modelo, `roadmap_stops.sort_order` se llama `sortOrder`, pero la API lo
sigue devolviendo como `order`.

## Rutas de la API (`/api/…`)

| Antes | Ahora |
|---|---|
| `actividades` | `activities` |
| `adjuntos` | `attachments` |
| `cambiar-password` | `change-password` |
| `catalogo` | `catalog` |
| `contactos` | `contacts` |
| `restaurar` | `restore` |
| `cultivos` | `crops` |
| `empleados` | `employees` |
| `empresas` | `companies` |
| `arbol` | `tree` |
| `tablero` | `dashboard` |
| `hojas-ruta` | `roadmaps` |
| `finalizar` | `complete` |
| `iniciar` | `start` |
| `paradas` | `stops` |
| `lineas-producto` | `product-lines` |
| `localidades` | `localities` |
| `notas-internas` | `internal-notes` |
| `notificaciones` | `notifications` |
| `leida` | `read` |
| `leidas` | `read` |
| `objetivos` | `objectives` |
| `oportunidades` | `opportunities` |
| `ordenes-servicio` | `service-orders` |
| `evaluacion` | `evaluation` |
| `productos` | `products` |
| `promociones` | `promotions` |
| `provincias` | `provinces` |
| `servicios` | `services` |
| `tareas` | `tasks` |
| `estado` | `status` |
| `usuarios` | `users` |
| `imagen` | `image` |
| `zona` | `zone` |

Ya no existen los alias de la v1 (`/users/login`, `/clientCompany`, `/formulario-actividad`, `/lineaProds`…):
el frontend nuevo usa solo las rutas en inglés, por eso backend y frontend se publican juntos.

## Pantallas (rutas del frontend)

| Antes | Ahora |
|---|---|
| `inicio` | `home` |
| `negocios` | `deals` |
| `perfil` | `profile` |
| `rutas` | `roadmaps` |
| `hoja-de-ruta` | `roadmap` |
| `campañas` | `campaigns` |
| `empresas` | `companies` |
| `contactos` | `contacts` |
| `actividades` | `activities` |
| `tareas` | `tasks` |
| `objetivos` | `objectives` |
| `promociones` | `promotions` |
| `usuarios` | `users` |
| `empleados` | `employees` |
| `ordenes-servicio` | `service-orders` |
| `productos` | `products` |

## Archivos

| Antes | Ahora |
|---|---|
| `actividad.controller` | `activity.controller` |
| `catalogo.controller` | `catalog.controller` |
| `contacto.controller` | `contact.controller` |
| `empleado.controller` | `employee.controller` |
| `empresa.controller` | `company.controller` |
| `hojaRuta.controller` | `roadmap.controller` |
| `notaInterna.controller` | `internalNote.controller` |
| `notificacion.controller` | `notification.controller` |
| `objetivo.controller` | `objective.controller` |
| `oportunidad.controller` | `opportunity.controller` |
| `ordenServicio.controller` | `serviceOrder.controller` |
| `promocion.controller` | `promotion.controller` |
| `tarea.controller` | `task.controller` |
| `territorio.controller` | `territory.controller` |
| `usuario.controller` | `user.controller` |
| `catalogo.model` | `catalog.model` |
| `comercial.model` | `commercial.model` |
| `empresa.model` | `company.model` |
| `planificacion.model` | `planning.model` |
| `servicios.model` | `services.model` |
| `territorio.model` | `territory.model` |
| `usuario.model` | `user.model` |
| `validacion` | `validation` |
| `texto` | `text` |
| `crear-admin` | `create-admin` |
| `ensayo-migracion` | `rehearse-migration` |
| `resolver-localidades` | `resolve-localities` |
| `respaldo-db` | `backup-db` |
| `restaurar-respaldo` | `restore-backup` |
| `seed-localidades` | `seed-localities` |
| `servidor-ensayo` | `rehearsal-server` |
| `valores` | `values` |
| `volcado` | `dump` |
| `colaOffline` | `offlineQueue` |
| `seguridad` | `security` |
| `useNotificaciones` | `useNotifications` |
| `LocalidadSelect` | `LocalitySelect` |
| `plantillasLayout` | `templateLayouts` |
| `catalogos` | `catalogs` |
| `docs/DECISIONES.md`, `MIGRACION_V2.md`, `SEGURIDAD.md`, `ESTRUCTURA.md`, `TRAZABILIDAD.md` | `DECISIONS.md`, `MIGRATION_V2.md`, `SECURITY.md`, `STRUCTURE.md`, `TRACEABILITY.md` |
| migraciones `0002_respaldo_v1` … `0011_dni_de_relleno` | `0002_backup_v1` … `0011_placeholder_national_ids` (el migrador reconoce los nombres viejos ya aplicados) |

## Comandos y variables de entorno

| Antes | Ahora |
|---|---|
| `npm run db:respaldo` | `npm run db:backup` |
| `npm run db:restaurar -- <archivo> --destino=<base> [--reemplazar]` | `npm run db:restore -- <archivo> --target=<base> [--replace]` |
| `npm run db:ensayo` | `npm run db:rehearse` |
| `npm run dev:ensayo` | `npm run dev:rehearsal` |
| `npm run db:crear-admin` | `npm run db:create-admin` |
| `npm run seed:localidades[:ensayo]` (`--todas`) | `npm run seed:localities[:rehearsal]` (`--all`) |
| `npm run localidades:resolver` (`--aplicar`) | `npm run localities:resolve` (`--apply`) |
| `npm run test:seguridad` | `npm run test:security` |
| carpeta `respaldos/` | carpeta `backups/` |
| `ENSAYO_DB_NAME`, `ENSAYO_DB_USER`, `ENSAYO_DB_PASS` (y `ENSAYO_*`) | `REHEARSAL_DB_NAME`, `REHEARSAL_DB_USER`, `REHEARSAL_DB_PASS` (y `REHEARSAL_*`) |
