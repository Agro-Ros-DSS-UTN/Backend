/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Roadmap = sequelize.define('Roadmap', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  descripcion: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  fechaRuta: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  fechaNota: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  estado: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'planificada' // 'planificada' | 'en_curso' | 'finalizada'
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'hojas_ruta',
  timestamps: false
});

export default Roadmap;
