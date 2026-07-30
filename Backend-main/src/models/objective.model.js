/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Objective = sequelize.define('Objective', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  descripcion: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  tipoObjetivo: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  periodoSemana: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  cantidadMeta: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  }
}, {
  tableName: 'objetivos',
  timestamps: false
});

export default Objective;