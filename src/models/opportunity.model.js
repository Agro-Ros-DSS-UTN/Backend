/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Opportunity = sequelize.define('Opportunity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  estado: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  potencialidadCliente: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  volumenPotencial: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  volumenFacturado: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  fechaInicio: {
    type: DataTypes.DATE,
    allowNull: false
  },
  fechaUltimaActualizacion: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'oportunidades',
  timestamps: false
});

export default Opportunity;