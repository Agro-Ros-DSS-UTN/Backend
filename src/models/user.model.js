/* eslint-disable */
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  idUser: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    allowNull: false
  },
  nombreApellido: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  direccionMail: {
    type: DataTypes.STRING(150),
    allowNull: true

  },
  password: {
  type: DataTypes.STRING(255),
  allowNull: false
},
accountStatement : {
  type: DataTypes.STRING(50),
  allowNull: false,

},
role: {
  type: DataTypes.STRING(50),
  allowNull: false,
}
}, 
{
  tableName: 'usuarios',
  timestamps: false
});

export default User;
