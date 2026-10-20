import { DataTypes } from 'sequelize';
import sequelize from '../../shared/config/database.js';

// Teléfonos de un contacto. Tabla de detalle: la maneja el repository de contactos.
export const ContactPhone = sequelize.define('ContactPhone', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contactId: { type: DataTypes.INTEGER, allowNull: false },
  number: { type: DataTypes.STRING(30), allowNull: false },
}, { tableName: 'contact_phones' });
