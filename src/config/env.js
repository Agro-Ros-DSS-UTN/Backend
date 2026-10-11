import 'dotenv/config';

// Configuración centralizada y validada al arrancar.
// Si falta algo crítico (por ejemplo JWT_SECRET) el servidor NO arranca:
// es preferible un error claro en el deploy a un backend que firma tokens
// con una clave conocida.

const isProd = process.env.NODE_ENV === 'production';

const fail = (msg) => {
  console.error(`\n[config] ${msg}\n`);
  process.exit(1);
};

const required = (name) => {
  const value = process.env[name];
  if (value === undefined || value === '') fail(`Falta la variable de entorno ${name}.`);
  return value;
};

const bool = (name, def) => {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'si', 'sí', 'yes'].includes(String(v).toLowerCase());
};

const list = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const jwtSecret = process.env.JWT_SECRET || '';

// Solo el servidor HTTP necesita la clave de firma; los scripts de base de datos no.
export const assertServerEnv = () => {
  if (!jwtSecret) fail('Falta la variable de entorno JWT_SECRET.');
  if (jwtSecret.length < 32) {
    fail('JWT_SECRET es demasiado corto: usá al menos 32 caracteres aleatorios (por ejemplo: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))").');
  }
};

export const env = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  frontendOrigins: list(process.env.FRONTEND_URL || 'http://localhost:5173'),
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    // Sesión larga ("mantener sesión iniciada" en el celular del vendedor)
    longExpiresIn: process.env.JWT_LONG_EXPIRES_IN || '7d',
    issuer: 'crm-agroros',
    audience: 'crm-agroros-web',
  },
  db: {
    name: required('DB_NAME'),
    user: required('DB_USER'),
    pass: process.env.DB_PASS || '',
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT) || 3306,
    ssl: bool('DB_SSL', true),
    sslCa: process.env.DB_SSL_CA || '',
    // Sin certificado de la CA no se puede verificar el servidor. Se mantiene
    // compatible con la configuración actual, pero se avisa en el log.
    sslRejectUnauthorized: bool('DB_SSL_REJECT_UNAUTHORIZED', Boolean(process.env.DB_SSL_CA)),
    logging: bool('DB_LOGGING', false),
  },
  // Aplicar migraciones pendientes al arrancar. Apagado por defecto: se
  // ejecutan a mano (npm run db:migrate) después de un respaldo. Si quedan
  // pendientes, el servidor no arranca (evita correr código v2 sobre datos v1).
  autoMigrate: bool('DB_AUTO_MIGRATE', false),
  bodyLimit: process.env.BODY_LIMIT || '15mb',
  // Para que el rate limit vea la IP real detrás del proxy de Hostinger.
  trustProxy: process.env.TRUST_PROXY ?? (isProd ? '1' : 'false'),
};
