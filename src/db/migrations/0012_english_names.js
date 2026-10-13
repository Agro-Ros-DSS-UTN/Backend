// Nombres en inglés para tablas, columnas, índices y claves foráneas.
// No cambia ningún valor: solo nombres (también las claves del JSON donde se
// guarda la planilla de evaluación). Los valores guardados que ve el usuario
// (estados, tipos, roles: "Pendiente", "visita", "vendedor"...) siguen igual.
// Las copias _bak_v1_* quedan con su nombre original.
//
// Orden: se sueltan las FKs, se renombran columnas y tablas, se traducen las claves
// del JSON de evaluación, se renombran los índices y se vuelven a crear las 56 FKs
// con las mismas reglas que en 0009.
// Cada paso consulta el estado antes de actuar, así que si se corta se puede
// volver a correr.

export const description = 'Nombres en inglés: tablas, columnas, índices y claves foráneas';

// tabla actual: [tabla nueva, { columna actual: columna nueva }]
export const TABLES = {
  actividades: ['activities', { tipo_contacto: 'contact_type', fecha_hora: 'occurred_at', descripcion: 'description', resultado: 'result', monto_venta: 'sale_amount', sin_seguimiento: 'no_follow_up', oportunidad_id: 'opportunity_id', orden_servicio_id: 'service_order_id', parada_id: 'roadmap_stop_id', usuario_id: 'user_id', fecha_registro: 'created_at' }],
  adjuntos: ['attachments', { actividad_id: 'activity_id', orden_servicio_id: 'service_order_id', tipo: 'type', nombre_archivo: 'file_name', tamanio_kb: 'size_kb', contenido: 'content', fecha_carga: 'uploaded_at' }],
  contactos: ['contacts', { dni: 'national_id', nombre_apellido: 'full_name', cargo: 'job_title', es_principal: 'is_primary', observaciones: 'notes', empresa_id: 'company_id', fecha_alta: 'created_at', fecha_baja: 'deleted_at' }],
  contacto_telefonos: ['contact_phones', { contacto_id: 'contact_id', numero: 'number' }],
  cultivos: ['crops', { nombre: 'name', meses_necesidad: 'demand_months' }],
  empleados: ['employees', { nombre_apellido: 'full_name', dni: 'national_id', matricula: 'license_number', rol: 'role', puesto: 'job_title', telefono: 'phone', empresa: 'company', fecha_ingreso: 'hire_date', activo: 'active', observaciones: 'notes', fecha_creacion: 'created_at' }],
  empresas: ['companies', { razon_social: 'legal_name', nombre_fantasia: 'trade_name', descripcion: 'description', direccion: 'address', tipo_empresa: 'company_type', superficie_ha: 'area_ha', proveedor_actual: 'current_supplier', nivel: 'level', empresa_padre_id: 'parent_company_id', localidad_id: 'locality_id', latitud: 'latitude', longitud: 'longitude', creado_por_id: 'created_by_id', fecha_registro: 'created_at', fecha_baja: 'deleted_at' }],
  empresa_cultivos: ['company_crops', { empresa_id: 'company_id', cultivo_id: 'crop_id' }],
  evaluaciones_servicio: ['service_evaluations', { orden_servicio_id: 'service_order_id', fecha_evaluacion: 'evaluation_date', estado_cereal: 'grain_condition', lugar_toma: 'sampling_point', resultado: 'result', observaciones: 'notes', recomendaciones: 'recommendations', detalle: 'details', fotos: 'photos', firma_cliente: 'customer_signature', firma_tecnico: 'technician_signature', satisfaccion_cliente: 'customer_satisfaction', comentario_cliente: 'customer_comment' }],
  hojas_ruta: ['roadmaps', { nombre: 'name', descripcion: 'description', fecha: 'date', hora_inicio_plan: 'planned_start_time', fecha_fin_plan: 'planned_end_date', hora_fin_plan: 'planned_end_time', estado: 'status', usuario_id: 'user_id', creado_por_id: 'created_by_id', distancia_estimada_km: 'estimated_distance_km', observaciones: 'notes', inicio_real: 'actual_start_at', fin_real: 'actual_end_at', fecha_creacion: 'created_at' }],
  items_catalogo: ['catalog_items', { tipo: 'type', nombre: 'name', codigo: 'code', descripcion: 'description', precio_referencia: 'reference_price', costo_unitario: 'unit_cost', frecuencia_facturacion: 'billing_frequency', stock_disponible: 'stock_available', activo: 'active', imagen: 'image', linea_id: 'product_line_id', principio_activo: 'active_ingredient', presentacion: 'presentation', tipo_servicio: 'service_type', unidad_medida: 'unit_of_measure', fecha_alta: 'created_at' }],
  lineas_producto: ['product_lines', { codigo: 'code', nombre: 'name', categoria: 'category' }],
  localidades: ['localities', { nombre: 'name', codigo_postal: 'postal_code', latitud: 'latitude', longitud: 'longitude', provincia_id: 'province_id' }],
  notas_internas: ['internal_notes', { categoria: 'category', descripcion: 'description', estado: 'status', fecha_nota: 'created_at', usuario_id: 'user_id' }],
  notificaciones: ['notifications', { usuario_id: 'user_id', tipo: 'type', mensaje: 'message', entidad: 'entity', entidad_id: 'entity_id', leida: 'is_read', fecha_hora: 'occurred_at' }],
  objetivos: ['objectives', { descripcion: 'description', tipo_objetivo: 'objective_type', tipo_periodo: 'period_type', fecha_inicio: 'start_date', fecha_fin: 'end_date', cantidad_meta: 'target_amount', usuario_id: 'user_id', creado_por_id: 'created_by_id', fecha_creacion: 'created_at' }],
  objetivo_empresas: ['objective_companies', { objetivo_id: 'objective_id', empresa_id: 'company_id' }],
  objetivo_items: ['objective_items', { objetivo_id: 'objective_id' }],
  objetivo_promociones: ['objective_promotions', { objetivo_id: 'objective_id', promocion_id: 'promotion_id' }],
  oportunidades: ['opportunities', { titulo: 'title', estado: 'status', potencialidad: 'potential', volumen_potencial: 'potential_volume', volumen_facturado: 'billed_volume', fecha_inicio: 'start_date', fecha_cierre_estimada: 'expected_close_date', fecha_ultima_actualizacion: 'last_activity_at', motivo_perdida: 'loss_reason', empresa_id: 'company_id', usuario_id: 'user_id', contacto_id: 'contact_id', creado_por_id: 'created_by_id', fecha_baja: 'deleted_at' }],
  oportunidad_items: ['opportunity_items', { oportunidad_id: 'opportunity_id', cantidad: 'quantity' }],
  orden_empleados: ['service_order_employees', { orden_servicio_id: 'service_order_id', empleado_id: 'employee_id' }],
  ordenes_servicio: ['service_orders', { numero_orden: 'order_number', empresa_id: 'company_id', servicio_id: 'service_id', oportunidad_id: 'opportunity_id', fecha_programada: 'scheduled_date', fecha_realizada: 'completed_date', estado: 'status', cliente_id: 'customer_code', cliente_nombre: 'customer_name', centro_id: 'center_code', centro_nombre: 'center_name', planta_id: 'plant_code', planta_nombre: 'plant_name', direccion: 'address', localidad: 'locality', provincia: 'province', tipo_trabajo: 'work_type', observaciones: 'notes', recomendaciones: 'recommendations', firma_tecnico: 'technician_signature', firma_cliente: 'customer_signature', imagen_orden_original: 'original_order_image', creado_por_id: 'created_by_id', fecha_creacion: 'created_at', fecha_baja: 'deleted_at' }],
  paradas_ruta: ['roadmap_stops', { hoja_ruta_id: 'roadmap_id', orden: 'sort_order', empresa_id: 'company_id', nombre_lugar: 'place_name', direccion: 'address', latitud: 'latitude', longitud: 'longitude', estado: 'status', hora_estimada: 'estimated_time', notas: 'notes', origen: 'source' }],
  productos_aplicados: ['applied_products', { orden_servicio_id: 'service_order_id', tipo_instalacion: 'facility_type', numero: 'number', capacidad_tn: 'capacity_tn', grano: 'grain', cantidad_tn: 'quantity_tn', estado_cereal: 'grain_condition', estado_instalaciones: 'facility_condition', estado_infestacion: 'infestation_level', producto: 'product', principio_activo: 'active_ingredient', dosis: 'dose', lote: 'batch', tiempo_carencia: 'withdrawal_period', cantidad_total: 'total_quantity' }],
  promociones: ['promotions', { nombre: 'name', descripcion: 'description', beneficio: 'benefit', condiciones: 'conditions', fecha_inicio: 'start_date', fecha_fin: 'end_date', creado_por_id: 'created_by_id' }],
  promocion_items: ['promotion_items', { promocion_id: 'promotion_id' }],
  provincias: ['provinces', { nombre: 'name' }],
  tareas: ['tasks', { titulo: 'title', descripcion: 'description', tipo: 'type', prioridad: 'priority', fecha_creacion: 'created_at', fecha_vencimiento: 'due_date', hora_vencimiento: 'due_time', notas: 'notes', estado: 'status', empresa_id: 'company_id', contacto_id: 'contact_id', actividad_id: 'activity_id', creado_por_id: 'created_by_id', finalizado_por_id: 'completed_by_id', fecha_finalizacion: 'completed_at' }],
  tarea_asignados: ['task_assignees', { tarea_id: 'task_id', usuario_id: 'user_id', recordatorio_48h_enviado: 'reminder_48h_sent', recordatorio_24h_enviado: 'reminder_24h_sent' }],
  usuarios: ['users', { nombre_apellido: 'full_name', telefono: 'phone', rol: 'role', estado_cuenta: 'account_status', fecha_ingreso: 'hire_date', fecha_alta: 'created_at', ultimo_acceso: 'last_login_at' }],
  usuario_localidades: ['user_localities', { usuario_id: 'user_id', localidad_id: 'locality_id' }],
};

