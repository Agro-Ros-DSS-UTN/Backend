import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSchemaHelpers } from './schema.js';

// Motor de migraciones propio (sin dependencias extra).
// - Cada archivo de src/db/migrations exporta { descripcion, up(ctx) } y,
//   cuando se puede, down(ctx).
// - Las migraciones aplicadas se registran en la tabla `migraciones`.
// - Un lock de MySQL (GET_LOCK) evita que dos instancias migren a la vez.

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const LOCK = 'crm_agroros_migraciones';

export const listMigrationFiles = () =>
  fs.readdirSync(dir).filter((f) => /^\d{4}_.+\.js$/.test(f)).sort();

const ensureTable = (h) =>
  h.q(`CREATE TABLE IF NOT EXISTS migraciones (
         nombre VARCHAR(190) NOT NULL PRIMARY KEY,
         descripcion VARCHAR(255) NULL,
         ejecutada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         duracion_ms INT NULL
       ) ENGINE=InnoDB`);

export const migrationStatus = async (sequelize) => {
  const h = createSchemaHelpers(sequelize);
  await ensureTable(h);
  const done = new Set((await h.rows('SELECT nombre FROM migraciones')).map((r) => r.nombre));
  return listMigrationFiles().map((f) => ({ nombre: f, aplicada: done.has(f) }));
};

export const pendingMigrations = async (sequelize) => (await migrationStatus(sequelize)).filter((m) => !m.aplicada);

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
  const h = createSchemaHelpers(sequelize);
  await ensureTable(h);
  return withLock(h, async () => {
    const pending = (await pendingMigrations(sequelize)).filter((m) => !to || m.nombre <= to);
    const applied = [];
    for (const m of pending) {
      const mod = await import(pathToFileURL(path.join(dir, m.nombre)).href);
      const started = Date.now();
      log(`[migraciones] → ${m.nombre}: ${mod.descripcion || ''}`);
      const report = [];
      await mod.up({ sequelize, h, log: (msg) => { report.push(msg); log(`    ${msg}`); } });
      const ms = Date.now() - started;
      await h.q('INSERT INTO migraciones (nombre, descripcion, duracion_ms) VALUES (?, ?, ?)', [m.nombre, (mod.descripcion || '').slice(0, 255), ms]);
      applied.push({ nombre: m.nombre, ms, report });
    }
    if (!applied.length) log('[migraciones] La base ya está al día.');
    return applied;
  });
};

export const rollbackLast = async (sequelize, { log = console.log } = {}) => {
  const h = createSchemaHelpers(sequelize);
  await ensureTable(h);
  return withLock(h, async () => {
    const last = await h.one('SELECT nombre FROM migraciones ORDER BY nombre DESC LIMIT 1');
    if (!last) return log('[migraciones] No hay migraciones para revertir.');
    const mod = await import(pathToFileURL(path.join(dir, last.nombre)).href);
    if (typeof mod.down !== 'function') {
      throw new Error(`${last.nombre} no se puede revertir automáticamente: restaurá desde las tablas _bak_v1_* o desde el respaldo (ver docs/MIGRACION_V2.md).`);
    }
    log(`[migraciones] ← revirtiendo ${last.nombre}`);
    await mod.down({ sequelize, h, log });
    await h.q('DELETE FROM migraciones WHERE nombre = ?', [last.nombre]);
  });
};
