#!/usr/bin/env node
// Uso:
//   node scripts/db-migrate.mjs status     → lista migraciones aplicadas y pendientes
//   node scripts/db-migrate.mjs up         → aplica las pendientes
//   node scripts/db-migrate.mjs up 0005    → aplica hasta la 0005 inclusive
//   node scripts/db-migrate.mjs down       → revierte la última (si tiene down)
import sequelize from '../src/config/database.js';
import { migrationStatus, runMigrations, rollbackLast } from '../src/db/migrator.js';

const [cmd = 'status', arg] = process.argv.slice(2);
try {
  if (cmd === 'status') {
    for (const m of await migrationStatus(sequelize)) console.log(`${m.aplicada ? '✔' : '·'} ${m.nombre}`);
  } else if (cmd === 'up') {
    const to = arg ? (await migrationStatus(sequelize)).map((m) => m.nombre).filter((n) => n.startsWith(arg)).pop() : undefined;
    await runMigrations(sequelize, { to });
  } else if (cmd === 'down') {
    await rollbackLast(sequelize);
  } else {
    console.error(`Comando desconocido: ${cmd}`);
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`\n[migraciones] ERROR: ${err.message}\n`);
  if (err.sql) console.error(err.sql);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
