// Volcado y restauración de una base MySQL/MariaDB sin depender de mysqldump.
// El archivo .sql que genera también se puede importar desde phpMyAdmin (Hostinger).
//
// Formato: una sentencia por línea, terminada en ";". Los saltos de línea dentro
// de los datos quedan escapados (\n), así la restauración lee línea por línea.
import fs from 'node:fs';
import mysql from 'mysql2/promise';

// Opciones de conexión a partir de variables de entorno con un prefijo
// (DB_* para la base del .env, ENSAYO_DB_* para la base de ensayo).
export const opcionesConexion = (prefijo = 'DB_', extra = {}) => {
  const v = (k, def) => process.env[`${prefijo}${k}`] ?? (prefijo !== 'DB_' ? process.env[`DB_${k}`] : undefined) ?? def;
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

export const conectar = (opciones) => mysql.createConnection(opciones);

const qi = (n) => `\`${String(n).replace(/`/g, '``')}\``;

export const tablasDe = async (c, db) =>
  (await c.query("SELECT TABLE_NAME AS t, TABLE_TYPE AS tipo FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME", [db]))[0];

// Recorre la base y entrega cada sentencia a `escribir(linea)`. Devuelve { tabla: filas }.
export const volcar = async (c, db, escribir, { soloLectura = true, tamLote = 2 * 1024 * 1024 } = {}) => {
  if (soloLectura) {
    await c.query('SET SESSION TRANSACTION READ ONLY');
    await c.query('START TRANSACTION READ ONLY'); // foto consistente de todas las tablas
  }
  const conteos = {};
  const tablas = await tablasDe(c, db);
  const vistas = tablas.filter((t) => t.tipo !== 'BASE TABLE');
  if (vistas.length) throw new Error(`La base tiene vistas (${vistas.map((v) => v.t).join(', ')}); este volcado no las contempla.`);
  await escribir(`-- Respaldo de la base ${db} — ${new Date().toISOString()}`);
  await escribir('SET NAMES utf8mb4;');
  await escribir('SET FOREIGN_KEY_CHECKS = 0;');
  await escribir("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';");
  for (const { t } of tablas) {
    const [[def]] = await c.query(`SHOW CREATE TABLE ${qi(t)}`);
    await escribir(`DROP TABLE IF EXISTS ${qi(t)};`);
    await escribir(`${def['Create Table'].replace(/\r?\n\s*/g, ' ')};`);
    const [filas, campos] = await c.query({ sql: `SELECT * FROM ${qi(t)}`, rowsAsArray: true });
    conteos[t] = filas.length;
    if (!filas.length) continue;
    const cols = `(${campos.map((f) => qi(f.name)).join(', ')})`;
    let lote = [];
    let tam = 0;
    const vaciar = async () => {
      if (!lote.length) return;
      await escribir(`INSERT INTO ${qi(t)} ${cols} VALUES ${lote.join(', ')};`);
      lote = [];
      tam = 0;
    };
    for (const fila of filas) {
      const valores = `(${fila.map((v) => c.escape(v)).join(', ')})`;
      if (tam + valores.length > tamLote) await vaciar();
      lote.push(valores);
      tam += valores.length;
    }
    await vaciar();
  }
  await escribir('SET FOREIGN_KEY_CHECKS = 1;');
  if (soloLectura) await c.query('COMMIT');
  return conteos;
};

// Ejecuta un respaldo (líneas) sobre la conexión `c`, que ya apunta a la base destino.
export const restaurar = async (c, lineas, { alAvanzar } = {}) => {
  let n = 0;
  for (const linea of lineas) {
    const s = linea.trim();
    if (!s || s.startsWith('--')) continue;
    await c.query(s);
    n++;
    if (alAvanzar && n % 50 === 0) alAvanzar(n);
  }
  return n;
};

export const leerLineas = (archivo) => fs.readFileSync(archivo, 'utf8').split('\n');

export const contarTablas = async (c, db) => {
  const r = {};
  for (const { t, tipo } of await tablasDe(c, db)) {
    if (tipo !== 'BASE TABLE') continue;
    r[t] = Number((await c.query(`SELECT COUNT(*) AS n FROM ${qi(t)}`))[0][0].n);
  }
  return r;
};

export const fechaArchivo = () => {
  // AAAA-MM-DD-HHMM en hora de Argentina
  const d = new Date(Date.now() - 3 * 3600000).toISOString();
  return `${d.slice(0, 10)}-${d.slice(11, 13)}${d.slice(14, 16)}`;
};
