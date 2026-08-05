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
  fechaInicio: {
    type: DataTypes.DATE,
    allowNull: false
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: true
},
fechaFin: {
    type: DataTypes.DATE,
    allowNull: false
  },
condiciones: {
    type: DataTypes.STRING(255),
    allowNull: true
  },    
  
},{

  tableName: 'promociones',
  timestamps: false
});

export default Promotion;
