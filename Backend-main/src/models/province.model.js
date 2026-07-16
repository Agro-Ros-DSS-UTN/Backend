/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Province = sequelize.define('Province', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nomProvincia: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'provincias',
  timestamps: false
});

export default Province;
