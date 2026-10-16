import { Op, fn, col } from 'sequelize';
import {
  sequelize, Objective, User, Company, CatalogItem, Promotion, Activity, Opportunity, ServiceOrder,
} from '../../shared/models/index.js';

export const includeObjective = [
  { model: User, as: 'seller', attributes: ['idUser', 'fullName', 'role'] },
  { model: Company, as: 'companies', attributes: ['id', 'legalName'], through: { attributes: [] }, paranoid: false },
  { model: CatalogItem, as: 'items', attributes: ['id', 'name', 'type'], through: { attributes: [] } },
  { model: Promotion, as: 'promotions', attributes: ['id', 'name', 'color'], through: { attributes: [] } },
];

export const findAll = ({ userId, activeDate }) => {
  const where = {};
  if (userId) where.userId = userId;
  if (activeDate) {
    where.startDate = { [Op.lte]: activeDate };
    where.endDate = { [Op.gte]: activeDate };
  }
  return Objective.findAll({
    where,
    include: includeObjective,
    order: [['startDate', 'DESC'], ['id', 'DESC']],
  });
};

export const findById = (id, options = {}) =>
  Objective.findByPk(id, options);

export const findByIdFull = (id) =>
  Objective.findByPk(id, { include: includeObjective });

export const findOverlapping = (userId, objectiveType, startDate, endDate, excludeId) =>
  Objective.findOne({
    where: {
      userId,
      objectiveType,
      startDate: { [Op.lte]: endDate },
      endDate: { [Op.gte]: startDate },
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
    },
  });

export const create = (data, options = {}) =>
  Objective.create(data, options);

export const update = (objective, data, options = {}) =>
  objective.update(data, options);

export const destroyWithRelations = (objective) =>
  sequelize.transaction(async (transaction) => {
    await objective.setCompanies([], { transaction });
    await objective.setItems([], { transaction });
    await objective.setPromotions([], { transaction });
    await objective.destroy({ transaction });
  });

export const setCompanies = (objective, companyIds, transaction) =>
  objective.setCompanies(companyIds, { transaction });

export const setItems = (objective, itemIds, transaction) =>
  objective.setItems(itemIds, { transaction });

export const setPromotions = (objective, promotionIds, transaction) =>
  objective.setPromotions(promotionIds, { transaction });

export const countCompaniesByIds = (ids, transaction) =>
  Company.count({ where: { id: ids }, transaction });

export const countCatalogItemsByIds = (ids, transaction) =>
  CatalogItem.count({ where: { id: ids }, transaction });

export const countPromotionsByIds = (ids, transaction) =>
  Promotion.count({ where: { id: ids }, transaction });

export const findUserById = (userId) =>
  User.findByPk(userId);

// ── Cálculos de avance real del objetivo ──

export const countVisitActivities = ({ userId, from, to, companyIds }) =>
  Activity.count({
    where: { userId, contactType: 'visita', occurredAt: { [Op.gte]: from, [Op.lt]: to } },
    include: companyIds.length
      ? [{ model: Opportunity, as: 'opportunity', where: { companyId: { [Op.in]: companyIds } }, attributes: [], paranoid: false }]
      : [],
  });

export const sumSalesActivities = async ({ userId, from, to, companyIds }) => {
  const r = await Activity.findOne({
    attributes: [[fn('COALESCE', fn('SUM', col('sale_amount')), 0), 'total']],
    where: { userId, occurredAt: { [Op.gte]: from, [Op.lt]: to } },
    include: companyIds.length
      ? [{ model: Opportunity, as: 'opportunity', where: { companyId: { [Op.in]: companyIds } }, attributes: [], paranoid: false }]
      : [],
    raw: true,
  });
  return Number(r?.total || 0);
};

export const countNewCompaniesBySeller = ({ userId, from, to }) =>
  Company.count({
    where: { createdById: userId, createdAt: { [Op.gte]: from, [Op.lt]: to } },
  });

export const countQuotedOpportunities = ({ userId, from, to, companyIds }) =>
  Opportunity.count({
    where: {
      userId,
      status: { [Op.in]: ['Cotizado', 'Ganada'] },
      lastActivityAt: { [Op.gte]: from, [Op.lt]: to },
      ...(companyIds.length ? { companyId: { [Op.in]: companyIds } } : {}),
    },
  });

export const countCompletedServiceOrders = ({ userId, startDate, endDate, companyIds }) =>
  ServiceOrder.count({
    where: {
      status: 'Completada',
      completedDate: { [Op.between]: [startDate, endDate] },
      ...(companyIds.length ? { companyId: { [Op.in]: companyIds } } : {}),
    },
    include: [{ model: Opportunity, as: 'opportunity', where: { userId }, attributes: [], paranoid: false }],
  });

export const runTransaction = (fn) =>
  sequelize.transaction(fn);
