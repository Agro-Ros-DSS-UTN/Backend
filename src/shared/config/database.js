import fs from 'node:fs';
import { Sequelize } from 'sequelize';
import { env } from './env.js';

const buildSsl = () => {
  if (!env.db.ssl) return undefined;
  const ssl = { rejectUnauthorized: env.db.sslRejectUnauthorized };
  if (env.db.sslCa) {
    // DB_SSL_CA puede ser la ruta al .pem o el certificado pegado en una línea con \n
    ssl.ca = fs.existsSync(env.db.sslCa) ? fs.readFileSync(env.db.sslCa, 'utf8') : env.db.sslCa.replace(/\\n/g, '\n');
  }
  if (!ssl.rejectUnauthorized) {
    console.warn('[db] SSL sin verificación de certificado (DB_SSL_REJECT_UNAUTHORIZED=false). Cargá DB_SSL_CA para verificar el servidor.');
  }
  return ssl;
};

const ssl = buildSsl();

const sequelize = new Sequelize(env.db.name, env.db.user, env.db.pass, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'mysql',
  logging: env.db.logging ? console.log : false,
  // Todas las fechas y horas se guardan en UTC; el frontend las muestra en
  // America/Argentina/Buenos_Aires.
  timezone: '+00:00',
  dialectOptions: {
    ...(ssl ? { ssl } : {}),
    dateStrings: false,
    // Mantiene viva la conexión TCP aunque no haya consultas por un rato.
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  },
  // Quedan 2 conexiones abiertas siempre y las demás se cierran tras 1 minuto sin
  // uso. Antes se cerraban todas a los 10 s y el primer pedido al cambiar de
  // pantalla tenía que abrir una conexión cifrada nueva (0,1–0,4 s más).
  // Si el servidor de la base corta una conexión inactiva, Sequelize la descarta
  // al validarla y abre otra.
  pool: { max: 10, min: 2, idle: 60000, acquire: 30000, evict: 30000 },
  define: {
    timestamps: false,
    underscored: true,
    freezeTableName: true,
  },
});

export default sequelize;
