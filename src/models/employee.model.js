/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Empleados operativos (aplicadores / operarios). No tienen rol en el sistema,
// pero se registran sus datos para asignarlos a las órdenes de servicio.
const Employee = sequelize.define('Employee', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombreApellido: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  dni: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  matricula: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  puesto: {
    type: DataTypes.STRING(100),
    allowNull: true // 'Técnico Aplicador' | 'Operario' | 'Ayudante' | ...
  },
  telefono: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  empresa: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  fechaIngreso: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  profileImage: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    defaultValue: null
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fechaCreacion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'empleados',
  timestamps: false
});

export default Employee;
