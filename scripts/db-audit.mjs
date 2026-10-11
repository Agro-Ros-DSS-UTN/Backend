#!/usr/bin/env node
// Auditoría de la base (SOLO LECTURA). Se puede correr contra producción antes
// de migrar: no escribe nada (sesión en modo READ ONLY) y no muestra datos
// personales, solo nombres de tablas, cantidades y valores de catálogo.
//   node scripts/db-audit.mjs            → imprime el informe y lo guarda en auditoria-db-AAAA-MM-DD.txt
import fs from 'node:fs';
import sequelize from '../src/config/database.js';
import { FOREIGN_KEYS, OBSOLETE_TABLES } from '../src/db/migrations/0009_integridad.js';
import { listMigrationFiles } from '../src/db/migrator.js';

const db = sequelize.config.database;
const out = [];
const log = (s = '') => { out.push(s); console.log(s); };
// Una sola conexión, en una transacción READ ONLY: cualquier escritura fallaría.
let conn;
const rows = (sql, rep = []) => new Promise((resolve, reject) => {
  conn.query({ sql, values: rep }, (err, r) => (err ? reject(err) : resolve(r)));
});
const one = async (sql, rep) => (await rows(sql, rep))[0];

// Relaciones de la v1 (en producción muchas no tienen FK real).
const V1_REL = [
  ['empresas_clientes', 'locality_cod_postal', 'localidades', 'cod_postal'],
  ['empresas_clientes', 'parent_company_id', 'empresas_clientes', 'id'],
  ['clientes', 'client_company_id', 'empresas_clientes', 'id'],
  ['clientes', 'locality_cod_postal', 'localidades', 'cod_postal'],
  ['telefonos_cliente', 'client_num_doc', 'clientes', 'num_doc'],
  ['negocios', 'client_company_id', 'empresas_clientes', 'id'],
  ['negocios', 'propietario_id', 'usuarios', 'id_user'],
  ['actividades', 'opportunity_id', 'negocios', 'id'],
  ['actividades', 'id_user', 'usuarios', 'id_user'],
  ['tareas', 'formulario_actividad_id', 'actividades', 'id_formulario'],
  ['tareas', 'finalizado_por_id', 'usuarios', 'id_user'],
  ['tareas_asignados', 'task_id', 'tareas', 'id'],
  ['tareas_asignados', 'id_user', 'usuarios', 'id_user'],
  ['hojas_ruta', 'id_user_asignado', 'usuarios', 'id_user'],
  ['hoja_ruta_paradas', 'roadmap_id', 'hojas_ruta', 'id'],
  ['hoja_ruta_paradas', 'client_company_id', 'empresas_clientes', 'id'],
  ['objetivos', 'id_user', 'usuarios', 'id_user'],
  ['objetivos', 'client_company_id', 'empresas_clientes', 'id'],
  ['orden_servicio_productos', 'orden_servicio_id', 'ordenes_servicio', 'id'],
  ['evaluaciones_servicio', 'orden_servicio_id', 'ordenes_servicio', 'id'],
  ['localidades', 'provincia_id', 'provincias', 'id'],
];

const tablas = async () => (await rows('SELECT TABLE_NAME t, TABLE_ROWS r FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY 1', [db])).map((x) => x.t);
const columnas = async (t) => (await rows('SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [db, t])).map((x) => x.c);
const q = (n) => `\`${String(n).replace(/`/g, '')}\``;

