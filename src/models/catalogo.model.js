import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export const CATEGORIAS_LINEA = ['insecticida', 'fumigante', 'rodenticida', 'fertilizante', 'otro'];
export const TIPOS_SERVICIO = ['fumigacionSilo', 'silobolsa', 'contenedor', 'buque', 'plagasUrbanas', 'monitoreo', 'otro'];

export const LineaProducto = sequelize.define('LineaProducto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo: { type: DataTypes.STRING(30), allowNull: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false, validate: { notEmpty: true } },
  categoria: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'otro', validate: { isIn: [CATEGORIAS_LINEA] } },
}, { tableName: 'lineas_producto' });

// ItemCatalogo (abstracta) con herencia en una sola tabla: `tipo` decide si la
// fila es un Producto o un Servicio. Los scopes `productos` y `servicios`
// representan las dos subclases.
export const ItemCatalogo = sequelize.define('ItemCatalogo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipo: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['producto', 'servicio']] } },
  nombre: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  codigo: { type: DataTypes.STRING(50), allowNull: true },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  precioReferencia: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  costoUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  frecuenciaFacturacion: { type: DataTypes.STRING(50), allowNull: true },
  stockDisponible: { type: DataTypes.INTEGER, allowNull: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  imagen: { type: DataTypes.TEXT('long'), allowNull: true },
  // Producto
  lineaId: { type: DataTypes.INTEGER, allowNull: true },
  principioActivo: { type: DataTypes.STRING(150), allowNull: true },
  presentacion: { type: DataTypes.STRING(100), allowNull: true },
  // Servicio
  tipoServicio: { type: DataTypes.STRING(30), allowNull: true, validate: { isIn: [TIPOS_SERVICIO] } },
  unidadMedida: { type: DataTypes.STRING(30), allowNull: true },
  fechaAlta: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'items_catalogo',
  defaultScope: { attributes: { exclude: ['imagen'] } },
  scopes: {
    conImagen: {},
    productos: { where: { tipo: 'producto' } },
    servicios: { where: { tipo: 'servicio' } },
    activos: { where: { activo: true } },
  },
});
