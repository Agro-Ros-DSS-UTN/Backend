#!/usr/bin/env node
// Levanta la API en tu PC contra la base de ENSAYO (la copia migrada con db:rehearse),
// para probar la versión nueva con los datos reales sin tocar producción.
//
//   npm run dev:rehearsal   (usa REHEARSAL_DB_NAME / REHEARSAL_DB_USER / REHEARSAL_DB_PASS del .env)
//
// Mails y Google Calendar quedan apagados: la copia tiene usuarios reales y no hay
// que mandarles recordatorios ni crearles eventos desde una prueba.
import 'dotenv/config';

const name = process.env.REHEARSAL_DB_NAME;
if (!name) {
  console.error('Falta REHEARSAL_DB_NAME en el .env (el nombre de la base de ensayo).');
  process.exit(1);
}
if (name === process.env.DB_NAME) {
  console.error('REHEARSAL_DB_NAME es igual a DB_NAME (producción). No se levanta.');
  process.exit(1);
}
process.env.DB_NAME = name;
for (const k of ['USER', 'PASS', 'HOST', 'PORT']) if (process.env[`REHEARSAL_DB_${k}`]) process.env[`DB_${k}`] = process.env[`REHEARSAL_DB_${k}`];
// Vacías (no borradas): así dotenv no las vuelve a cargar desde el .env.
for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'GOOGLE_CALENDAR_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY']) process.env[k] = '';
process.env.NODE_ENV = 'development';
process.env.DB_AUTO_MIGRATE = 'false';
process.env.FRONTEND_URL = process.env.REHEARSAL_FRONTEND_URL || 'http://localhost:5173';
process.env.PORT = process.env.REHEARSAL_PORT || '3000';
console.log(`[ensayo] API contra la base ${name} — mails y calendario apagados.`);
await import('../server.js');
