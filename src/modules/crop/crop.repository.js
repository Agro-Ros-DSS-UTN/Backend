import { Crop } from '../../shared/models/index.js';

export const findAll = () =>
  Crop.findAll({ order: [['name', 'ASC']] });

export const create = (data) =>
  Crop.create(data);
