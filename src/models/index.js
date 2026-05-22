import sequelize from '../config/database.js';
import Persona from './persona.model.js';
import Cliente from './cliente.model.js';
import Usuario from './usuario.model.js';

// Relación Persona -> Cliente
Persona.hasOne(Cliente, { foreignKey: 'personaNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Cliente.belongsTo(Persona, { foreignKey: 'personaNumDoc' });

// Relación Persona -> Usuario
Persona.hasOne(Usuario, { foreignKey: 'personaNumDoc', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Usuario.belongsTo(Persona, { foreignKey: 'personaNumDoc' });

export {
  sequelize,
  Persona,
  Cliente,
  Usuario
};