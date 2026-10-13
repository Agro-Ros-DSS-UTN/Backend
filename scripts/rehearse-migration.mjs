#!/usr/bin/env node
// Ensayo de la migración v1 → v2 sobre una COPIA de la base real, sin tocar producción.
//
//   1. Crear en hPanel (Hostinger → Bases de datos) una base vacía, por ejemplo
//      u767704345_crm_ensayo, con su usuario y contraseña.
//   2. Agregar al .env (no se sube al repo):
//        REHEARSAL_DB_NAME=u767704345_crm_ensayo
//        REHEARSAL_DB_USER=<usuario de esa base>
//        REHEARSAL_DB_PASS=<contraseña de esa base>
//   3. npm run db:rehearse            (o --target=<base> para otra)
//
// Qué hace:
//   - Lee la base del .env en modo SOLO LECTURA y la copia a la base de ensayo.
//   - Aplica todas las migraciones sobre la copia.
//   - Verifica: migraciones al día, FKs creadas, tablas viejas eliminadas, cada
//     modelo coincide con su tabla y las cantidades antes/después.
//   - Guarda el informe en migration-rehearsal-AAAA-MM-DD-HHMM.txt (sin datos personales).
//
// Después se puede abrir la versión nueva con esos datos: npm run dev:rehearsal
import 'dotenv/config';
import fs from 'node:fs';
import { connectionOptions, connect, dump, countTables, tablesOf, fileDate } from './lib/dump.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const destination = typeof args.target === 'string' ? args.target : process.env.REHEARSAL_DB_NAME;
const source = connectionOptions('DB_');
const opTarget = connectionOptions('REHEARSAL_DB_', { database: destination });

const report = [];
const log = (s = '') => { report.push(s); console.log(s); };
const failures = [];
const check = (name, ok, details = '') => {
  log(`${ok ? '✔' : '✘'} ${name}${!ok && details ? ` → ${details}` : ''}`);
  if (!ok) failures.push(name);
};

if (!destination) {
  console.error('Falta la base de ensayo: REHEARSAL_DB_NAME en el .env o npm run db:rehearse -- --target=<nombre>');
  process.exit(1);
}
if (destination === source.database && opTarget.host === source.host) {
  console.error('La base de ensayo no puede ser la misma que la del .env (producción).');
  process.exit(1);
}

