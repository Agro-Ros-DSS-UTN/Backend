// Modelo de dominio v2 (ver docs/DiagramaMD-DSS-v2.1.drawio).
// Las reglas ON DELETE de la base las define la migración 0009; acá se declaran
// las asociaciones con `constraints: false` para que Sequelize nunca intente
// crear o alterar FKs por su cuenta.
import sequelize from '../config/database.js';
import Usuario from './usuario.model.js';
import { Provincia, Localidad, UsuarioLocalidad } from './territorio.model.js';
import { Empresa, Cultivo, EmpresaCultivo, Contacto, ContactoTelefono } from './empresa.model.js';
import { LineaProducto, ItemCatalogo } from './catalogo.model.js';
import { Oportunidad, OportunidadItem, Actividad, Adjunto, Tarea, TareaAsignado } from './comercial.model.js';
import {
  HojaRuta, ParadaRuta, Objetivo, ObjetivoEmpresa, ObjetivoItem, ObjetivoPromocion,
  Promocion, PromocionItem, NotaInterna, Notificacion,
} from './planificacion.model.js';
import { Empleado, OrdenServicio, OrdenEmpleado, ProductoAplicado, EvaluacionServicio } from './servicios.model.js';

const nc = { constraints: false };

// ── Territorio ──
Provincia.hasMany(Localidad, { foreignKey: 'provinciaId', as: 'localidades', ...nc });
Localidad.belongsTo(Provincia, { foreignKey: 'provinciaId', as: 'provincia', ...nc });
Usuario.belongsToMany(Localidad, { through: UsuarioLocalidad, foreignKey: 'usuarioId', otherKey: 'localidadId', as: 'zona', ...nc });
Localidad.belongsToMany(Usuario, { through: UsuarioLocalidad, foreignKey: 'localidadId', otherKey: 'usuarioId', as: 'vendedores', ...nc });

// ── Empresas y contactos ──
Localidad.hasMany(Empresa, { foreignKey: 'localidadId', as: 'empresas', ...nc });
Empresa.belongsTo(Localidad, { foreignKey: 'localidadId', as: 'localidad', ...nc });
Empresa.hasMany(Empresa, { foreignKey: 'empresaPadreId', as: 'sucursales', ...nc });
Empresa.belongsTo(Empresa, { foreignKey: 'empresaPadreId', as: 'empresaPadre', ...nc });
Empresa.belongsTo(Usuario, { foreignKey: 'creadoPorId', as: 'creadoPor', ...nc });
Empresa.belongsToMany(Cultivo, { through: EmpresaCultivo, foreignKey: 'empresaId', otherKey: 'cultivoId', as: 'cultivos', ...nc });
Cultivo.belongsToMany(Empresa, { through: EmpresaCultivo, foreignKey: 'cultivoId', otherKey: 'empresaId', as: 'empresas', ...nc });
Empresa.hasMany(Contacto, { foreignKey: 'empresaId', as: 'contactos', ...nc });
Contacto.belongsTo(Empresa, { foreignKey: 'empresaId', as: 'empresa', ...nc });
Contacto.hasMany(ContactoTelefono, { foreignKey: 'contactoId', as: 'telefonos', ...nc });
ContactoTelefono.belongsTo(Contacto, { foreignKey: 'contactoId', ...nc });

// ── Catálogo ──
LineaProducto.hasMany(ItemCatalogo, { foreignKey: 'lineaId', as: 'items', ...nc });
ItemCatalogo.belongsTo(LineaProducto, { foreignKey: 'lineaId', as: 'linea', ...nc });

