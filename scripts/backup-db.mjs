#!/usr/bin/env node
// Respaldo completo de la base del .env en un archivo .sql (SOLO LECTURA sobre la base).
// Se corre antes de migrar producción, además del respaldo de Hostinger.
//
//   npm run db:backup                  → backups/<base>-AAAA-MM-DD-HHMM.sql
//
// El archivo se restaura con `npm run db:restore -- <archivo> --target=<base>`
// o importándolo desde phpMyAdmin. Contiene datos personales: guardalo en un
// lugar seguro y no lo subas al repositorio (backups/ está en .gitignore).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { connectionOptions, connect, dump, fileDate } from './lib/dump.mjs';

const op = connectionOptions('DB_');
const dir = path.resolve('backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${op.database}-${fileDate()}.sql`);

let c;
try {
  c = await connect(op);
  const fd = fs.openSync(file, 'w');
  const counts = await dump(c, op.database, async (line) => { fs.writeSync(fd, `${line}\n`); });
  fs.closeSync(fd);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(1);
  console.log(`Respaldo listo: ${file}`);
  console.log(`${Object.keys(counts).length} tablas, ${total} filas, ${mb} MB.`);
  for (const [t, n] of Object.entries(counts)) if (n) console.log(`  ${t}: ${n}`);
} catch (e) {
  console.error(`No se pudo hacer el respaldo: ${e.message}`);
  try { fs.unlinkSync(file); } catch { /* nada que borrar */ }
  process.exitCode = 1;
} finally {
  await c?.end();
}
