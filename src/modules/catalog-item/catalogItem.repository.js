import { Op } from 'sequelize';
import { ProductLine, CatalogItem, ServiceOrder, AppliedProduct } from '../../shared/models/index.js';

export const findAll = ({ type, active, productLineId, q, withoutImage = false }) => {
  const where = {};
  if (type) where.type = type;
  if (active) where.active = true;
  if (productLineId) where.productLineId = productLineId;
  if (q) {
    where[Op.or] = [
      { name: { [Op.like]: `%${q}%` } },
      { code: { [Op.like]: `%${q}%` } },
      { activeIngredient: { [Op.like]: `%${q}%` } },
    ];
  }
  const scope = withoutImage ? 'defaultScope' : 'withImage';
  return CatalogItem.scope(scope).findAll({
    where,
    include: [{ model: ProductLine, as: 'productLine' }],
    order: [['name', 'ASC']],
  });
};

export const findById = (id, { withImage = false, withProductLine = false } = {}) =>
  (withImage ? CatalogItem.scope('withImage') : CatalogItem).findByPk(
    id,
    withProductLine ? { include: [{ model: ProductLine, as: 'productLine' }] } : {}
  );

export const create = (data) =>
  CatalogItem.create(data);

export const update = (item, data) =>
  item.update(data);

export const destroy = (item) =>
  item.destroy();

export const countUsageInOrders = async (itemId) => {
  const [inOrders, inApplied] = await Promise.all([
    ServiceOrder.count({ where: { serviceId: itemId }, paranoid: false }),
    AppliedProduct.count({ where: { itemId } }),
  ]);
  return inOrders + inApplied;
};
