import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Persona = sequelize.define('Persona', {
  numDoc: {
    type: DataTypes.STRING(20),
    primaryKey: true, // Usamos numDoc como clave primaria según tu diagrama
    allowNull: false
  },
  nombreApellido: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  direccionMail: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  telefono: {
    type: DataTypes.STRING(20),
    allowNull: true
  }
}, {
  tableName: 'personas',
  timestamps: false // Desactívalo o cámbialo a true si quieres que guarde createdAt/updatedAt
});

export default Persona;