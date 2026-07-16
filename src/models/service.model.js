/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const service = sequelize.define('Service', {
  tipoServicio: {
    type: DataTypes.STRING(100),
    primaryKey: false,
        allowNull: false

  },
  desc: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'service',
  timestamps: false
});

export default service;
