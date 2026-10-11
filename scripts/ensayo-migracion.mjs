#!/usr/bin/env node
// Ensayo de la migración v1 → v2 sobre una COPIA de la base real, sin tocar producción.
//
//   1. Crear en hPanel (Hostinger → Bases de datos) una base vacía, por ejemplo
//      u767704345_crm_ensayo, con su usuario y contraseña.
//   2. Agregar al .env (no se sube al repo):
//        ENSAYO_DB_USER=<usuario de esa base>
//        ENSAYO_DB_PASS=<contraseña de esa base>
//   3. npm run db:ensayo -- --destino=u767704345_crm_ensayo
//
// Qué hace:
//   - Lee la base del .env en modo SOLO LECTURA y la copia a la base de ensayo.
//   - Aplica todas las migraciones sobre la copia.
//   - Verifica: migraciones al día, FKs creadas, tablas viejas eliminadas, cada
//     modelo coincide con su tabla y las cantidades antes/después.
//   - Guarda el informe en ensayo-migracion-AAAA-MM-DD-HHMM.txt (sin datos personales).
//
// Después se puede abrir la v2 con esos datos: npm run dev:ensayo
import 'dotenv/config';
import fs from 'node:fs';
import { opcionesConexion, conectar, volcar, contarTablas, tablasDe, fechaArchivo } from './lib/volcado.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const destino = typeof args.destino === 'string' ? args.destino : process.env.ENSAYO_DB_NAME;
const origen = opcionesConexion('DB_');
const opDestino = opcionesConexion('ENSAYO_DB_', { database: destino });

const informe = [];
const log = (s = '') => { informe.push(s); console.log(s); };
const fallas = [];
const verificar = (nombre, ok, detalle = '') => {
  log(`${ok ? '✔' : '✘'} ${nombre}${!ok && detalle ? ` → ${detalle}` : ''}`);
  if (!ok) fallas.push(nombre);
};

if (!destino) {
  console.error('Falta la base de ensayo: npm run db:ensayo -- --destino=<nombre>');
  process.exit(1);
}
if (destino === origen.database && opDestino.host === origen.host) {
  console.error('La base de ensayo no puede ser la misma que la del .env (producción).');
  process.exit(1);
}

