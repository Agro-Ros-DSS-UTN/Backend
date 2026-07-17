/* eslint-disable */
import sequelize from '../config/database.js';
import Client from './client.model.js';
import User from './user.model.js';
import ClientPhone from './client_phone.model.js';
import UserPhone from './user_phone.model.js';
import ClientCompany from './client_company.model.js';
import Locality from './locality.model.js';
import Province from './province.model.js';
import TypeProduct from './type_product.model.js';
import ProductLine from './product_line.model.js';
import CultivationType from './cultivation_type.model.js';
import Seller from './seller.model.js';
import FormularioActividad from './formularioActividad.model.js';
import Opportunity from './opportunity.model.js';
import Objective from './objective.model.js';
import service from './service.model.js';
import ArchivoAdjunto from './archivoAdjuntoFA.model.js';
import lineaProd from './lineaProd.model.js';

// Relación Cliente -> Telefonos (1..n)
Client.hasMany(ClientPhone, { foreignKey: 'clientNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ClientPhone.belongsTo(Client, { foreignKey: 'clientNumDoc' });

// Relación Usuario -> Telefonos (1..n)
User.hasMany(UserPhone, { foreignKey: 'userNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
UserPhone.belongsTo(User, { foreignKey: 'userNumDoc' });

// Relación Cliente -> EmpresaCliente (1..1)
Client.hasOne(ClientCompany, { foreignKey: 'clientNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ClientCompany.belongsTo(Client, { foreignKey: 'clientNumDoc' });

// Relación Provincia -> Localidad (1..n)
Province.hasMany(Locality, { foreignKey: 'provinceId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Locality.belongsTo(Province, { foreignKey: 'provinceId' });

// Relación Localidad -> EmpresaCliente (1..1)
Locality.hasMany(ClientCompany, { foreignKey: 'localityCodPostal', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ClientCompany.belongsTo(Locality, { foreignKey: 'localityCodPostal' });

//Relacion FormularioActividad atributo ArchivosAdjuntos
FormularioActividad.hasMany(ArchivoAdjunto, {
  foreignKey: 'formularioActividadId',
  as: 'archivos' // Alias para cuando hagas consultas
});

// Un ArchivoAdjunto pertenece a un FormularioActividad
ArchivoAdjunto.belongsTo(FormularioActividad, {
  foreignKey: 'formularioActividadId'
});


// Relación EmpresaCliente <-> TipoProducto (muchos a muchos)
ClientCompany.belongsToMany(TypeProduct, {
  through: 'empresa_tipo_producto',
  foreignKey: 'clientCompanyId',
  otherKey: 'typeProductId'
});
TypeProduct.belongsToMany(ClientCompany, {
  through: 'empresa_tipo_producto',
  foreignKey: 'typeProductId',
  otherKey: 'clientCompanyId'
});

ClientCompany.belongsToMany(ProductLine, {
  through: 'empresa_linea_producto',
  foreignKey: 'clientCompanyId',
  otherKey: 'productLineId'
});
ProductLine.belongsToMany(ClientCompany, {
  through: 'empresa_linea_producto',
  foreignKey: 'productLineId',
  otherKey: 'clientCompanyId'
});
// Relación EmpresaCliente <-> TipoCultivo (muchos a muchos)
ClientCompany.belongsToMany(CultivationType, {
  through: 'empresa_tipo_cultivo',
  foreignKey: 'clientCompanyId',
  otherKey: 'cultivationTypeId'
});
CultivationType.belongsToMany(ClientCompany, {
  through: 'empresa_tipo_cultivo',
  foreignKey: 'cultivationTypeId',
  otherKey: 'clientCompanyId'
});

// Usuario -> Vendedor (1..1)
User.hasOne(Seller, { foreignKey: 'userNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Seller.belongsTo(User, { foreignKey: 'userNumDoc' });

// Vendedor <-> Cliente (muchos a muchos, "clientesAvisitar")
Seller.belongsToMany(Client, {
  through: 'vendedor_cliente',
  foreignKey: 'sellerId',
  otherKey: 'clientNumDoc'
});
Client.belongsToMany(Seller, {
  through: 'vendedor_cliente',
  foreignKey: 'clientNumDoc',
  otherKey: 'sellerId'
});

// Vendedor -> FormularioActividad (1..*)
Seller.hasMany(FormularioActividad, { foreignKey: 'sellerId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
FormularioActividad.belongsTo(Seller, { foreignKey: 'sellerId' });

// EmpresaServicio -> Oportunidad (1..1 en EmpresaServicio, 0..* en Oportunidad)
ClientCompany.hasMany(Opportunity, { foreignKey: 'clientCompanyId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Opportunity.belongsTo(ClientCompany, { foreignKey: 'clientCompanyId' });

// Oportunidad <-> Objetivo (muchos a muchos)
Opportunity.belongsToMany(Objective, {
  through: 'oportunidad_objetivo',
  foreignKey: 'opportunityId',
  otherKey: 'objectiveId'
});
Objective.belongsToMany(Opportunity, {
  through: 'oportunidad_objetivo',
  foreignKey: 'objectiveId',
  otherKey: 'opportunityId'
});

// Relación FormularioActividad -> Servicio (1 a N)
FormularioActividad.hasMany(Servicio, {
    foreignKey: 'formularioActividadId',
    onDelete: 'CASCADE', // Si eliminas el formulario, se borran en cascada sus servicios dependientes
    onUpdate: 'CASCADE'
});

Servicio.belongsTo(FormularioActividad, {
    foreignKey: 'formularioActividadId'
});

export {
  sequelize,
  Client,
  User,
  ClientPhone,
  UserPhone,
  ClientCompany,
  Locality,
  Province,
  TypeProduct,
  ProductLine,
  CultivationType,
  Seller,
  FormularioActividad,
  Opportunity,
  Objective,
  service,
  lineaProd,
  ArchivoAdjunto
};
