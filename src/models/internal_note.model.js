/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const InternalNote = sequelize.define('InternalNote', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  fechaNota: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  categoria: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'general' // 'despacho' | 'pedido' | 'general'
  },
  idUser: {
    type: DataTypes.STRING(20),
    allowNull: false
  }
}, {
  tableName: 'notas_internas',
  timestamps: false
});

export default InternalNote;