let src;
let dst;
try {
  log(`# Ensayo de migración — ${new Date().toISOString()}`);
  log(`Origen (solo lectura): ${origen.database} @ ${origen.host}`);
  log(`Copia de ensayo: ${destino} @ ${opDestino.host}`);
  log('');

  // ── 1. Copia ──
  src = await conectar(origen);
  dst = await conectar(opDestino);
  const previas = await tablasDe(dst, destino);
  if (previas.length) {
    if (!args.reemplazar) throw new Error(`La base de ensayo ya tiene ${previas.length} tablas. Para borrarlas y empezar de nuevo agregá --reemplazar.`);
    await dst.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { t } of previas) await dst.query(`DROP TABLE \`${t.replace(/`/g, '``')}\``);
    log(`Base de ensayo vaciada (${previas.length} tablas).`);
  }
  // Se usa el mismo juego de caracteres que la base original.
  const [[cs]] = await src.query('SELECT DEFAULT_CHARACTER_SET_NAME AS cs, DEFAULT_COLLATION_NAME AS co FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [origen.database]);
  await dst.query(`ALTER DATABASE \`${destino}\` CHARACTER SET ${cs.cs} COLLATE ${cs.co}`).catch(() => log(`(No se pudo fijar ${cs.co} en la base de ensayo; se sigue con la que tiene.)`));
  const antes = await volcar(src, origen.database, (linea) => (linea.startsWith('--') ? null : dst.query(linea)));
  await src.end();
  src = null;
  const copiadas = await contarTablas(dst, destino);
  const difCopia = Object.keys(antes).filter((t) => antes[t] !== copiadas[t]);
  verificar(`Copia completa: ${Object.keys(antes).length} tablas, ${Object.values(antes).reduce((a, b) => a + b, 0)} filas`, !difCopia.length, difCopia.join(', '));
  await dst.end();
  dst = null;

  // ── 2. Migración sobre la copia ──
  // A partir de acá el CRM (sequelize, modelos, migraciones) apunta a la base de ensayo.
  process.env.DB_NAME = destino;
  process.env.DB_USER = opDestino.user;
  process.env.DB_PASS = opDestino.password;
  process.env.DB_HOST = opDestino.host;
  process.env.DB_PORT = String(opDestino.port);
  const { default: sequelize } = await import('../src/config/database.js');
  const { runMigrations, pendingMigrations } = await import('../src/db/migrator.js');
  const { FOREIGN_KEYS, OBSOLETE_TABLES } = await import('../src/db/migrations/0009_integridad.js');
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
  verificar('Sin migraciones pendientes', (await pendingMigrations(sequelize)).length === 0);
  const fks = await n("SELECT COUNT(*) AS n FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME NOT LIKE '\\_bak\\_%'", [destino]);
  verificar(`FKs v2 creadas (${fks} de ${FOREIGN_KEYS.length})`, fks === FOREIGN_KEYS.length);
  const tablas = new Set((await sequelize.query('SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', { replacements: [destino], raw: true }))[0].map((r) => r.t));
  const quedan = OBSOLETE_TABLES.filter((t) => tablas.has(t));
  verificar('Tablas v1 obsoletas eliminadas (con copia _bak_v1_*)', !quedan.length, quedan.join(', '));

  await import('../src/models/index.js'); // registra los modelos en sequelize
  const problemas = [];
  for (const model of Object.values(sequelize.models)) {
    const tabla = model.getTableName();
    if (!tablas.has(tabla)) { problemas.push(`falta la tabla ${tabla}`); continue; }
    const cols = await sequelize.getQueryInterface().describeTable(tabla);
    for (const [nombre, attr] of Object.entries(model.getAttributes())) {
      if (attr.type?.key === 'VIRTUAL') continue;
      if (!cols[attr.field || nombre]) problemas.push(`${tabla}.${attr.field || nombre}`);
    }
  }
  verificar(`Los ${Object.keys(sequelize.models).length} modelos coinciden con sus tablas`, !problemas.length, problemas.join(', '));
  const { valoresInvalidos } = await import('./lib/valores.mjs');
  const invalidos = await valoresInvalidos(sequelize);
  verificar('Todos los valores cumplen las listas y obligatorios de los modelos (comparación exacta)', !invalidos.length, invalidos.join('; '));

  // Cantidades: cada fila v1 tiene que seguir estando (o explicarse).
  const despues = {};
  for (const t of tablas) if (!t.startsWith('_bak_')) despues[t] = await n(`SELECT COUNT(*) AS n FROM \`${t}\``);
  const comparar = [
    ['usuarios', 'usuarios'], ['empresas_clientes', 'empresas'], ['clientes', 'contactos'], ['telefonos_cliente', 'contacto_telefonos'],
    ['negocios', 'oportunidades'], ['actividades', 'actividades'], ['tareas', 'tareas'], ['tareas_asignados', 'tarea_asignados'],
    ['hojas_ruta', 'hojas_ruta'], ['hoja_ruta_paradas', 'paradas_ruta'], ['objetivos', 'objetivos'], ['promociones', 'promociones'],
    ['notas_internas', 'notas_internas'], ['ordenes_servicio', 'ordenes_servicio'], ['orden_servicio_productos', 'productos_aplicados'],
    ['evaluaciones_servicio', 'evaluaciones_servicio'], ['empleados', 'empleados'], ['localidades', 'localidades'], ['tipos_cultivo', 'cultivos'],
  ];
  log('');
  log('## Cantidades (v1 → v2)');
  for (const [v1, v2] of comparar) {
    const a = antes[v1] ?? 0;
    const b = despues[v2] ?? 0;
    // Pueden crecer (oportunidades creadas para vincular actividades, técnicos dados de alta),
    // nunca achicarse salvo teléfonos/asignaciones/paradas huérfanos (quedan en _bak_v1_*).
    const puedeBajar = ['telefonos_cliente', 'tareas_asignados', 'hoja_ruta_paradas', 'orden_servicio_productos', 'evaluaciones_servicio'].includes(v1);
    const ok = b >= a || puedeBajar;
    log(`${ok ? '✔' : '✘'} ${v1} ${a} → ${v2} ${b}${b < a ? ` (${a - b} huérfanos, quedan en _bak_v1_${v1})` : ''}`);
    if (!ok) fallas.push(`cantidad ${v1}`);
  }

  log('');
  log('## Para revisar después de migrar (no bloquean)');
  log(`- Actividades sin oportunidad ni orden (el nombre escrito quedó en la descripción): ${await n('SELECT COUNT(*) AS n FROM actividades WHERE oportunidad_id IS NULL AND orden_servicio_id IS NULL')}`);
  log(`- Tareas con contacto escrito que no está cargado (quedó en notas): ${await n("SELECT COUNT(*) AS n FROM tareas WHERE contacto_id IS NULL AND notas LIKE '%Contacto: %'")}`);
  log(`- Empresas con CUIT repetido: ${await n('SELECT COUNT(*) AS n FROM (SELECT cuit FROM empresas WHERE cuit IS NOT NULL AND cuit <> \'\' GROUP BY cuit HAVING COUNT(*) > 1) x')} CUIT`);
  log(`- Localidades cargadas a mano (se unen con las oficiales con npm run seed:localidades): ${await n("SELECT COUNT(*) AS n FROM localidades WHERE id LIKE 'cp-%'")}`);
  log(`- Órdenes sin empresa vinculada: ${await n('SELECT COUNT(*) AS n FROM ordenes_servicio WHERE empresa_id IS NULL')}`);
  const roles = (await sequelize.query('SELECT rol, estado_cuenta AS e, COUNT(*) AS n FROM usuarios GROUP BY rol, estado_cuenta', { raw: true }))[0];
  log(`- Usuarios: ${roles.map((r) => `${r.rol}/${r.e}=${r.n}`).join(', ')}`);
  await sequelize.close();

  log('');
  log(fallas.length ? `RESULTADO: ${fallas.length} verificaciones con fallas — NO migrar producción todavía.` : 'RESULTADO: todo OK. La migración de producción debería comportarse igual.');
} catch (e) {
  log('');
  log(`ERROR: ${e.message}`);
  if (e.sql) log(e.sql);
  fallas.push(e.message);
  process.exitCode = 1;
} finally {
  await src?.end().catch(() => {});
  await dst?.end().catch(() => {});
  const archivo = `ensayo-migracion-${fechaArchivo()}.txt`;
  fs.writeFileSync(archivo, `${informe.join('\n')}\n`);
  console.log(`\nInforme guardado en ${archivo}`);
  if (fallas.length) process.exitCode = 1;
}
