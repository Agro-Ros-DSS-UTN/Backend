import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSchemaHelpers } from './schema.js';

// Motor de migraciones propio (sin dependencias extra).
// - Cada archivo de src/shared/db/migrations exporta { description, up(ctx) } y,
//   cuando se puede, down(ctx).
// - Las migraciones aplicadas se registran en la tabla `migrations`.
// - Un lock de MySQL (GET_LOCK) evita que dos instancias migren a la vez.

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const LOCK = 'crm_agroros_migrations';

// Hasta la 0011 el registro se llamaba `migraciones` y los archivos tenían
// nombres en español. Se traduce una sola vez, antes de comparar.
const LEGACY_TABLE = 'migraciones';
const LEGACY_FILES = {
  '0002_respaldo_v1.js': '0002_backup_v1.js',
  '0003_usuarios_territorio.js': '0003_users_territory.js',
  '0004_empresas_contactos.js': '0004_companies_contacts.js',
  '0005_catalogo.js': '0005_catalog.js',
  '0006_comercial.js': '0006_commercial.js',
  '0007_planificacion.js': '0007_planning.js',
  '0008_servicios.js': '0008_services.js',
  '0009_integridad.js': '0009_integrity.js',
  '0010_emails_de_relleno.js': '0010_placeholder_emails.js',
  '0011_dni_de_relleno.js': '0011_placeholder_national_ids.js',
};

// Las migraciones no se suben al repositorio (se corren desde la PC con
// npm run db:migrate), así que en el servidor la carpeta no existe. Para no
// arrancar contra una base vieja, el servidor exige que esté aplicada la última
// migración que conoce el código. Al agregar una migración, actualizar este nombre.
export const LATEST_MIGRATION = '0012_english_names.js';

export const listMigrationFiles = () =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{4}_.+\.js$/.test(f)).sort() : [];

const upgradeLegacyTable = async (h) => {
  if (!(await h.hasTable(LEGACY_TABLE)) || (await h.hasTable('migrations'))) return;
  await h.q(`RENAME TABLE ${LEGACY_TABLE} TO migrations`);
  for (const [from, to] of [['nombre', 'name'], ['descripcion', 'description'], ['ejecutada_en', 'executed_at'], ['duracion_ms', 'duration_ms']]) {
    if (await h.hasColumn('migrations', from)) await h.q(`ALTER TABLE migrations RENAME COLUMN ${from} TO ${to}`);
  }
  for (const [from, to] of Object.entries(LEGACY_FILES)) {
    await h.q('UPDATE migrations SET name = ? WHERE name = ?', [to, from]);
  }
};

const ensureTable = async (h) => {
  await upgradeLegacyTable(h);
  await h.q(`CREATE TABLE IF NOT EXISTS migrations (
         name VARCHAR(190) NOT NULL PRIMARY KEY,
         description VARCHAR(255) NULL,
         executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         duration_ms INT NULL
       ) ENGINE=InnoDB`);
};

export const migrationStatus = async (sequelize) => {
  const h = createSchemaHelpers(sequelize);
  await ensureTable(h);
  const done = new Set((await h.rows('SELECT name FROM migrations')).map((r) => r.name));
  const files = listMigrationFiles();
  if (!files.length) return [{ name: LATEST_MIGRATION, applied: done.has(LATEST_MIGRATION) }];
  if (files.at(-1) !== LATEST_MIGRATION) console.warn(`[migraciones] LATEST_MIGRATION (${LATEST_MIGRATION}) no es la última migración (${files.at(-1)}): actualizalo en src/db/migrator.js.`);
  return files.map((f) => ({ name: f, applied: done.has(f) }));
};

export const pendingMigrations = async (sequelize) => (await migrationStatus(sequelize)).filter((m) => !m.applied);

const withLock = async (h, fn) => {
  let locked = false;
  try {
    const r = await h.one(`SELECT GET_LOCK('${LOCK}', 60) AS l`);
    locked = Number(r?.l) === 1;
  } catch {
    locked = true; // motores sin GET_LOCK: se sigue sin lock
  }
  if (!locked) throw new Error('Otra instancia está ejecutando migraciones. Reintentá en unos segundos.');
  try {
    return await fn();
  } finally {
    await h.q(`SELECT RELEASE_LOCK('${LOCK}')`).catch(() => {});
  }
};

export const runMigrations = async (sequelize, { log = console.log, to } = {}) => {
  if (!fs.existsSync(dir)) throw new Error('Las migraciones no están en este equipo: correlas desde la PC con "npm run db:migrate".');
  const h = createSchemaHelpers(sequelize);
  await ensureTable(h);
  return withLock(h, async () => {
    const pending = (await pendingMigrations(sequelize)).filter((m) => !to || m.name <= to);
    const applied = [];
    for (const m of pending) {
      const mod = await import(pathToFileURL(path.join(dir, m.name)).href);
      const started = Date.now();
      log(`[migraciones] → ${m.name}: ${mod.description || ''}`);
      const report = [];
      await mod.up({ sequelize, h, log: (msg) => { report.push(msg); log(`    ${msg}`); } });
      const ms = Date.now() - started;
      await h.q('INSERT INTO migrations (name, description, duration_ms) VALUES (?, ?, ?)', [m.name, (mod.description || '').slice(0, 255), ms]);
      applied.push({ name: m.name, ms, report });
    }
    if (!applied.length) log('[migraciones] La base ya está al día.');
    return applied;
  });
};

export const rollbackLast = async (sequelize, { log = console.log } = {}) => {
  const h = createSchemaHelpers(sequelize);
  await ensureTable(h);
  return withLock(h, async () => {
    const last = await h.one('SELECT name FROM migrations ORDER BY name DESC LIMIT 1');
    if (!last) return log('[migraciones] No hay migraciones para revertir.');
    const mod = await import(pathToFileURL(path.join(dir, last.name)).href);
    if (typeof mod.down !== 'function') {
      throw new Error(`${last.name} no se puede revertir automáticamente: restaurá desde las tablas _bak_v1_* o desde el respaldo (ver docs/MIGRATION_V2.md).`);
    }
    log(`[migraciones] ← revirtiendo ${last.name}`);
    await mod.down({ sequelize, h, log });
    await h.q('DELETE FROM migrations WHERE name = ?', [last.name]);
  });
};
