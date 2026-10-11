#!/usr/bin/env node
// Restaura un respaldo .sql (generado con db:respaldo) en una base.
//
//   npm run db:restaurar -- respaldos/archivo.sql --destino=<base>
//
// Por seguridad:
//  - El destino se indica siempre a mano (--destino); no se toma del .env.
//  - Si el destino es la base del .env (producción), pide escribir su nombre para confirmar.
//  - Si el destino tiene tablas, pide --reemplazar. La base queda IGUAL al respaldo:
//    se recrean sus tablas y se eliminan las que no estaban (por ejemplo, al volver
//    a la v1 después de migrar, se van las tablas v2 y el registro de migraciones).
// Usuario y contraseña del destino: ENSAYO_DB_USER / ENSAYO_DB_PASS si existen,
// si no los del .env (mismo servidor: ENSAYO_DB_HOST para otro).
import 'dotenv/config';
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { opcionesConexion, conectar, restaurar, leerLineas, tablasDe } from './lib/volcado.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const archivo = process.argv.slice(2).find((a) => !a.startsWith('--'));
const destino = typeof args.destino === 'string' ? args.destino : null;

if (!archivo || !fs.existsSync(archivo) || !destino) {
  console.error('Uso: npm run db:restaurar -- <archivo.sql> --destino=<nombre de la base> [--reemplazar]');
  process.exit(1);
}

const op = opcionesConexion('ENSAYO_DB_', { database: destino });
const esProduccion = destino === process.env.DB_NAME && op.host === process.env.DB_HOST;

let c;
try {
  if (esProduccion) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const r = await rl.question(`ATENCIÓN: "${destino}" es la base del .env (producción). Se van a reemplazar sus tablas con el respaldo.\nEscribí el nombre de la base para confirmar: `);
    rl.close();
    if (r.trim() !== destino) throw new Error('Confirmación incorrecta: no se hizo nada.');
  }
  c = await conectar(op);
  const existentes = (await tablasDe(c, destino)).length;
  if (existentes && !args.reemplazar && !esProduccion) {
    throw new Error(`La base "${destino}" ya tiene ${existentes} tablas. Si querés reemplazarlas, agregá --reemplazar.`);
  }
  const lineas = leerLineas(archivo);
  const delRespaldo = new Set(lineas.map((l) => l.match(/^DROP TABLE IF EXISTS `((?:[^`]|``)+)`;/)?.[1]?.replace(/``/g, '`')).filter(Boolean));
  if (!delRespaldo.size) throw new Error('El archivo no parece un respaldo de db:respaldo (no tiene tablas).');
  const sobrantes = (await tablasDe(c, destino)).map((t) => t.t).filter((t) => !delRespaldo.has(t));
  if (sobrantes.length) {
    await c.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of sobrantes) await c.query(`DROP TABLE \`${t.replace(/`/g, '``')}\``);
    console.log(`Tablas que no estaban en el respaldo, eliminadas: ${sobrantes.join(', ')}`);
  }
  const n = await restaurar(c, lineas, { alAvanzar: (k) => process.stdout.write(`\r${k} sentencias…`) });
  console.log(`\rRestauración lista: ${n} sentencias aplicadas en "${destino}".`);
} catch (e) {
  console.error(`\nNo se pudo restaurar: ${e.message}`);
  process.exitCode = 1;
} finally {
  await c?.end();
}
