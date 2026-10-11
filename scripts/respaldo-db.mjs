#!/usr/bin/env node
// Respaldo completo de la base del .env en un archivo .sql (SOLO LECTURA sobre la base).
// Se corre antes de migrar producción, además del respaldo de Hostinger.
//
//   npm run db:respaldo                → respaldos/<base>-AAAA-MM-DD-HHMM.sql
//
// El archivo se restaura con `npm run db:restaurar -- <archivo> --destino=<base>`
// o importándolo desde phpMyAdmin. Contiene datos personales: guardalo en un
// lugar seguro y no lo subas al repositorio (respaldos/ está en .gitignore).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { opcionesConexion, conectar, volcar, fechaArchivo } from './lib/volcado.mjs';

const op = opcionesConexion('DB_');
const dir = path.resolve('respaldos');
fs.mkdirSync(dir, { recursive: true });
const archivo = path.join(dir, `${op.database}-${fechaArchivo()}.sql`);

let c;
try {
  c = await conectar(op);
  const fd = fs.openSync(archivo, 'w');
  const conteos = await volcar(c, op.database, async (linea) => { fs.writeSync(fd, `${linea}\n`); });
  fs.closeSync(fd);
  const total = Object.values(conteos).reduce((a, b) => a + b, 0);
  const mb = (fs.statSync(archivo).size / 1024 / 1024).toFixed(1);
  console.log(`Respaldo listo: ${archivo}`);
  console.log(`${Object.keys(conteos).length} tablas, ${total} filas, ${mb} MB.`);
  for (const [t, n] of Object.entries(conteos)) if (n) console.log(`  ${t}: ${n}`);
} catch (e) {
  console.error(`No se pudo hacer el respaldo: ${e.message}`);
  try { fs.unlinkSync(archivo); } catch { /* nada que borrar */ }
  process.exitCode = 1;
} finally {
  await c?.end();
}
