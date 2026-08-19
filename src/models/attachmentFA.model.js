/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AttachmentFA = sequelize.define('AttachmentFA', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  filePath: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  formularioActividadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'formularios_actividad',
      key: 'idFormulario'
    }
  }
}, {
  tableName: 'archivos_adjuntos',
  timestamps: false
});

export default AttachmentFA;