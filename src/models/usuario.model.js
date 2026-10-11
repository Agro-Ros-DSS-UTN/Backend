import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export const ROLES_USUARIO = ['administrador', 'vendedor'];
export const ESTADOS_CUENTA = ['Activo', 'Inactivo'];

// Usuario del sistema. El vendedor es un Usuario con rol "vendedor"; su zona
// de trabajo es el conjunto de Localidades asignadas (usuario_localidades).
const Usuario = sequelize.define('Usuario', {
  idUser: { type: DataTypes.STRING(20), primaryKey: true, field: 'id_user' },
  nombreApellido: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: true, validate: { isEmail: true } },
  telefono: { type: DataTypes.STRING(30), allowNull: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false },
  rol: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'vendedor', validate: { isIn: [ROLES_USUARIO] } },
  estadoCuenta: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Activo', validate: { isIn: [ESTADOS_CUENTA] } },
  profileImage: { type: DataTypes.TEXT('long'), allowNull: true },
  fechaIngreso: { type: DataTypes.DATEONLY, allowNull: true },
  fechaAlta: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  ultimoAcceso: { type: DataTypes.DATE, allowNull: true },
  tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  // Derivado: años desde la fecha de ingreso.
  antiguedad: {
    type: DataTypes.VIRTUAL,
    get() {
      const f = this.getDataValue('fechaIngreso');
      if (!f) return null;
      return Math.max(0, Math.floor((Date.now() - new Date(f).getTime()) / (365.25 * 86400000)));
    },
  },
}, {
  tableName: 'usuarios',
  defaultScope: { attributes: { exclude: ['passwordHash', 'profileImage', 'tokenVersion'] } },
  scopes: {
    auth: { attributes: { include: ['passwordHash', 'tokenVersion'] } },
    conImagen: { attributes: { exclude: ['passwordHash', 'tokenVersion'] } },
  },
});

export default Usuario;
