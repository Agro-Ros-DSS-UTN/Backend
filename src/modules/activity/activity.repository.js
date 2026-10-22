import { Op } from 'sequelize';
import {
  sequelize, Activity, Attachment, Opportunity, Company, Contact, User, Task, TaskAssignee, ServiceOrder, RoadmapStop, Roadmap,
} from '../../shared/models/index.js';
import { OPEN_STATUSES } from '../opportunity/opportunity.entity.js';
import { applyPagination } from '../../shared/utils/pagination.js';

export const includeActivity = [
  {
    model: Opportunity, as: 'opportunity', attributes: ['id', 'title', 'status', 'companyId', 'userId'], paranoid: false,
    include: [{ model: Company, as: 'company', attributes: ['id', 'legalName'], paranoid: false }],
  },
  {
    model: ServiceOrder, as: 'serviceOrder', attributes: ['id', 'orderNumber', 'companyId', 'customerName'], paranoid: false,
    include: [{ model: Company, as: 'company', attributes: ['id', 'legalName'], paranoid: false }],
  },
  { model: User, as: 'author', attributes: ['idUser', 'fullName'] },
  { model: Attachment, as: 'attachments' },
  { model: Task, as: 'tasks', attributes: ['id', 'title', 'status', 'dueDate'] },
];

export const findAll = async ({ userId, opportunityId, serviceOrderId, fromDate, toDate, companyId, limit, page }) => {
  const where = {};
  if (userId) where.userId = userId;
  if (opportunityId) where.opportunityId = opportunityId;
  if (serviceOrderId) where.serviceOrderId = serviceOrderId;
  if (fromDate || toDate) {
    where.occurredAt = {
      ...(fromDate ? { [Op.gte]: fromDate } : {}),
      ...(toDate ? { [Op.lt]: toDate } : {}),
    };
  }
  if (companyId) {
    const [opps, orders] = await Promise.all([
      Opportunity.findAll({ where: { companyId }, attributes: ['id'], paranoid: false }),
      ServiceOrder.findAll({ where: { companyId }, attributes: ['id'], paranoid: false }),
    ]);
    where[Op.and] = [{
      [Op.or]: [
        { opportunityId: { [Op.in]: opps.map((o) => o.id).concat(0) } },
        { serviceOrderId: { [Op.in]: orders.map((o) => o.id).concat(0) } },
      ],
    }];
  }
  const queryOptions = applyPagination({
    where,
    include: includeActivity,
    order: [['occurredAt', 'DESC'], ['id', 'DESC']],
  }, { page, limit });

  return Activity.findAll(queryOptions);
};

export const findByIdFull = (id) =>
  Activity.findByPk(id, { include: includeActivity });

export const findByClientUuid = (clientUuid) =>
  Activity.findOne({ where: { clientUuid }, include: includeActivity });

export const create = (data, options = {}) =>
  Activity.create(data, options);

export const update = (activity, data, options = {}) =>
  activity.update(data, options);

export const destroyWithChildren = (activity) =>
  sequelize.transaction(async (transaction) => {
    await Attachment.destroy({ where: { activityId: activity.id }, transaction });
    await Task.update({ activityId: null }, { where: { activityId: activity.id }, transaction });
    await activity.destroy({ transaction });
  });

export const bulkCreateAttachments = (rows, transaction) =>
  Attachment.bulkCreate(rows, { transaction });

export const destroyAttachmentsByIds = (activityId, attachmentIds, transaction) =>
  Attachment.destroy({
    where: { activityId, id: { [Op.in]: attachmentIds } },
    transaction,
  });

export const findAttachmentWithContent = (id) =>
  Attachment.scope('withContent').findByPk(id, {
    include: [{ model: Activity, as: 'activity', attributes: ['userId'] }],
  });

export const findOpportunityById = (id, options = {}) =>
  Opportunity.findByPk(id, options);

export const findOpenOpportunityForCompany = ({ companyId, admin, currentUserId, transaction }) =>
  Opportunity.findOne({
    where: {
      companyId,
      status: { [Op.in]: OPEN_STATUSES },
      ...(admin ? {} : { [Op.or]: [{ userId: currentUserId }, { userId: null }] }),
    },
    order: [['lastActivityAt', 'DESC']],
    transaction,
  });

export const updateOpportunity = (opportunity, changes, transaction) =>
  opportunity.update(changes, { transaction });

export const findCompanyByLegalName = (legalName, transaction) =>
  Company.findOne({ where: { legalName }, transaction });

export const findContactById = (id, transaction) =>
  Contact.findByPk(id, { transaction });

export const findServiceOrderById = (id, transaction) =>
  ServiceOrder.findByPk(id, { transaction });

export const findRoadmapStopWithRoadmap = (id, transaction) =>
  RoadmapStop.findByPk(id, {
    include: [{ model: Roadmap, as: 'roadmap', attributes: ['userId'] }],
    transaction,
  });

export const updateRoadmapStop = (stop, data, transaction) =>
  stop.update(data, { transaction });

export const createTask = (data, transaction) =>
  Task.create(data, { transaction });

export const bulkCreateTaskAssignees = (rows, transaction) =>
  TaskAssignee.bulkCreate(rows, { transaction });

export const countUsersByIds = (ids, transaction) =>
  User.count({ where: { idUser: { [Op.in]: ids } }, transaction });

export const runTransaction = (fn) =>
  sequelize.transaction(fn);
