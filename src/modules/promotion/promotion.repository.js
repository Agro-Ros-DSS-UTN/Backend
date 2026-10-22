import { Op } from 'sequelize';
import { sequelize, Promotion, CatalogItem, ProductLine } from '../../shared/models/index.js';
import { applyPagination } from '../../shared/utils/pagination.js';

export const includePromotion = [
  {
    model: CatalogItem,
    as: 'items',
    attributes: ['id', 'name', 'type', 'productLineId'],
    through: { attributes: [] },
    include: [{ model: ProductLine, as: 'productLine', attributes: ['id', 'name'] }],
  },
];

export const findAll = ({ activeDate, page, limit }) => {
  const where = {};
  if (activeDate) {
    where.startDate = { [Op.lte]: activeDate };
    where.endDate = { [Op.gte]: activeDate };
  }
  const queryOptions = applyPagination({
    where,
    include: includePromotion,
    order: [['startDate', 'DESC'], ['id', 'DESC']],
  }, { page, limit });

  return Promotion.findAll(queryOptions);
};

export const findById = (id, options = {}) =>
  Promotion.findByPk(id, options);

export const findByIdFull = (id) =>
  Promotion.findByPk(id, { include: includePromotion });

export const create = (data, options = {}) =>
  Promotion.create(data, options);

export const update = (promotion, data, options = {}) =>
  promotion.update(data, options);

export const destroyWithRelations = (promotion) =>
  sequelize.transaction(async (transaction) => {
    await promotion.setItems([], { transaction });
    await promotion.setObjectives([], { transaction });
    await promotion.destroy({ transaction });
  });

export const findActiveItemsByProductLineIds = (productLineIds, transaction) =>
  CatalogItem.findAll({
    where: { productLineId: { [Op.in]: productLineIds }, active: true },
    attributes: ['id'],
    transaction,
  });

export const countCatalogItemsByIds = (ids, transaction) =>
  CatalogItem.count({ where: { id: ids }, transaction });

export const setItems = (promotion, itemIds, transaction) =>
  promotion.setItems(itemIds, { transaction });

export const runTransaction = (fn) =>
  sequelize.transaction(fn);
