/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Locality = sequelize.define('Locality', {
  codPostal: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  nomLocalidad: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'localidades',
  timestamps: false
});

export default Locality;