import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Zona asignada del vendedor (Usuario N:M Localidad). Tabla intermedia: la maneja
// el repository de usuarios.
export const UserLocality = sequelize.define('UserLocality', {
  userId: { type: DataTypes.STRING(20), primaryKey: true },
  localityId: { type: DataTypes.STRING(20), primaryKey: true },
}, { tableName: 'user_localities' });