// Índices creados por las migraciones anteriores (los demás se traducen solos).
const INDEXES = {
  ix_localidades_codigo_postal: 'ix_localities_postal_code',
  ix_localidades_nombre: 'ix_localities_name',
  ix_empresas_razon_social: 'ix_companies_legal_name',
  ix_empresas_cuit: 'ix_companies_cuit',
  ix_contactos_dni: 'ix_contacts_national_id',
  ix_oportunidades_estado: 'ix_opportunities_status',
  ux_actividades_client_uuid: 'ux_activities_client_uuid',
  ix_actividades_fecha: 'ix_activities_occurred_at',
  ix_tareas_estado_venc: 'ix_tasks_status_due_date',
  ix_tareas_contacto: 'ix_tasks_contact',
  ux_tarea_asignados: 'ux_task_assignees',
  ix_objetivos_usuario_periodo: 'ix_objectives_user_period',
  ix_empleados_dni: 'ix_employees_national_id',
  ux_ordenes_numero: 'ux_service_orders_order_number',
  ix_ordenes_empresa_fecha: 'ix_service_orders_company_date',
  ux_evaluaciones_orden: 'ux_service_evaluations_order',
};

// Las filas de la planilla de evaluación se guardan como JSON en
// service_evaluations.details, con los nombres de campo de la pantalla.
const EVALUATION_ROW_KEYS = {
  tipoInstalacion: 'facilityType', numero: 'number', capacidadTn: 'capacityTn', grano: 'grain', cantidadTn: 'quantityTn',
  estadoCereal: 'grainCondition', lugarToma: 'samplingPoint', resultado: 'result', estadoInstalaciones: 'facilityCondition',
  estadoInfestacion: 'infestationLevel', producto: 'product', principioActivo: 'activeIngredient', dosis: 'dose', lote: 'batch',
  tiempoCarencia: 'withdrawalPeriod', cantidadTotal: 'totalQuantity',
};

