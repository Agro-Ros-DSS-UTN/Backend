import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export const ROLES_EMPLEADO = ['tecnico', 'ayudante', 'chofer', 'administrativo'];
export const ESTADOS_ORDEN = ['Programada', 'En Ejecución', 'Completada', 'Cancelada'];
export const RESULTADOS_EVALUACION = ['Sin insectos vivos', 'Con insectos vivos', 'Seguimiento', 'Refumigación'];

// Eficacia derivada del resultado de la planilla (para el tablero por empresa).
export const eficaciaDe = (resultado) => {
  if (resultado === 'Sin insectos vivos') return 'eficaz';
  if (resultado === 'Seguimiento') return 'parcial';
  if (resultado) return 'ineficaz';
  return null;
};

// Personal operativo: no ingresa al sistema, figura en las órdenes. Solo el rol
// "tecnico" puede ejecutar una orden de servicio.
export const Empleado = sequelize.define('Empleado', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombreApellido: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: true } },
  dni: { type: DataTypes.STRING(30), allowNull: true },
  matricula: { type: DataTypes.STRING(50), allowNull: true },
  rol: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ayudante', validate: { isIn: [ROLES_EMPLEADO] } },
  puesto: { type: DataTypes.STRING(100), allowNull: true },
  telefono: { type: DataTypes.STRING(50), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true },
  empresa: { type: DataTypes.STRING(150), allowNull: true },
  fechaIngreso: { type: DataTypes.DATEONLY, allowNull: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  profileImage: { type: DataTypes.TEXT('long'), allowNull: true },
  observaciones: { type: DataTypes.TEXT, allowNull: true },
  fechaCreacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'empleados' });

export const OrdenServicio = sequelize.define('OrdenServicio', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  numeroOrden: { type: DataTypes.STRING(50), allowNull: false, validate: { notEmpty: true } },
  empresaId: { type: DataTypes.INTEGER, allowNull: true },
  servicioId: { type: DataTypes.INTEGER, allowNull: true },
  oportunidadId: { type: DataTypes.INTEGER, allowNull: true },
  fechaProgramada: { type: DataTypes.DATEONLY, allowNull: false },
  fechaRealizada: { type: DataTypes.DATEONLY, allowNull: true },
  estado: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Programada', validate: { isIn: [ESTADOS_ORDEN] } },
  // Datos del acta impresa (se conservan tal como figuran en la planilla)
  clienteId: { type: DataTypes.STRING(50), allowNull: true },
  clienteNombre: { type: DataTypes.STRING(150), allowNull: false },
  centroId: { type: DataTypes.STRING(50), allowNull: true },
  centroNombre: { type: DataTypes.STRING(150), allowNull: true },
  plantaId: { type: DataTypes.STRING(50), allowNull: true },
  plantaNombre: { type: DataTypes.STRING(150), allowNull: true },
  silo: { type: DataTypes.STRING(200), allowNull: true },
  direccion: { type: DataTypes.STRING(255), allowNull: true },
  localidad: { type: DataTypes.STRING(100), allowNull: true },
  provincia: { type: DataTypes.STRING(100), allowNull: true },
  tipoTrabajo: { type: DataTypes.STRING(100), allowNull: false },
  observaciones: { type: DataTypes.TEXT, allowNull: true },
  recomendaciones: { type: DataTypes.TEXT, allowNull: true },
  firmaTecnico: { type: DataTypes.TEXT('long'), allowNull: true },
  firmaCliente: { type: DataTypes.TEXT('long'), allowNull: true },
  imagenOrdenOriginal: { type: DataTypes.TEXT('long'), allowNull: true },
  creadoPorId: { type: DataTypes.STRING(20), allowNull: true },
  fechaCreacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'ordenes_servicio', timestamps: true, createdAt: false, updatedAt: false, paranoid: true, deletedAt: 'fechaBaja' });

export const OrdenEmpleado = sequelize.define('OrdenEmpleado', {
  ordenServicioId: { type: DataTypes.INTEGER, primaryKey: true },
  empleadoId: { type: DataTypes.INTEGER, primaryKey: true },
}, { tableName: 'orden_empleados' });

// Una fila del "Detalle del servicio" de la planilla: instalación + producto aplicado.
export const ProductoAplicado = sequelize.define('ProductoAplicado', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ordenServicioId: { type: DataTypes.INTEGER, allowNull: false },
  itemId: { type: DataTypes.INTEGER, allowNull: true },
  tipoInstalacion: { type: DataTypes.STRING(40), allowNull: true },
  numero: { type: DataTypes.STRING(20), allowNull: true },
  capacidadTn: { type: DataTypes.STRING(20), allowNull: true },
  grano: { type: DataTypes.STRING(60), allowNull: true },
  cantidadTn: { type: DataTypes.STRING(20), allowNull: true },
  estadoCereal: { type: DataTypes.STRING(10), allowNull: true },
  estadoInstalaciones: { type: DataTypes.STRING(10), allowNull: true },
  estadoInfestacion: { type: DataTypes.STRING(10), allowNull: true },
  producto: { type: DataTypes.STRING(150), allowNull: true },
  principioActivo: { type: DataTypes.STRING(150), allowNull: true },
  dosis: { type: DataTypes.STRING(100), allowNull: true },
  lote: { type: DataTypes.STRING(100), allowNull: true },
  tiempoCarencia: { type: DataTypes.STRING(100), allowNull: true },
  cantidadTotal: { type: DataTypes.STRING(100), allowNull: true },
}, { tableName: 'productos_aplicados' });

export const EvaluacionServicio = sequelize.define('EvaluacionServicio', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ordenServicioId: { type: DataTypes.INTEGER, allowNull: false },
  fechaEvaluacion: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  estadoCereal: { type: DataTypes.STRING(5), allowNull: false, defaultValue: 'A' },
  lugarToma: { type: DataTypes.STRING(150), allowNull: false, defaultValue: 'Superficie' },
  resultado: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Sin insectos vivos', validate: { isIn: [RESULTADOS_EVALUACION] } },
  ppmPH3: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'ppm_ph3' },
  observaciones: { type: DataTypes.TEXT, allowNull: true },
  recomendaciones: { type: DataTypes.TEXT, allowNull: true },
  detalle: { type: DataTypes.TEXT('long'), allowNull: true },
  fotos: { type: DataTypes.TEXT('long'), allowNull: true },
  firmaCliente: { type: DataTypes.TEXT('long'), allowNull: true },
  firmaTecnico: { type: DataTypes.TEXT('long'), allowNull: true },
  satisfaccionCliente: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1, max: 5 } },
  comentarioCliente: { type: DataTypes.TEXT, allowNull: true },
  eficacia: { type: DataTypes.VIRTUAL, get() { return eficaciaDe(this.getDataValue('resultado')); } },
}, { tableName: 'evaluaciones_servicio' });
