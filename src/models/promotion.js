/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Promotion = sequelize.define('Promotion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  beneficio: {
    type: DataTypes.STRING(120),
    allowNull: true // ej. "15% OFF", "3 cuotas sin interés", "Oferta Exclusiva"
  },
  color: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  fechaInicio: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'fecha_inicio'
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  fechaFin: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'fecha_fin'
  },
  condiciones: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'promociones',
  timestamps: false
});

export default Promotion;