try {
  conn = await sequelize.connectionManager.getConnection();
  await rows('SET SESSION TRANSACTION READ ONLY');
  await rows('START TRANSACTION READ ONLY');

  log(`# Auditoría de la base "${db}" — ${new Date().toISOString()}`);
  const version = await one('SELECT VERSION() v');
  log(`Motor: ${version.v}`);
  const charset = await one('SELECT DEFAULT_CHARACTER_SET_NAME cs, DEFAULT_COLLATION_NAME co FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [db]);
  log(`Juego de caracteres: ${charset?.cs} / ${charset?.co}`);

  const ts = await tablas();
  const esV2 = ts.includes('migraciones');
  log(`\n## Tablas (${ts.length})${esV2 ? ' — ya tiene tabla de migraciones' : ' — esquema v1 (sin migraciones)'}`);
  for (const t of ts) {
    const n = Number((await one(`SELECT COUNT(*) n FROM ${q(t)}`)).n);
    log(`- ${t}: ${n} filas${OBSOLETE_TABLES.includes(t) ? '  [obsoleta en v2]' : ''}`);
  }

  if (esV2) {
    const hechas = (await rows('SELECT nombre FROM migraciones ORDER BY nombre')).map((r) => r.nombre);
    const pendientes = listMigrationFiles().filter((f) => !hechas.includes(f));
    log(`\n## Migraciones: ${hechas.length} aplicadas, ${pendientes.length} pendientes ${pendientes.join(', ')}`);
  }

  log('\n## Columnas por tabla');
  for (const t of ts) log(`- ${t}: ${(await columnas(t)).join(', ')}`);

  log('\n## Claves foráneas existentes');
  const fks = await rows(`SELECT TABLE_NAME t, COLUMN_NAME c, REFERENCED_TABLE_NAME rt, REFERENCED_COLUMN_NAME rc, CONSTRAINT_NAME n
                            FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY 1, 2`, [db]);
  log(fks.length ? fks.map((f) => `- ${f.t}.${f.c} → ${f.rt}.${f.rc} (${f.n})`).join('\n') : '- (ninguna)');

  log('\n## Referencias huérfanas');
  const rels = esV2 ? FOREIGN_KEYS.map(([t, c, rt, rc]) => [t, c, rt, rc]) : V1_REL;
  let huerfanas = 0;
  for (const [t, c, rt, rc] of rels) {
    if (!ts.includes(t) || !ts.includes(rt)) continue;
    if (!(await columnas(t)).includes(c) || !(await columnas(rt)).includes(rc)) continue;
    const n = Number((await one(`SELECT COUNT(*) n FROM ${q(t)} a LEFT JOIN ${q(rt)} b ON b.${q(rc)} = a.${q(c)} WHERE a.${q(c)} IS NOT NULL AND b.${q(rc)} IS NULL`)).n);
    if (n) { huerfanas += n; log(`- ${t}.${c} → ${rt}.${rc}: ${n} sin referencia`); }
  }
  if (!huerfanas) log('- ninguna');

  log('\n## Valores de catálogo usados (para mapear en la migración)');
  const valores = esV2
    ? [['usuarios', 'rol'], ['usuarios', 'estado_cuenta'], ['oportunidades', 'estado'], ['actividades', 'tipo_contacto'], ['tareas', 'estado'], ['tareas', 'tipo'], ['empresas', 'tipo_empresa'], ['empresas', 'nivel'], ['ordenes_servicio', 'estado'], ['ordenes_servicio', 'tipo_trabajo'], ['empleados', 'rol'], ['objetivos', 'tipo_objetivo']]
    : [['usuarios', 'role'], ['usuarios', 'account_statement'], ['negocios', 'estado'], ['negocios', 'etapa_comercial'], ['actividades', 'tipo_contacto'], ['tareas', 'estado'], ['tareas', 'tipo'], ['empresas_clientes', 'tipo_empresa'], ['empresas_clientes', 'nivel_empresa'], ['ordenes_servicio', 'estado'], ['ordenes_servicio', 'tipo_trabajo'], ['empleados', 'puesto'], ['objetivos', 'tipo_objetivo'], ['productos', 'tipo_producto']];
  for (const [t, c] of valores) {
    if (!ts.includes(t) || !(await columnas(t)).includes(c)) continue;
    const vs = await rows(`SELECT ${q(c)} v, COUNT(*) n FROM ${q(t)} GROUP BY ${q(c)} ORDER BY n DESC`);
    log(`- ${t}.${c}: ${vs.map((x) => `${x.v ?? '(vacío)'}=${x.n}`).join(', ')}`);
  }

  log('\n## Controles de calidad');
  const control = async (titulo, tabla, sql) => {
    if (!ts.includes(tabla)) return;
    try { log(`- ${titulo}: ${Number((await one(sql)).n)}`); } catch (e) { log(`- ${titulo}: (no aplica: ${e.message.split('\n')[0]})`); }
  };
  if (!esV2) {
    await control('Actividades con hora "redonda" (se corrigen +3 h)', 'actividades', 'SELECT COUNT(*) n FROM actividades WHERE fecha_hora IS NOT NULL AND SECOND(fecha_hora) = 0');
    await control('Actividades sin negocio', 'actividades', 'SELECT COUNT(*) n FROM actividades WHERE opportunity_id IS NULL');
    await control('…de esas, con nombre de empresa que coincide', 'actividades', 'SELECT COUNT(*) n FROM actividades a JOIN empresas_clientes e ON LOWER(TRIM(e.nombre_empresa)) = LOWER(TRIM(a.empresa)) WHERE a.opportunity_id IS NULL');
    await control('Actividades con adjunto embebido', 'actividades', "SELECT COUNT(*) n FROM actividades WHERE archivo_adjunto IS NOT NULL AND archivo_adjunto <> ''");
    await control('Tareas con empresa escrita que no coincide con ninguna empresa', 'tareas', 'SELECT COUNT(*) n FROM tareas t LEFT JOIN empresas_clientes e ON LOWER(TRIM(e.nombre_empresa)) = LOWER(TRIM(t.empresa)) WHERE t.empresa IS NOT NULL AND TRIM(t.empresa) <> \'\' AND e.id IS NULL');
    await control('Órdenes cuyo cliente no coincide con una empresa', 'ordenes_servicio', 'SELECT COUNT(*) n FROM ordenes_servicio o LEFT JOIN empresas_clientes e ON LOWER(TRIM(e.nombre_empresa)) = LOWER(TRIM(o.cliente_nombre)) WHERE e.id IS NULL');
    await control('Órdenes cuyo técnico no está en empleados', 'ordenes_servicio', "SELECT COUNT(*) n FROM ordenes_servicio o LEFT JOIN empleados e ON LOWER(TRIM(e.nombre_apellido)) = LOWER(TRIM(o.tecnico_aplicador)) WHERE o.tecnico_aplicador IS NOT NULL AND o.tecnico_aplicador <> '' AND e.id IS NULL");
    await control('CUIT repetidos (empresas)', 'empresas_clientes', 'SELECT COUNT(*) n FROM (SELECT cuit FROM empresas_clientes GROUP BY cuit HAVING COUNT(*) > 1) x');
    await control('Paradas con enlace que no es http(s)', 'hoja_ruta_paradas', "SELECT COUNT(*) n FROM hoja_ruta_paradas WHERE url IS NOT NULL AND url <> '' AND url NOT LIKE 'http://%' AND url NOT LIKE 'https://%'");
    await control('Contraseñas sin bcrypt (texto plano)', 'usuarios', "SELECT COUNT(*) n FROM usuarios WHERE password NOT LIKE '$2%'");
  } else {
    await control('Actividades sin oportunidad ni orden', 'actividades', 'SELECT COUNT(*) n FROM actividades WHERE oportunidad_id IS NULL AND orden_servicio_id IS NULL');
    await control('Órdenes sin empresa vinculada', 'ordenes_servicio', 'SELECT COUNT(*) n FROM ordenes_servicio WHERE empresa_id IS NULL');
    await control('Empresas sin localidad', 'empresas', 'SELECT COUNT(*) n FROM empresas WHERE localidad_id IS NULL');
    await control('Localidades manuales (sin provincia)', 'localidades', 'SELECT COUNT(*) n FROM localidades WHERE provincia_id IS NULL');
    await control('Contraseñas sin bcrypt (texto plano)', 'usuarios', "SELECT COUNT(*) n FROM usuarios WHERE password_hash NOT LIKE '$2%'");
  }
  await rows('ROLLBACK');

  const archivo = `auditoria-db-${new Date().toISOString().slice(0, 10)}.txt`;
  fs.writeFileSync(archivo, `${out.join('\n')}\n`);
  console.log(`\nInforme guardado en ${archivo}`);
} catch (e) {
  console.error('Error en la auditoría:', e.message);
  process.exitCode = 1;
} finally {
  if (conn) sequelize.connectionManager.releaseConnection(conn);
  await sequelize.close();
}
