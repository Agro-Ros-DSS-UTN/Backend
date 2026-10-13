// Volcado y restauración de una base MySQL/MariaDB sin depender de mysqldump.
// El archivo .sql que genera también se puede importar desde phpMyAdmin (Hostinger).
//
// Formato: una sentencia por línea, terminada en ";". Los saltos de línea dentro
// de los datos quedan escapados (\n), así la restauración lee línea por línea.
import fs from 'node:fs';
import mysql from 'mysql2/promise';

// Opciones de conexión a partir de variables de entorno con un prefijo
// (DB_* para la base del .env, REHEARSAL_DB_* para la base de ensayo).
export const connectionOptions = (prefix = 'DB_', extra = {}) => {
  const v = (k, def) => process.env[`${prefix}${k}`] ?? (prefix !== 'DB_' ? process.env[`DB_${k}`] : undefined) ?? def;
  const ssl = !['0', 'false', 'no'].includes(String(v('SSL', 'true')).toLowerCase());
  const ca = v('SSL_CA', '');
  return {
    host: v('HOST'),
    port: Number(v('PORT', 3306)),
    user: v('USER'),
    password: v('PASS', ''),
    database: v('NAME'),
    ...(ssl ? { ssl: { rejectUnauthorized: Boolean(ca) && !['0', 'false'].includes(String(v('SSL_REJECT_UNAUTHORIZED', 'true')).toLowerCase()), ...(ca ? { ca: fs.existsSync(ca) ? fs.readFileSync(ca, 'utf8') : ca.replace(/\\n/g, '\n') } : {}) } } : {}),
    // Fechas como texto: se copian tal cual, sin conversiones de zona horaria.
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    charset: 'utf8mb4',
    ...extra,
  };
};

export const connect = (options) => mysql.createConnection(options);

const qi = (n) => `\`${String(n).replace(/`/g, '``')}\``;

export const tablesOf = async (c, db) =>
  (await c.query("SELECT TABLE_NAME AS t, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME", [db]))[0];

// Recorre la base y entrega cada sentencia a `write(line)`. Devuelve { tabla: filas }.
export const dump = async (c, db, write, { readOnly = true, batchSize = 2 * 1024 * 1024 } = {}) => {
  if (readOnly) {
    await c.query('SET SESSION TRANSACTION READ ONLY');
    await c.query('START TRANSACTION READ ONLY'); // foto consistente de todas las tablas
  }
  const counts = {};
  const tables = await tablesOf(c, db);
  const views = tables.filter((t) => t.type !== 'BASE TABLE');
  if (views.length) throw new Error(`La base tiene vistas (${views.map((v) => v.t).join(', ')}); este volcado no las contempla.`);
  await write(`-- Respaldo de la base ${db} — ${new Date().toISOString()}`);
  await write('SET NAMES utf8mb4;');
  await write('SET FOREIGN_KEY_CHECKS = 0;');
  await write("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';");
  for (const { t } of tables) {
    const [[def]] = await c.query(`SHOW CREATE TABLE ${qi(t)}`);
    await write(`DROP TABLE IF EXISTS ${qi(t)};`);
    await write(`${def['Create Table'].replace(/\r?\n\s*/g, ' ')};`);
    const [rows, fields] = await c.query({ sql: `SELECT * FROM ${qi(t)}`, rowsAsArray: true });
    counts[t] = rows.length;
    if (!rows.length) continue;
    const cols = `(${fields.map((f) => qi(f.name)).join(', ')})`;
    let batch = [];
    let size = 0;
    const empty = async () => {
      if (!batch.length) return;
      await write(`INSERT INTO ${qi(t)} ${cols} VALUES ${batch.join(', ')};`);
      batch = [];
      size = 0;
    };
    for (const row of rows) {
      const values = `(${row.map((v) => c.escape(v)).join(', ')})`;
      if (size + values.length > batchSize) await empty();
      batch.push(values);
      size += values.length;
    }
    await empty();
  }
  await write('SET FOREIGN_KEY_CHECKS = 1;');
  if (readOnly) await c.query('COMMIT');
  return counts;
};

// Ejecuta un respaldo (líneas) sobre la conexión `c`, que ya apunta a la base destino.
export const restore = async (c, lines, { onAdvance } = {}) => {
  let n = 0;
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith('--')) continue;
    await c.query(s);
    n++;
    if (onAdvance && n % 50 === 0) onAdvance(n);
  }
  return n;
};

export const readLines = (file) => fs.readFileSync(file, 'utf8').split('\n');

export const countTables = async (c, db) => {
  const r = {};
  for (const { t, type } of await tablesOf(c, db)) {
    if (type !== 'BASE TABLE') continue;
    r[t] = Number((await c.query(`SELECT COUNT(*) AS n FROM ${qi(t)}`))[0][0].n);
  }
  return r;
};

export const fileDate = () => {
  // AAAA-MM-DD-HHMM en hora de Argentina
  const d = new Date(Date.now() - 3 * 3600000).toISOString();
  return `${d.slice(0, 10)}-${d.slice(11, 13)}${d.slice(14, 16)}`;
};
