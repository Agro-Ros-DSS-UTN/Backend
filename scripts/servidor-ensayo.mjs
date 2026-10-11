#!/usr/bin/env node
// Levanta la API v2 en tu PC contra la base de ENSAYO (la copia migrada con db:ensayo),
// para probar la versión nueva con los datos reales sin tocar producción.
//
//   npm run dev:ensayo      (usa ENSAYO_DB_NAME / ENSAYO_DB_USER / ENSAYO_DB_PASS del .env)
//
// Mails y Google Calendar quedan apagados: la copia tiene usuarios reales y no hay
// que mandarles recordatorios ni crearles eventos desde una prueba.
import 'dotenv/config';

const nombre = process.env.ENSAYO_DB_NAME;
if (!nombre) {
  console.error('Falta ENSAYO_DB_NAME en el .env (el nombre de la base de ensayo).');
  process.exit(1);
}
if (nombre === process.env.DB_NAME) {
  console.error('ENSAYO_DB_NAME es igual a DB_NAME (producción). No se levanta.');
  process.exit(1);
}
process.env.DB_NAME = nombre;
for (const k of ['USER', 'PASS', 'HOST', 'PORT']) if (process.env[`ENSAYO_DB_${k}`]) process.env[`DB_${k}`] = process.env[`ENSAYO_DB_${k}`];
// Vacías (no borradas): así dotenv no las vuelve a cargar desde el .env.
for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'GOOGLE_CALENDAR_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY']) process.env[k] = '';
process.env.NODE_ENV = 'development';
process.env.DB_AUTO_MIGRATE = 'false';
process.env.FRONTEND_URL = process.env.ENSAYO_FRONTEND_URL || 'http://localhost:5173';
process.env.PORT = process.env.ENSAYO_PORT || '3000';
console.log(`[ensayo] API contra la base ${nombre} — mails y calendario apagados.`);
await import('../server.js');