// ── Gestión comercial ──
Empresa.hasMany(Oportunidad, { foreignKey: 'empresaId', as: 'oportunidades', ...nc });
Oportunidad.belongsTo(Empresa, { foreignKey: 'empresaId', as: 'empresa', ...nc });
Oportunidad.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'responsable', ...nc });
Usuario.hasMany(Oportunidad, { foreignKey: 'usuarioId', as: 'oportunidades', ...nc });
Oportunidad.belongsTo(Contacto, { foreignKey: 'contactoId', as: 'contacto', ...nc });
Oportunidad.belongsToMany(ItemCatalogo, { through: OportunidadItem, foreignKey: 'oportunidadId', otherKey: 'itemId', as: 'items', ...nc });
ItemCatalogo.belongsToMany(Oportunidad, { through: OportunidadItem, foreignKey: 'itemId', otherKey: 'oportunidadId', as: 'oportunidades', ...nc });

Oportunidad.hasMany(Actividad, { foreignKey: 'oportunidadId', as: 'actividades', ...nc });
Actividad.belongsTo(Oportunidad, { foreignKey: 'oportunidadId', as: 'oportunidad', ...nc });
Actividad.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'autor', ...nc });
Usuario.hasMany(Actividad, { foreignKey: 'usuarioId', as: 'actividades', ...nc });
Actividad.hasMany(Adjunto, { foreignKey: 'actividadId', as: 'adjuntos', ...nc });
Adjunto.belongsTo(Actividad, { foreignKey: 'actividadId', as: 'actividad', ...nc });
Actividad.hasMany(Tarea, { foreignKey: 'actividadId', as: 'tareas', ...nc });
Tarea.belongsTo(Actividad, { foreignKey: 'actividadId', as: 'actividad', ...nc });

Tarea.belongsTo(Empresa, { foreignKey: 'empresaId', as: 'empresa', ...nc });
Tarea.belongsTo(Contacto, { foreignKey: 'contactoId', as: 'contacto', ...nc });
Tarea.belongsTo(Usuario, { foreignKey: 'creadoPorId', as: 'creadoPor', ...nc });
Tarea.belongsTo(Usuario, { foreignKey: 'finalizadoPorId', as: 'finalizadoPor', ...nc });
Tarea.hasMany(TareaAsignado, { foreignKey: 'tareaId', as: 'asignaciones', ...nc });
TareaAsignado.belongsTo(Tarea, { foreignKey: 'tareaId', as: 'tarea', ...nc });
TareaAsignado.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario', ...nc });
Usuario.hasMany(TareaAsignado, { foreignKey: 'usuarioId', as: 'asignaciones', ...nc });

// ── Planificación ──
HojaRuta.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'asignado', ...nc });
HojaRuta.belongsTo(Usuario, { foreignKey: 'creadoPorId', as: 'creadoPor', ...nc });
HojaRuta.hasMany(ParadaRuta, { foreignKey: 'hojaRutaId', as: 'paradas', ...nc });
ParadaRuta.belongsTo(HojaRuta, { foreignKey: 'hojaRutaId', as: 'hojaRuta', ...nc });
ParadaRuta.belongsTo(Empresa, { foreignKey: 'empresaId', as: 'empresa', ...nc });
ParadaRuta.hasOne(Actividad, { foreignKey: 'paradaId', as: 'actividad', ...nc });
Actividad.belongsTo(ParadaRuta, { foreignKey: 'paradaId', as: 'parada', ...nc });

