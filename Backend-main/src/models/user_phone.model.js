/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UserPhone = sequelize.define('UserPhone', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  numero: {
    type: DataTypes.STRING(20),
    allowNull: false
  }
}, {
  tableName: 'telefonos_usuario',
  timestamps: false
});

export default UserPhone;
