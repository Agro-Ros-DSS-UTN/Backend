/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FormularioActividad = sequelize.define('FormularioActividad', {
  idFormulario: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  tipoContacto: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  descripcion: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  montoVenta: {
    type: DataTypes.DECIMAL(10, 2), // Para representar el [0..1]
    allowNull: true
  },
  fechaHora: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'formularios_actividad',
  timestamps: false
});

export default FormularioActividad;