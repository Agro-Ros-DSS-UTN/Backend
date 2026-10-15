import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { env, assertServerEnv } from './src/shared/config/env.js';
import { sequelize } from './src/shared/models/index.js';
import routes from './src/shared/routes/index.js';
import { authenticateAll } from './src/shared/middlewares/auth.middleware.js';
import { securityHeaders, apiLimiter } from './src/shared/middlewares/security.middleware.js';
import { errorHandler, notFoundHandler } from './src/shared/middlewares/errorHandler.middleware.js';
import { pendingMigrations, runMigrations } from './src/shared/db/migrator.js';
import { runTaskReminderSweep } from './src/modules/planning/taskReminders.job.js';

assertServerEnv();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', /^\d+$/.test(String(env.trustProxy)) ? Number(env.trustProxy) : env.trustProxy === 'true');

app.use(securityHeaders);
app.use(cors({
  origin(origin, cb) {
    // Sin Origin: llamadas del mismo servidor, curl o apps nativas (igual pasan por el token).
    if (!origin || env.frontendOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));
app.use(express.json({ limit: env.bodyLimit }));
app.use(apiLimiter);

// La raíz responde sin sesión, para que abrir la dirección de la API en el
// navegador muestre que está andando en vez de un error de token.
app.get('/', (req, res) => {
  res.json({ name: 'API CRM AgroRos', status: 'ok', health: '/api/health' });
});

app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

app.use(authenticateAll);
app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

const start = async () => {
  try {
    await sequelize.authenticate();
  } catch (error) {
    console.error('[db] No se pudo conectar a MySQL:', error.original?.code || error.message);
    process.exit(1);
  }

  // El esquema lo manejan las migraciones (src/db/migrations), nunca sequelize.sync().
  const pending = await pendingMigrations(sequelize);
  if (pending.length) {
    if (env.autoMigrate) {
      console.log(`[db] Aplicando ${pending.length} migraciones pendientes…`);
      await runMigrations(sequelize, { log: (m) => console.log(`[db] ${m}`) });
    } else {
      console.error(`[db] Hay ${pending.length} migraciones pendientes (${pending.map((m) => m.name).join(', ')}).`);
      console.error('[db] Ejecutá "npm run db:migrate" desde la PC (con un respaldo previo).');
      process.exit(1);
    }
  }

  app.listen(env.port, () => console.log(`API CRM AgroRos en el puerto ${env.port}`));

  // Recordatorios de tareas (mail 48 h / 24 h antes). Nunca tira abajo el servidor.
  const sweep = () => runTaskReminderSweep().catch((err) => console.error('[taskReminders]', err.message));
  sweep();
  cron.schedule('*/30 * * * *', sweep);
};

start().catch((err) => {
  console.error("[arranque] Error:", err);
  process.exit(1);
});
