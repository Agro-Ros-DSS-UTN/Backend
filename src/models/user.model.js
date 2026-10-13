import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export const USER_ROLES = ['administrador', 'vendedor'];
export const ACCOUNT_STATUSES = ['Activo', 'Inactivo'];

// Usuario del sistema. El vendedor es un Usuario con rol "vendedor"; su zona
// de trabajo es el conjunto de Localidades asignadas (usuario_localidades).
const User = sequelize.define('User', {
  idUser: { type: DataTypes.STRING(20), primaryKey: true, field: 'id_user' },
  fullName: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: true, validate: { isEmail: true } },
  phone: { type: DataTypes.STRING(30), allowNull: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'vendedor', validate: { isIn: [USER_ROLES] } },
  accountStatus: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Activo', validate: { isIn: [ACCOUNT_STATUSES] } },
  profileImage: { type: DataTypes.TEXT('long'), allowNull: true },
  hireDate: { type: DataTypes.DATEONLY, allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  lastLoginAt: { type: DataTypes.DATE, allowNull: true },
  tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  // Derivado: años desde la fecha de ingreso.
  seniority: {
    type: DataTypes.VIRTUAL,
    get() {
      const f = this.getDataValue('hireDate');
      if (!f) return null;
      return Math.max(0, Math.floor((Date.now() - new Date(f).getTime()) / (365.25 * 86400000)));
    },
  },
}, {
  tableName: 'users',
  defaultScope: { attributes: { exclude: ['passwordHash', 'profileImage', 'tokenVersion'] } },
  scopes: {
    auth: { attributes: { include: ['passwordHash', 'tokenVersion'] } },
    withImage: { attributes: { exclude: ['passwordHash', 'tokenVersion'] } },
  },
});

export default User;
