// Integridad referencial v2: limpia huérfanos, crea todas las FKs con reglas
// explícitas y elimina las tablas v1 que quedaron sin uso (respaldadas en 0002).
//
// Reglas:
//  - RESTRICT para entidades con historial (no se borra una empresa con oportunidades;
//    las entidades principales usan baja lógica con fecha_baja).
//  - CASCADE solo en detalle que no tiene sentido sin su padre (paradas, teléfonos,
//    adjuntos, tablas puente).
//  - SET NULL en referencias opcionales (creado_por, contacto, parada, etc.).

export const descripcion = 'FKs v2 con reglas de integridad y baja de tablas v1 obsoletas';

export const FOREIGN_KEYS = [
  ['localidades', 'provincia_id', 'provincias', 'id', 'SET NULL'],
  ['usuario_localidades', 'usuario_id', 'usuarios', 'id_user', 'CASCADE'],
  ['usuario_localidades', 'localidad_id', 'localidades', 'id', 'CASCADE'],
  ['empresas', 'localidad_id', 'localidades', 'id', 'RESTRICT'],
  ['empresas', 'empresa_padre_id', 'empresas', 'id', 'SET NULL'],
  ['empresas', 'creado_por_id', 'usuarios', 'id_user', 'SET NULL'],
  ['empresa_cultivos', 'empresa_id', 'empresas', 'id', 'CASCADE'],
  ['empresa_cultivos', 'cultivo_id', 'cultivos', 'id', 'CASCADE'],
  ['contactos', 'empresa_id', 'empresas', 'id', 'RESTRICT'],
  ['contacto_telefonos', 'contacto_id', 'contactos', 'id', 'CASCADE'],
  ['oportunidades', 'empresa_id', 'empresas', 'id', 'RESTRICT'],
  ['oportunidades', 'usuario_id', 'usuarios', 'id_user', 'RESTRICT'],
  ['oportunidades', 'contacto_id', 'contactos', 'id', 'SET NULL'],
  ['oportunidad_items', 'oportunidad_id', 'oportunidades', 'id', 'CASCADE'],
  ['oportunidad_items', 'item_id', 'items_catalogo', 'id', 'RESTRICT'],
  ['actividades', 'oportunidad_id', 'oportunidades', 'id', 'RESTRICT'],
  ['actividades', 'orden_servicio_id', 'ordenes_servicio', 'id', 'RESTRICT'],
  ['actividades', 'parada_id', 'paradas_ruta', 'id', 'SET NULL'],
  ['actividades', 'usuario_id', 'usuarios', 'id_user', 'RESTRICT'],
  ['adjuntos', 'actividad_id', 'actividades', 'id', 'CASCADE'],
  ['adjuntos', 'orden_servicio_id', 'ordenes_servicio', 'id', 'CASCADE'],
  ['tareas', 'actividad_id', 'actividades', 'id', 'SET NULL'], // la tarea sobrevive a su actividad de origen
  ['tareas', 'empresa_id', 'empresas', 'id', 'SET NULL'],
  ['tareas', 'creado_por_id', 'usuarios', 'id_user', 'SET NULL'],
  ['tareas', 'finalizado_por_id', 'usuarios', 'id_user', 'SET NULL'],
  ['tarea_asignados', 'tarea_id', 'tareas', 'id', 'CASCADE'],
  ['tarea_asignados', 'usuario_id', 'usuarios', 'id_user', 'CASCADE'],
  ['hojas_ruta', 'usuario_id', 'usuarios', 'id_user', 'RESTRICT'],
  ['hojas_ruta', 'creado_por_id', 'usuarios', 'id_user', 'SET NULL'],
  ['paradas_ruta', 'hoja_ruta_id', 'hojas_ruta', 'id', 'CASCADE'],
  ['paradas_ruta', 'empresa_id', 'empresas', 'id', 'SET NULL'],
  ['objetivos', 'usuario_id', 'usuarios', 'id_user', 'RESTRICT'],
  ['objetivos', 'creado_por_id', 'usuarios', 'id_user', 'SET NULL'],
  ['objetivo_empresas', 'objetivo_id', 'objetivos', 'id', 'CASCADE'],
  ['objetivo_empresas', 'empresa_id', 'empresas', 'id', 'CASCADE'],
  ['objetivo_items', 'objetivo_id', 'objetivos', 'id', 'CASCADE'],
  ['objetivo_items', 'item_id', 'items_catalogo', 'id', 'CASCADE'],
  ['objetivo_promociones', 'objetivo_id', 'objetivos', 'id', 'CASCADE'],
  ['objetivo_promociones', 'promocion_id', 'promociones', 'id', 'CASCADE'],
  ['promociones', 'creado_por_id', 'usuarios', 'id_user', 'SET NULL'],
  ['promocion_items', 'promocion_id', 'promociones', 'id', 'CASCADE'],
  ['promocion_items', 'item_id', 'items_catalogo', 'id', 'CASCADE'],
  ['items_catalogo', 'linea_id', 'lineas_producto', 'id', 'SET NULL'],
  ['notas_internas', 'usuario_id', 'usuarios', 'id_user', 'RESTRICT'],
  ['notificaciones', 'usuario_id', 'usuarios', 'id_user', 'CASCADE'],
  ['ordenes_servicio', 'empresa_id', 'empresas', 'id', 'RESTRICT'],
  ['ordenes_servicio', 'servicio_id', 'items_catalogo', 'id', 'RESTRICT'],
  ['ordenes_servicio', 'oportunidad_id', 'oportunidades', 'id', 'SET NULL'],
  ['ordenes_servicio', 'creado_por_id', 'usuarios', 'id_user', 'SET NULL'],
  ['orden_empleados', 'orden_servicio_id', 'ordenes_servicio', 'id', 'CASCADE'],
  ['orden_empleados', 'empleado_id', 'empleados', 'id', 'RESTRICT'],
  ['productos_aplicados', 'orden_servicio_id', 'ordenes_servicio', 'id', 'CASCADE'],
  ['productos_aplicados', 'item_id', 'items_catalogo', 'id', 'SET NULL'],
  ['evaluaciones_servicio', 'orden_servicio_id', 'ordenes_servicio', 'id', 'CASCADE'],
];

