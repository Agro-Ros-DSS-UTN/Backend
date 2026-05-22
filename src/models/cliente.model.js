import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Cliente = sequelize.define('Cliente', {
  // Compartirá el numDoc de Persona como Clave Primaria y Foránea a la vez (Herencia)
  personaNumDoc: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  tipoCliente: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  codigoPostal: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  nota: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fechaAgregado: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'clientes',
  timestamps: false
});

export default Cliente;