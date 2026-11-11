// Prepara una base VACÍA de prueba para las pruebas automáticas (CI o local).
// Borra y recrea todas las tablas, así que solo corre contra una base cuyo nombre
// termine en _test o _ci. Nunca contra producción.
import 'dotenv/config';
import bcrypt from 'bcrypt';

const name = process.env.DB_NAME || '';
if (!/_(test|ci)$/i.test(name) || process.env.NODE_ENV === 'production') {
  console.error(`[pruebas] DB_NAME="${name}": las pruebas solo corren contra una base que termine en _test o _ci.`);
  process.exit(1);
}

const { sequelize, User, Company, Contact, Province, Locality } = await import('../src/shared/models/index.js');
const { LATEST_MIGRATION } = await import('../src/shared/db/migrator.js');

await sequelize.query('SET FOREIGN_KEY_CHECKS=0');
await sequelize.sync({ force: true });
await sequelize.query('SET FOREIGN_KEY_CHECKS=1');
await sequelize.query(`CREATE TABLE IF NOT EXISTS migrations (
  name VARCHAR(190) NOT NULL PRIMARY KEY, description VARCHAR(255) NULL,
  executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, duration_ms INT NULL) ENGINE=InnoDB`);
await sequelize.query('INSERT IGNORE INTO migrations (name) VALUES (?)', { replacements: [LATEST_MIGRATION] });

export const PASSWORD = 'Prueba#2026';
const hash = await bcrypt.hash(PASSWORD, 4);
await User.bulkCreate([
  { idUser: 'admin1', fullName: 'Admin Prueba', role: 'administrador', accountStatus: 'Activo', passwordHash: hash },
  { idUser: 'vend1', fullName: 'Vendedor Uno', role: 'vendedor', accountStatus: 'Activo', passwordHash: hash },
  { idUser: 'vend2', fullName: 'Vendedor Dos', role: 'vendedor', accountStatus: 'Activo', passwordHash: hash },
]);
const p = await Province.create({ id: 82, name: 'Santa Fe' });
const l = await Locality.create({ id: '8208', name: 'Rosario', provinceId: p.id });
await Company.bulkCreate(Array.from({ length: 10 }, (_, i) => ({
  legalName: `Empresa ${i + 1}`, cuit: `30-${10000000 + i}-1`, companyType: 'Productor', localityId: l.id, createdById: 'admin1',
})));
await Contact.bulkCreate(Array.from({ length: 5 }, (_, i) => ({ fullName: `Contacto ${i + 1}`, companyId: 1 })));
console.log('[pruebas] Base de prueba lista.');
await sequelize.close();