// Tablas v1 sin lugar en el modelo v2 (sus datos ya se copiaron y están en _bak_v1_*).
export const OBSOLETE_TABLES = [
  'formularios_actividad', 'archivos_adjuntos', 'services', 'telefonos', 'telefonos_proveedor',
  'vendedores', 'empresa_linea_producto', 'promocion_linea_producto', 'tipos_producto', 'productos',
];

export const up = async ({ h, log }) => {
  let limpiados = 0;
  for (const [table, column, refTable, refColumn] of FOREIGN_KEYS) {
    if (!(await h.hasTable(table)) || !(await h.hasColumn(table, column))) {
      throw new Error(`Falta ${table}.${column}: la base no quedó en la forma esperada antes de crear las FKs.`);
    }
    const col = await h.getColumn(table, column);
    const where = `t.${h.id(column)} IS NOT NULL AND r.${h.id(refColumn)} IS NULL`;
    const join = `FROM ${h.id(table)} t LEFT JOIN ${h.id(refTable)} r ON r.${h.id(refColumn)} = t.${h.id(column)}`;
    const n = Number((await h.one(`SELECT COUNT(*) AS n ${join} WHERE ${where}`)).n);
    if (n) {
      if (col.IS_NULLABLE === 'YES') await h.q(`UPDATE ${h.id(table)} t LEFT JOIN ${h.id(refTable)} r ON r.${h.id(refColumn)} = t.${h.id(column)} SET t.${h.id(column)} = NULL WHERE ${where}`);
      else await h.q(`DELETE t ${join} WHERE ${where}`);
      log(`${table}.${column}: ${n} referencias huérfanas ${col.IS_NULLABLE === 'YES' ? 'puestas en NULL' : 'eliminadas'}.`);
      limpiados += n;
    }
  }
  for (const [table, column, refTable, refColumn, onDelete] of FOREIGN_KEYS) {
    await h.addForeignKey(table, column, refTable, refColumn, { onDelete });
  }
  log(`${FOREIGN_KEYS.length} FKs creadas (${limpiados} referencias huérfanas corregidas).`);

  for (const t of OBSOLETE_TABLES) {
    if (await h.hasTable(t)) {
      if (!(await h.hasTable(`_bak_v1_${t}`))) await h.backupTable(t);
      await h.dropTable(t);
      log(`Tabla obsoleta eliminada: ${t} (copia en _bak_v1_${t}).`);
    }
  }
};