// Las mismas reglas de 0009, con los nombres nuevos.
export const FOREIGN_KEYS = [
  ['localities', 'province_id', 'provinces', 'id', 'SET NULL'],
  ['user_localities', 'user_id', 'users', 'id_user', 'CASCADE'],
  ['user_localities', 'locality_id', 'localities', 'id', 'CASCADE'],
  ['companies', 'locality_id', 'localities', 'id', 'RESTRICT'],
  ['companies', 'parent_company_id', 'companies', 'id', 'SET NULL'],
  ['companies', 'created_by_id', 'users', 'id_user', 'SET NULL'],
  ['company_crops', 'company_id', 'companies', 'id', 'CASCADE'],
  ['company_crops', 'crop_id', 'crops', 'id', 'CASCADE'],
  ['contacts', 'company_id', 'companies', 'id', 'RESTRICT'],
  ['contact_phones', 'contact_id', 'contacts', 'id', 'CASCADE'],
  ['opportunities', 'company_id', 'companies', 'id', 'RESTRICT'],
  ['opportunities', 'user_id', 'users', 'id_user', 'RESTRICT'],
  ['opportunities', 'contact_id', 'contacts', 'id', 'SET NULL'],
  ['opportunities', 'created_by_id', 'users', 'id_user', 'SET NULL'],
  ['opportunity_items', 'opportunity_id', 'opportunities', 'id', 'CASCADE'],
  ['opportunity_items', 'item_id', 'catalog_items', 'id', 'RESTRICT'],
  ['activities', 'opportunity_id', 'opportunities', 'id', 'RESTRICT'],
  ['activities', 'service_order_id', 'service_orders', 'id', 'RESTRICT'],
  ['activities', 'roadmap_stop_id', 'roadmap_stops', 'id', 'SET NULL'],
  ['activities', 'user_id', 'users', 'id_user', 'RESTRICT'],
  ['attachments', 'activity_id', 'activities', 'id', 'CASCADE'],
  ['attachments', 'service_order_id', 'service_orders', 'id', 'CASCADE'],
  ['tasks', 'activity_id', 'activities', 'id', 'SET NULL'],
  ['tasks', 'company_id', 'companies', 'id', 'SET NULL'],
  ['tasks', 'contact_id', 'contacts', 'id', 'SET NULL'],
  ['tasks', 'created_by_id', 'users', 'id_user', 'SET NULL'],
  ['tasks', 'completed_by_id', 'users', 'id_user', 'SET NULL'],
  ['task_assignees', 'task_id', 'tasks', 'id', 'CASCADE'],
  ['task_assignees', 'user_id', 'users', 'id_user', 'CASCADE'],
  ['roadmaps', 'user_id', 'users', 'id_user', 'RESTRICT'],
  ['roadmaps', 'created_by_id', 'users', 'id_user', 'SET NULL'],
  ['roadmap_stops', 'roadmap_id', 'roadmaps', 'id', 'CASCADE'],
  ['roadmap_stops', 'company_id', 'companies', 'id', 'SET NULL'],
  ['objectives', 'user_id', 'users', 'id_user', 'RESTRICT'],
  ['objectives', 'created_by_id', 'users', 'id_user', 'SET NULL'],
  ['objective_companies', 'objective_id', 'objectives', 'id', 'CASCADE'],
  ['objective_companies', 'company_id', 'companies', 'id', 'CASCADE'],
  ['objective_items', 'objective_id', 'objectives', 'id', 'CASCADE'],
  ['objective_items', 'item_id', 'catalog_items', 'id', 'CASCADE'],
  ['objective_promotions', 'objective_id', 'objectives', 'id', 'CASCADE'],
  ['objective_promotions', 'promotion_id', 'promotions', 'id', 'CASCADE'],
  ['promotions', 'created_by_id', 'users', 'id_user', 'SET NULL'],
  ['promotion_items', 'promotion_id', 'promotions', 'id', 'CASCADE'],
  ['promotion_items', 'item_id', 'catalog_items', 'id', 'CASCADE'],
  ['catalog_items', 'product_line_id', 'product_lines', 'id', 'SET NULL'],
  ['internal_notes', 'user_id', 'users', 'id_user', 'RESTRICT'],
  ['notifications', 'user_id', 'users', 'id_user', 'CASCADE'],
  ['service_orders', 'company_id', 'companies', 'id', 'RESTRICT'],
  ['service_orders', 'service_id', 'catalog_items', 'id', 'RESTRICT'],
  ['service_orders', 'opportunity_id', 'opportunities', 'id', 'SET NULL'],
  ['service_orders', 'created_by_id', 'users', 'id_user', 'SET NULL'],
  ['service_order_employees', 'service_order_id', 'service_orders', 'id', 'CASCADE'],
  ['service_order_employees', 'employee_id', 'employees', 'id', 'RESTRICT'],
  ['applied_products', 'service_order_id', 'service_orders', 'id', 'CASCADE'],
  ['applied_products', 'item_id', 'catalog_items', 'id', 'SET NULL'],
  ['service_evaluations', 'service_order_id', 'service_orders', 'id', 'CASCADE'],
];

