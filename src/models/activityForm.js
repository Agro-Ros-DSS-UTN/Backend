/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FormularioActividad = sequelize.define('FormularioActividad', {
  idFormulario: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
    field: 'id_formulario'
  },
  tipoContacto: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'tipo_contacto'
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'descripcion'
  },
  montoVenta: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'monto_venta'
  },
  fechaHora: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
    field: 'fecha_hora'
  },
  opportunityId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'opportunity_id'
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'seller_id'
  },
  archivoAdjunto: {
    type: DataTypes.TEXT('medium'),
    allowNull: true,
    field: 'archivo_adjunto'
  },
  autorNombre: {
    type: DataTypes.STRING(150),
    allowNull: true,
    field: 'autor_nombre'
  }
}, {
  tableName: 'formularios_actividad',
  timestamps: false,
  underscored: true
});

export default FormularioActividad;