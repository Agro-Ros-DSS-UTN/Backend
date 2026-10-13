#!/usr/bin/env node
// Restaura un respaldo .sql (generado con db:backup) en una base.
//
//   npm run db:restore -- backups/archivo.sql --target=<base>
//
// Por seguridad:
//  - El destino se indica siempre a mano (--target); no se toma del .env.
//  - Si el destino es la base del .env (producción), pide escribir su nombre para confirmar.
//  - Si el destino tiene tablas, pide --replace. La base queda IGUAL al respaldo:
//    se recrean sus tablas y se eliminan las que no estaban (por ejemplo, al volver
//    a la v1 después de migrar, se van las tablas v2 y el registro de migraciones).
// Usuario y contraseña del destino: REHEARSAL_DB_USER / REHEARSAL_DB_PASS si existen,
// si no los del .env (mismo servidor: REHEARSAL_DB_HOST para otro).
import 'dotenv/config';
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { connectionOptions, connect, restore, readLines, tablesOf } from './lib/dump.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
const destination = typeof args.target === 'string' ? args.target : null;

if (!file || !fs.existsSync(file) || !destination) {
  console.error('Uso: npm run db:restore -- <archivo.sql> --target=<nombre de la base> [--replace]');
  process.exit(1);
}

const op = connectionOptions('REHEARSAL_DB_', { database: destination });
const isProduction = destination === process.env.DB_NAME && op.host === process.env.DB_HOST;

let c;
try {
  if (isProduction) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const r = await rl.question(`ATENCIÓN: "${destination}" es la base del .env (producción). Se van a reemplazar sus tablas con el respaldo.\nEscribí el nombre de la base para confirmar: `);
    rl.close();
    if (r.trim() !== destination) throw new Error('Confirmación incorrecta: no se hizo nada.');
  }
  c = await connect(op);
  const existing = (await tablesOf(c, destination)).length;
  if (existing && !args.replace && !isProduction) {
    throw new Error(`La base "${destination}" ya tiene ${existing} tablas. Si querés reemplazarlas, agregá --replace.`);
  }
  const lines = readLines(file);
  const fromBackup = new Set(lines.map((l) => l.match(/^DROP TABLE IF EXISTS `((?:[^`]|``)+)`;/)?.[1]?.replace(/``/g, '`')).filter(Boolean));
  if (!fromBackup.size) throw new Error('El archivo no parece un respaldo de db:backup (no tiene tablas).');
  const leftover = (await tablesOf(c, destination)).map((t) => t.t).filter((t) => !fromBackup.has(t));
  if (leftover.length) {
    await c.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of leftover) await c.query(`DROP TABLE \`${t.replace(/`/g, '``')}\``);
    console.log(`Tablas que no estaban en el respaldo, eliminadas: ${leftover.join(', ')}`);
  }
  const n = await restore(c, lines, { onAdvance: (k) => process.stdout.write(`\r${k} sentencias…`) });
  console.log(`\rRestauración lista: ${n} sentencias aplicadas en "${destination}".`);
} catch (e) {
  console.error(`\nNo se pudo restaurar: ${e.message}`);
  process.exitCode = 1;
} finally {
  await c?.end();
}
