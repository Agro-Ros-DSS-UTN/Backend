import { Province } from '../../shared/models/index.js';

export const findAll = () =>
  Province.findAll({ order: [['name', 'ASC']] });

export const findById = (id) =>
  Province.findByPk(id);
