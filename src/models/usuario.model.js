/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Usuario = sequelize.define('Usuario', {
  personaNumDoc: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
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

export default Usuario;