// Palabras sueltas que aparecen en nombres de índices viejos (ix_adjuntos_orden, fk_x_usuario...).
const INDEX_WORDS = {
  usuario: 'user', usuarios: 'users', actividad: 'activity', actividades: 'activities', orden: 'order', ordenes: 'orders',
  linea: 'line', lineas: 'lines', tipo: 'type', cultivo: 'crop', cultivos: 'crops', empresa: 'company', empresas: 'companies',
  contacto: 'contact', contactos: 'contacts', fecha: 'date', estado: 'status', venc: 'due', numero: 'number', periodo: 'period',
  servicio: 'service', evaluaciones: 'evaluations', notificaciones: 'notifications', paradas: 'stops', parada: 'stop',
  hoja: 'roadmap', hojas: 'roadmaps', ruta: 'route', tarea: 'task', tareas: 'tasks', oportunidad: 'opportunity',
  oportunidades: 'opportunities', nombre: 'name', codigo: 'code', dni: 'national_id', asignados: 'assignees',
  promocion: 'promotion', promociones: 'promotions', objetivo: 'objective', objetivos: 'objectives', localidad: 'locality',
  localidades: 'localities', provincia: 'province', provincias: 'provinces', creado: 'created', por: 'by', cliente: 'customer',
  clientes: 'customers', telefonos: 'phones', adjuntos: 'attachments', empleados: 'employees', empleado: 'employee',
  formulario: 'form', negocios: 'deals', propietario: 'owner', asignado: 'assigned', finalizado: 'completed',
};

