#!/usr/bin/env node
// Crea (o reactiva) un usuario administrador. Útil en una base nueva o si se
// pierde el acceso. La contraseña se pide por consola (no queda en el historial).
//   node scripts/create-admin.mjs <idUser> "<Nombre y apellido>"
import readline from 'node:readline';
import bcrypt from 'bcrypt';
import sequelize from '../src/config/database.js';
import { User } from '../src/models/index.js';
import { validatePassword } from '../src/controllers/user.controller.js';

const [idUser, name] = process.argv.slice(2);
if (!idUser || !name) {
  console.error('Uso: node scripts/create-admin.mjs <idUser> "<Nombre y apellido>"');
  process.exit(1);
}
const ask = (q) => new Promise((resolve) => {
  if (process.env.ADMIN_PASSWORD) return resolve(process.env.ADMIN_PASSWORD);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl.stdoutMuted = true;
  rl._writeToOutput = (s) => rl.output.write(rl.stdoutMuted && !s.startsWith(q) ? '*' : s);
  rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
});
try {
  const password = validatePassword(await ask('Contraseña (8 a 64 caracteres, con mayúscula, número y símbolo): '));
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.scope('auth').findByPk(idUser);
  if (existing) {
    await existing.update({ passwordHash, role: 'administrador', accountStatus: 'Activo', tokenVersion: existing.tokenVersion + 1 });
    console.log(`Usuario ${idUser} actualizado como administrador activo.`);
  } else {
    await User.create({ idUser, fullName: name, passwordHash, role: 'administrador', accountStatus: 'Activo' });
    console.log(`Administrador ${idUser} creado.`);
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
