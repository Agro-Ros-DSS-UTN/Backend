import { Op } from 'sequelize';
import {
  sequelize, Opportunity, Company, User, Contact, Activity, CatalogItem, ServiceOrder,
} from '../../shared/models/index.js';
import { OPEN_STATUSES } from './opportunity.entity.js';
import { applyPagination } from '../../shared/utils/pagination.js';

export const includeOpportunity = [
  { model: Company, as: 'company', attributes: ['id', 'legalName', 'localityId'], paranoid: false },
  { model: User, as: 'owner', attributes: ['idUser', 'fullName', 'role'] },
  { model: Contact, as: 'contact', attributes: ['id', 'fullName', 'nationalId'], paranoid: false },
];

export const findAll = ({ status, open, companyId, forActivity, admin, currentUserId, userId, limit, page, paranoid = true }) => {
  const where = {};
  if (status) where.status = status;
  if (open) where.status = { [Op.in]: OPEN_STATUSES };
  if (companyId) where.companyId = companyId;
  // Para registrar una actividad, el vendedor necesita ver las oportunidades
  // abiertas de la empresa aunque estén a nombre de otro vendedor.
  if (!admin && !forActivity) {
    where[Op.or] = [{ userId: currentUserId }, { userId: null }];
  } else if (admin && userId) {
    where.userId = String(userId);
  }
  const queryOptions = applyPagination({
    where,
    include: includeOpportunity,
    attributes: {
      include: [[sequelize.literal('(SELECT COUNT(*) FROM activities a WHERE a.opportunity_id = Opportunity.id)'), 'activityCount']],
    },
    order: [['lastActivityAt', 'DESC'], ['id', 'DESC']],
    paranoid,
  }, { page, limit });

  return Opportunity.findAll(queryOptions);
};

export const findById = (id, options = {}) =>
  Opportunity.findByPk(id, options);

export const findByIdWithSummary = (id) =>
  Opportunity.findByPk(id, { include: includeOpportunity });

export const findByIdFull = (id) =>
  Opportunity.findByPk(id, {
    include: [
      ...includeOpportunity,
      { model: CatalogItem, as: 'items', attributes: ['id', 'name', 'type'], through: { attributes: ['quantity'] } },
      { model: Activity, as: 'activities', include: [{ model: User, as: 'author', attributes: ['idUser', 'fullName'] }] },
      { model: ServiceOrder, as: 'serviceOrders', attributes: ['id', 'orderNumber', 'status', 'scheduledDate'] },
    ],
    order: [[{ model: Activity, as: 'activities' }, 'occurredAt', 'DESC']],
  });

export const findLatestOpenForCompany = ({ companyId, admin, currentUserId, transaction }) =>
  Opportunity.findOne({
    where: {
      companyId,
      status: { [Op.in]: OPEN_STATUSES },
      ...(admin ? {} : { [Op.or]: [{ userId: currentUserId }, { userId: null }] }),
    },
    order: [['lastActivityAt', 'DESC']],
    transaction,
  });

export const create = (data, options = {}) =>
  Opportunity.create(data, options);

export const update = (opportunity, data, options = {}) =>
  opportunity.update(data, options);

export const destroy = (opportunity, options = {}) =>
  opportunity.destroy(options);

export const restore = (opportunity, options = {}) =>
  opportunity.restore(options);

export const replaceItems = async (opportunity, rows, transaction) => {
  await opportunity.setItems([], { transaction });
  for (const f of rows) {
    await opportunity.addItem(f.itemId, { through: { quantity: f.quantity }, transaction });
  }
};

export const countCatalogItemsByIds = (ids, transaction) =>
  CatalogItem.count({ where: { id: { [Op.in]: ids } }, transaction });

export const findCompanyById = (companyId, options = {}) =>
  Company.findByPk(companyId, options);

export const findContactById = (contactId, options = {}) =>
  Contact.findByPk(contactId, options);

export const findUserById = (userId, options = {}) =>
  User.findByPk(userId, options);

export const countOtherUsersActivities = (opportunityId, currentUserId) =>
  Activity.count({
    where: {
      opportunityId,
      userId: { [Op.ne]: currentUserId },
    },
  });

export const runTransaction = (fn) =>
  sequelize.transaction(fn);