// Traduce un nombre de índice viejo palabra por palabra (separadas por "_"):
// primero los nombres de tablas, después las columnas de esa misma tabla y
// por último las palabras sueltas. Nunca cambia parte de una palabra.
const translateIndexName = (name, oldTable) => {
  const pairs = Object.entries(TABLES).map(([o, [n]]) => [o, n]);
  pairs.push(...Object.entries(TABLES[oldTable]?.[1] || {}));
  pairs.push(...Object.entries(INDEX_WORDS));
  pairs.sort((x, y) => y[0].split('_').length - x[0].split('_').length || y[0].length - x[0].length);
  const tokens = name.split('_');
  const out = [];
  for (let i = 0; i < tokens.length;) {
    const hit = pairs.find(([o]) => tokens.slice(i, i + o.split('_').length).join('_') === o);
    if (hit) { out.push(hit[1]); i += hit[0].split('_').length; } else { out.push(tokens[i]); i += 1; }
  }
  return out.join('_').slice(0, 64);
};

const renameIndex = async (h, table, from, to) => {
  if (from === to) return false;
  const names = (await h.indexes(table)).map((ix) => ix.name);
  if (!names.includes(from) || names.includes(to)) return false;
  await h.q(`ALTER TABLE ${h.id(table)} RENAME INDEX ${h.id(from)} TO ${h.id(to)}`);
  return true;
};

