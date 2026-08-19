/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  idUser: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false,
    field: 'id_user'
  },
  nombreApellido: {
    type: DataTypes.STRING(150),
    allowNull: false,
    field: 'nombre_apellido'
  },
  direccionMail: {
    type: DataTypes.STRING(150),
    allowNull: true,
    field: 'direccion_mail'
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password'
  },
  accountStatement: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'account_statement'
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'role'
  }
}, 
{
  tableName: 'usuarios',
  timestamps: false,
  underscored: true
});

export default User;
