/* eslint-disable */
import sequelize from '../config/database.js';
import Client from './client.model.js';
import User from './user.model.js';
import Provider from './provider.model.js';
import ClientPhone from './client_phone.model.js';
import ProviderPhone from './provider_phone.model.js';
import UserPhone from './user_phone.model.js';
import ClientCompany from './client_company.model.js';
import Locality from './locality.model.js';
import Province from './province.model.js';
import TypeProduct from './type_product.model.js';
import ProductLine from './product_line.model.js';
import CultivationType from './cultivation_type.model.js';


// Relación Cliente -> Telefonos (1..n)
Client.hasMany(ClientPhone, { foreignKey: 'clientNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ClientPhone.belongsTo(Client, { foreignKey: 'clientNumDoc' });

// Relación Proveedor -> Telefonos (1..n)
Provider.hasMany(ProviderPhone, { foreignKey: 'providerNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ProviderPhone.belongsTo(Provider, { foreignKey: 'providerNumDoc' });

// Relación Usuario -> Telefonos (1..n)
User.hasMany(UserPhone, { foreignKey: 'userNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
UserPhone.belongsTo(User, { foreignKey: 'userNumDoc' });

// Relación Cliente -> EmpresaCliente (1..1)
Client.hasOne(ClientCompany, { foreignKey: 'clientNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ClientCompany.belongsTo(Client, { foreignKey: 'clientNumDoc' });

// Relación Proveedor -> EmpresaCliente (1..1)
Provider.hasOne(ClientCompany, { foreignKey: 'providerNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ClientCompany.belongsTo(Provider, { foreignKey: 'providerNumDoc' });

// Relación Provincia -> Localidad (1..n)
Province.hasMany(Locality, { foreignKey: 'provinceId', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Locality.belongsTo(Province, { foreignKey: 'provinceId' });

// Relación Localidad -> EmpresaCliente (1..1)
Locality.hasMany(ClientCompany, { foreignKey: 'localityCodPostal', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
ClientCompany.belongsTo(Locality, { foreignKey: 'localityCodPostal' });

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

export {
  sequelize,
  Client,
  User,
  Provider,
  ClientPhone,
  ProviderPhone,
  UserPhone,
  ClientCompany,
  Locality,
  Province,
  TypeProduct,
  ProductLine,
  CultivationType   
};
