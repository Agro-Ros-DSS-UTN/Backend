/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  numDoc: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  nombreApellido: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  direccionMail: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  antiguedad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  direccion: {
    type: DataTypes.STRING(150),
    allowNull: false
  }
}, {
  tableName: 'usuarios',
  timestamps: false
});

export default User;
