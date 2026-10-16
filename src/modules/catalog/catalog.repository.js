import { Op } from 'sequelize';
import { ProductLine, CatalogItem, ServiceOrder, AppliedProduct } from '../../shared/models/index.js';

export const findAllProductLines = () =>
  ProductLine.findAll({ order: [['name', 'ASC']] });

export const findProductLineById = (id, { withItems = false } = {}) =>
  ProductLine.findByPk(id, withItems ? { include: [{ model: CatalogItem, as: 'items' }] } : {});

export const findOrCreateProductLine = ({ name, category }) =>
  ProductLine.findOrCreate({ where: { name }, defaults: { name, category } });

export const createProductLine = (data) =>
  ProductLine.create(data);

export const updateProductLine = (line, data) =>
  line.update(data);

export const destroyProductLine = (line) =>
  line.destroy();

export const countItemsInProductLine = (productLineId) =>
  CatalogItem.count({ where: { productLineId } });

export const findAllItems = ({ type, active, productLineId, q, withoutImage = false }) => {
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

export const findItemById = (id, { withImage = false, withProductLine = false } = {}) =>
  (withImage ? CatalogItem.scope('withImage') : CatalogItem).findByPk(
    id,
    withProductLine ? { include: [{ model: ProductLine, as: 'productLine' }] } : {}
  );

export const createItem = (data) =>
  CatalogItem.create(data);

export const updateItem = (item, data) =>
  item.update(data);

export const destroyItem = (item) =>
  item.destroy();

export const countItemUsageInOrders = async (itemId) => {
  const [inOrders, inApplied] = await Promise.all([
    ServiceOrder.count({ where: { serviceId: itemId }, paranoid: false }),
    AppliedProduct.count({ where: { itemId } }),
  ]);
  return inOrders + inApplied;
};
