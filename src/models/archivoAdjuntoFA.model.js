import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const formularioActividad_archivoadjunto = sequelize.define('ArchivoAdjunto', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  rutaArchivo: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'archivos_adjuntos',
  timestamps: false
});

export default formularioActividad_archivoadjunto;