export const up = async ({ h, log }) => {
  // 1. Sin FKs mientras cambian los nombres.
  await h.dropAllForeignKeys();

  // 2. Columnas (en la tabla con su nombre actual, viejo o nuevo si se reintenta).
  let columns = 0;
  for (const [oldTable, [newTable, cols]] of Object.entries(TABLES)) {
    const table = (await h.hasTable(oldTable)) ? oldTable : newTable;
    if (!(await h.hasTable(table))) throw new Error(`No existe la tabla ${oldTable} (ni ${newTable}).`);
    for (const [from, to] of Object.entries(cols)) {
      if ((await h.hasColumn(table, from)) && !(await h.hasColumn(table, to))) {
        // RENAME COLUMN conserva el tipo, el valor por defecto y la collation tal cual.
        await h.q(`ALTER TABLE ${h.id(table)} RENAME COLUMN ${h.id(from)} TO ${h.id(to)}`);
        columns++;
      }
    }
  }
  log(`${columns} columnas renombradas.`);

  // 3. Tablas.
  let tables = 0;
  for (const [oldTable, [newTable]] of Object.entries(TABLES)) {
    if ((await h.hasTable(oldTable)) && !(await h.hasTable(newTable))) {
      await h.renameTable(oldTable, newTable);
      tables++;
    }
  }
  log(`${tables} tablas renombradas.`);

  // 4. Claves del JSON de la planilla de evaluación (los valores no cambian).
  let rows = 0;
  for (const r of await h.rows('SELECT id, details FROM service_evaluations WHERE details IS NOT NULL AND details <> \'\'')) {
    let parsed;
    try { parsed = JSON.parse(r.details); } catch { continue; } // texto libre: queda igual
    if (!Array.isArray(parsed)) continue;
    let changed = false;
    const translated = parsed.map((row) => {
      if (!row || typeof row !== 'object') return row;
      return Object.fromEntries(Object.entries(row).map(([k, v]) => {
        if (EVALUATION_ROW_KEYS[k]) { changed = true; return [EVALUATION_ROW_KEYS[k], v]; }
        return [k, v];
      }));
    });
    if (changed) {
      await h.q('UPDATE service_evaluations SET details = ? WHERE id = ?', [JSON.stringify(translated), r.id]);
      rows++;
    }
  }
  log(`${rows} planillas de evaluación con las columnas del detalle en inglés.`);

  // 5. Índices.
  let indexes = 0;
  for (const [oldTable, [table]] of Object.entries(TABLES)) {
    for (const ix of await h.indexes(table)) {
      if (ix.name === 'PRIMARY') continue;
      const to = INDEXES[ix.name] || translateIndexName(ix.name, oldTable);
      if (await renameIndex(h, table, ix.name, to)) indexes++;
    }
  }
  log(`${indexes} índices renombrados.`);

  // 6. FKs con los nombres nuevos.
  for (const [table, column, refTable, refColumn, onDelete] of FOREIGN_KEYS) {
    if (!(await h.hasColumn(table, column))) throw new Error(`Falta ${table}.${column}: la base no quedó en la forma esperada.`);
    await h.addForeignKey(table, column, refTable, refColumn, { onDelete });
  }
  log(`${FOREIGN_KEYS.length} FKs creadas con los nombres nuevos.`);

  // 7. Contador AUTO_INCREMENT: algunos motores lo pierden al renombrar o alterar la
  //    tabla. Se fija en el mayor entre el actual y el id más alto + 1, así nunca se
  //    reutiliza un id (en MariaDB normalmente no cambia nada).
  let counters = 0;
  for (const [, [table]] of Object.entries(TABLES)) {
    const col = await h.one(
      "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND EXTRA LIKE '%auto_increment%'",
      [h.db, table],
    );
    if (!col) continue;
    const max = Number((await h.one(`SELECT MAX(${h.id(col.c)}) AS m FROM ${h.id(table)}`))?.m || 0);
    const cur = Number((await h.one('SELECT AUTO_INCREMENT AS a FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [h.db, table]))?.a || 0);
    await h.q(`ALTER TABLE ${h.id(table)} AUTO_INCREMENT = ${Math.max(cur, max + 1)}`);
    counters++;
  }
  log(`${counters} contadores AUTO_INCREMENT verificados.`);
};

// No hay vuelta atrás automática: se restaura el respaldo (ver docs/MIGRATION_V2.md).
