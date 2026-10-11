import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Provincia y Localidad toman el código oficial de georef (datos.gob.ar).
// Las localidades cargadas antes de la v2 tienen id sintético "cp-<código postal>".
export const Provincia = sequelize.define('Provincia', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
}, { tableName: 'provincias' });

export const Localidad = sequelize.define('Localidad', {
  id: { type: DataTypes.STRING(20), primaryKey: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  codigoPostal: { type: DataTypes.STRING(10), allowNull: true },
  latitud: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitud: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  provinciaId: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'localidades' });

// Zona asignada del vendedor (Usuario N:M Localidad)
export const UsuarioLocalidad = sequelize.define('UsuarioLocalidad', {
  usuarioId: { type: DataTypes.STRING(20), primaryKey: true },
  localidadId: { type: DataTypes.STRING(20), primaryKey: true },
}, { tableName: 'usuario_localidades' });