Objetivo.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'vendedor', ...nc });
Objetivo.belongsTo(Usuario, { foreignKey: 'creadoPorId', as: 'creadoPor', ...nc });
Usuario.hasMany(Objetivo, { foreignKey: 'usuarioId', as: 'objetivos', ...nc });
Objetivo.belongsToMany(Empresa, { through: ObjetivoEmpresa, foreignKey: 'objetivoId', otherKey: 'empresaId', as: 'empresas', ...nc });
Empresa.belongsToMany(Objetivo, { through: ObjetivoEmpresa, foreignKey: 'empresaId', otherKey: 'objetivoId', as: 'objetivos', ...nc });
Objetivo.belongsToMany(ItemCatalogo, { through: ObjetivoItem, foreignKey: 'objetivoId', otherKey: 'itemId', as: 'items', ...nc });
Objetivo.belongsToMany(Promocion, { through: ObjetivoPromocion, foreignKey: 'objetivoId', otherKey: 'promocionId', as: 'promociones', ...nc });
Promocion.belongsToMany(Objetivo, { through: ObjetivoPromocion, foreignKey: 'promocionId', otherKey: 'objetivoId', as: 'objetivos', ...nc });
Promocion.belongsToMany(ItemCatalogo, { through: PromocionItem, foreignKey: 'promocionId', otherKey: 'itemId', as: 'items', ...nc });
ItemCatalogo.belongsToMany(Promocion, { through: PromocionItem, foreignKey: 'itemId', otherKey: 'promocionId', as: 'promociones', ...nc });

NotaInterna.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'autor', ...nc });
Notificacion.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario', ...nc });

// ── Servicios de control de plagas ──
Empresa.hasMany(OrdenServicio, { foreignKey: 'empresaId', as: 'ordenesServicio', ...nc });
OrdenServicio.belongsTo(Empresa, { foreignKey: 'empresaId', as: 'empresa', ...nc });
OrdenServicio.belongsTo(ItemCatalogo, { foreignKey: 'servicioId', as: 'servicio', ...nc });
OrdenServicio.belongsTo(Oportunidad, { foreignKey: 'oportunidadId', as: 'oportunidad', ...nc });
Oportunidad.hasMany(OrdenServicio, { foreignKey: 'oportunidadId', as: 'ordenesServicio', ...nc });
OrdenServicio.belongsTo(Usuario, { foreignKey: 'creadoPorId', as: 'creadoPor', ...nc });
OrdenServicio.belongsToMany(Empleado, { through: OrdenEmpleado, foreignKey: 'ordenServicioId', otherKey: 'empleadoId', as: 'tecnicos', ...nc });
Empleado.belongsToMany(OrdenServicio, { through: OrdenEmpleado, foreignKey: 'empleadoId', otherKey: 'ordenServicioId', as: 'ordenes', ...nc });
OrdenServicio.hasMany(ProductoAplicado, { foreignKey: 'ordenServicioId', as: 'productosAplicados', ...nc });
ProductoAplicado.belongsTo(OrdenServicio, { foreignKey: 'ordenServicioId', ...nc });
ProductoAplicado.belongsTo(ItemCatalogo, { foreignKey: 'itemId', as: 'item', ...nc });
OrdenServicio.hasOne(EvaluacionServicio, { foreignKey: 'ordenServicioId', as: 'evaluacion', ...nc });
EvaluacionServicio.belongsTo(OrdenServicio, { foreignKey: 'ordenServicioId', ...nc });
OrdenServicio.hasMany(Actividad, { foreignKey: 'ordenServicioId', as: 'visitasTecnicas', ...nc });
Actividad.belongsTo(OrdenServicio, { foreignKey: 'ordenServicioId', as: 'ordenServicio', ...nc });
OrdenServicio.hasMany(Adjunto, { foreignKey: 'ordenServicioId', as: 'adjuntos', ...nc });
Adjunto.belongsTo(OrdenServicio, { foreignKey: 'ordenServicioId', as: 'ordenServicio', ...nc });

export {
  sequelize,
  Usuario, Provincia, Localidad, UsuarioLocalidad,
  Empresa, Cultivo, EmpresaCultivo, Contacto, ContactoTelefono,
  LineaProducto, ItemCatalogo,
  Oportunidad, OportunidadItem, Actividad, Adjunto, Tarea, TareaAsignado,
  HojaRuta, ParadaRuta, Objetivo, ObjetivoEmpresa, ObjetivoItem, ObjetivoPromocion,
  Promocion, PromocionItem, NotaInterna, Notificacion,
  Empleado, OrdenServicio, OrdenEmpleado, ProductoAplicado, EvaluacionServicio,
};