let src;
let dst;
try {
  log(`# Ensayo de migración — ${new Date().toISOString()}`);
  log(`Origen (solo lectura): ${source.database} @ ${source.host}`);
  log(`Copia de ensayo: ${destination} @ ${opTarget.host}`);
  log('');

  // ── 1. Copia ──
  src = await connect(source);
  dst = await connect(opTarget);
  const previous = await tablesOf(dst, destination);
  if (previous.length) {
    if (!args.replace) throw new Error(`La base de ensayo ya tiene ${previous.length} tablas. Para borrarlas y empezar de nuevo agregá --replace.`);
    await dst.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { t } of previous) await dst.query(`DROP TABLE \`${t.replace(/`/g, '``')}\``);
    log(`Base de ensayo vaciada (${previous.length} tablas).`);
  }
  // Se usa el mismo juego de caracteres que la base original.
  const [[cs]] = await src.query('SELECT DEFAULT_CHARACTER_SET_NAME AS cs, DEFAULT_COLLATION_NAME AS co FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [source.database]);
  await dst.query(`ALTER DATABASE \`${destination}\` CHARACTER SET ${cs.cs} COLLATE ${cs.co}`).catch(() => log(`(No se pudo fijar ${cs.co} en la base de ensayo; se sigue con la que tiene.)`));
  const before = await dump(src, source.database, (line) => (line.startsWith('--') ? null : dst.query(line)));
  await src.end();
  src = null;
  const copied = await countTables(dst, destination);
  const copyDiff = Object.keys(before).filter((t) => before[t] !== copied[t]);
  check(`Copia completa: ${Object.keys(before).length} tablas, ${Object.values(before).reduce((a, b) => a + b, 0)} filas`, !copyDiff.length, copyDiff.join(', '));
  await dst.end();
  dst = null;

  // ── 2. Migración sobre la copia ──
  // A partir de acá el CRM (sequelize, modelos, migraciones) apunta a la base de ensayo.
  process.env.DB_NAME = destination;
  process.env.DB_USER = opTarget.user;
  process.env.DB_PASS = opTarget.password;
  process.env.DB_HOST = opTarget.host;
  process.env.DB_PORT = String(opTarget.port);
  const { default: sequelize } = await import('../src/config/database.js');
  const { runMigrations, pendingMigrations } = await import('../src/db/migrator.js');
  const { OBSOLETE_TABLES } = await import('../src/db/migrations/0009_integrity.js');
  const { FOREIGN_KEYS, TABLES } = await import('../src/db/migrations/0012_english_names.js');
  log('');
  log('## Migración');
  const t0 = Date.now();
  await runMigrations(sequelize, { log });
  log(`Duración: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  log('');

  // ── 3. Verificaciones ──
  log('## Verificaciones');
  const one = async (sql, r) => (await sequelize.query(sql, { replacements: r, raw: true }))[0][0];
  const n = async (sql, r) => Number((await one(sql, r))?.n ?? 0);
  check('Sin migraciones pendientes', (await pendingMigrations(sequelize)).length === 0);
  const fks = await n("SELECT COUNT(*) AS n FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME NOT LIKE '\\_bak\\_%'", [destination]);
  check(`FKs creadas (${fks} de ${FOREIGN_KEYS.length})`, fks === FOREIGN_KEYS.length);
  const tables = new Set((await sequelize.query('SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', { replacements: [destination], raw: true }))[0].map((r) => r.t));
  const remaining = OBSOLETE_TABLES.filter((t) => tables.has(t));
  check('Tablas v1 obsoletas eliminadas (con copia _bak_v1_*)', !remaining.length, remaining.join(', '));

  await import('../src/models/index.js'); // registra los modelos en sequelize
  const problems = [];
  for (const model of Object.values(sequelize.models)) {
    const table = model.getTableName();
    if (!tables.has(table)) { problems.push(`falta la tabla ${table}`); continue; }
    const cols = await sequelize.getQueryInterface().describeTable(table);
    for (const [name, attr] of Object.entries(model.getAttributes())) {
      if (attr.type?.key === 'VIRTUAL') continue;
      if (!cols[attr.field || name]) problems.push(`${table}.${attr.field || name}`);
    }
  }
  check(`Los ${Object.keys(sequelize.models).length} modelos coinciden con sus tablas`, !problems.length, problems.join(', '));
  const { invalidValues } = await import('./lib/values.mjs');
  const invalid = await invalidValues(sequelize);
  check('Todos los valores cumplen las listas y obligatorios de los modelos (comparación exacta)', !invalid.length, invalid.join('; '));

  // Cantidades: cada fila v1 tiene que seguir estando (o explicarse).
  const after = {};
  for (const t of tables) if (!t.startsWith('_bak_')) after[t] = await n(`SELECT COUNT(*) AS n FROM \`${t}\``);
  const compare = [
    ['usuarios', 'users'], ['empresas_clientes', 'companies'], ['clientes', 'contacts'], ['telefonos_cliente', 'contact_phones'],
    ['negocios', 'opportunities'], ['actividades', 'activities'], ['tareas', 'tasks'], ['tareas_asignados', 'task_assignees'],
    ['hojas_ruta', 'roadmaps'], ['hoja_ruta_paradas', 'roadmap_stops'], ['objetivos', 'objectives'], ['promociones', 'promotions'],
    ['notas_internas', 'internal_notes'], ['ordenes_servicio', 'service_orders'], ['orden_servicio_productos', 'applied_products'],
    ['evaluaciones_servicio', 'service_evaluations'], ['empleados', 'employees'], ['localidades', 'localities'], ['tipos_cultivo', 'crops'],
  ];
  log('');
  log('## Cantidades (antes → después)');
  for (const [v1, v2] of compare) {
    // Si la base ya estaba en v2 (nombres en español), se compara contra esa tabla.
    const v2es = Object.entries(TABLES).find(([, [n]]) => n === v2)?.[0];
    const a = before[v1] ?? before[v2es] ?? 0;
    const b = after[v2] ?? 0;
    // Pueden crecer (oportunidades creadas para vincular actividades, técnicos dados de alta),
    // nunca achicarse salvo teléfonos/asignaciones/paradas huérfanos (quedan en _bak_v1_*).
    const canDecrease = ['telefonos_cliente', 'tareas_asignados', 'hoja_ruta_paradas', 'orden_servicio_productos', 'evaluaciones_servicio'].includes(v1);
    const ok = b >= a || canDecrease;
    log(`${ok ? '✔' : '✘'} ${before[v1] !== undefined ? v1 : v2es} ${a} → ${v2} ${b}${b < a ? ` (${a - b} huérfanos, quedan en _bak_v1_${v1})` : ''}`);
    if (!ok) failures.push(`cantidad ${v1}`);
  }

  log('');
  log('## Para revisar después de migrar (no bloquean)');
  log(`- Actividades sin oportunidad ni orden (el nombre escrito quedó en la descripción): ${await n('SELECT COUNT(*) AS n FROM activities WHERE opportunity_id IS NULL AND service_order_id IS NULL')}`);
  log(`- Tareas con contacto escrito que no está cargado (quedó en notas): ${await n("SELECT COUNT(*) AS n FROM tasks WHERE contact_id IS NULL AND notes LIKE '%Contacto: %'")}`);
  log(`- Empresas con CUIT repetido: ${await n('SELECT COUNT(*) AS n FROM (SELECT cuit FROM companies WHERE cuit IS NOT NULL AND cuit <> \'\' GROUP BY cuit HAVING COUNT(*) > 1) x')} CUIT`);
  log(`- Localidades cargadas a mano (se unen con las oficiales con npm run seed:localities): ${await n("SELECT COUNT(*) AS n FROM localities WHERE id LIKE 'cp-%'")}`);
  log(`- Órdenes sin empresa vinculada: ${await n('SELECT COUNT(*) AS n FROM service_orders WHERE company_id IS NULL')}`);
  const roles = (await sequelize.query('SELECT role, account_status AS e, COUNT(*) AS n FROM users GROUP BY role, account_status', { raw: true }))[0];
  log(`- Usuarios: ${roles.map((r) => `${r.role}/${r.e}=${r.n}`).join(', ')}`);
  await sequelize.close();

  log('');
  log(failures.length ? `RESULTADO: ${failures.length} verificaciones con fallas — NO migrar producción todavía.` : 'RESULTADO: todo OK. La migración de producción debería comportarse igual.');
} catch (e) {
  log('');
  log(`ERROR: ${e.message}`);
  if (e.sql) log(e.sql);
  failures.push(e.message);
  process.exitCode = 1;
} finally {
  await src?.end().catch(() => {});
  await dst?.end().catch(() => {});
  const file = `migration-rehearsal-${fileDate()}.txt`;
  fs.writeFileSync(file, `${report.join('\n')}\n`);
  console.log(`\nInforme guardado en ${file}`);
  if (failures.length) process.exitCode = 1;
}
