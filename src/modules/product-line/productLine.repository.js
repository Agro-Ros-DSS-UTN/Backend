import { ProductLine, CatalogItem } from '../../shared/models/index.js';

export const findAll = () =>
  ProductLine.findAll({ order: [['name', 'ASC']] });

export const findById = (id, { withItems = false } = {}) =>
  ProductLine.findByPk(id, withItems ? { include: [{ model: CatalogItem, as: 'items' }] } : {});

export const findOrCreateByName = ({ name, category }) =>
  ProductLine.findOrCreate({ where: { name }, defaults: { name, category } });

export const create = (data) =>
  ProductLine.create(data);

export const update = (line, data) =>
  line.update(data);

export const destroy = (line) =>
  line.destroy();

export const countItems = (productLineId) =>
  CatalogItem.count({ where: { productLineId } });
