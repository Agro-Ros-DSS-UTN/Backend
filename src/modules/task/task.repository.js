import { Op } from 'sequelize';
import {
  sequelize, Task, TaskAssignee, User, Company, Contact, ContactPhone, Activity, Opportunity,
} from '../../shared/models/index.js';
import { applyPagination } from '../../shared/utils/pagination.js';

export const includeTask = [
  { model: TaskAssignee, as: 'assignments', include: [{ model: User, as: 'user', attributes: ['idUser', 'fullName', 'role', 'email'] }] },
  { model: User, as: 'createdBy', attributes: ['idUser', 'fullName', 'role'] },
  { model: User, as: 'completedBy', attributes: ['idUser', 'fullName', 'role'] },
  { model: Company, as: 'company', attributes: ['id', 'legalName'], paranoid: false },
  {
    model: Contact, as: 'contact', attributes: ['id', 'fullName', 'jobTitle', 'email', 'companyId'], paranoid: false,
    include: [{ model: ContactPhone, as: 'phones', attributes: ['number'] }],
  },
  {
    model: Activity, as: 'activity', attributes: ['id', 'contactType', 'occurredAt', 'description', 'opportunityId'],
    include: [{ model: Opportunity, as: 'opportunity', attributes: ['id', 'title'], paranoid: false }],
  },
];

export const findAll = async ({ status, companyId, admin, currentUserId, filterUserId, page, limit }) => {
  const where = {};
  if (status) where.status = status;
  if (companyId) where.companyId = companyId;
  if (!admin) {
    const mine = await TaskAssignee.findAll({ where: { userId: currentUserId }, attributes: ['taskId'] });
    where[Op.or] = [
      { createdById: currentUserId },
      { id: { [Op.in]: mine.map((m) => m.taskId).concat(0) } },
    ];
  } else if (filterUserId) {
    const assignedRows = await TaskAssignee.findAll({ where: { userId: String(filterUserId) }, attributes: ['taskId'] });
    where.id = { [Op.in]: assignedRows.map((m) => m.taskId).concat(0) };
  }
  const queryOptions = applyPagination({ where, include: includeTask, order: [['id', 'DESC']] }, { page, limit });
  return Task.findAll(queryOptions);
};

export const findById = (id, options = {}) =>
  Task.findByPk(id, options);

export const findByIdFull = (id) =>
  Task.findByPk(id, { include: includeTask });

export const create = (data, options = {}) =>
  Task.create(data, options);

export const update = (task, data, options = {}) =>
  task.update(data, options);

export const destroyWithAssignees = (task) =>
  sequelize.transaction(async (transaction) => {
    await TaskAssignee.destroy({ where: { taskId: task.id }, transaction });
    await task.destroy({ transaction });
  });

export const findAssignment = (taskId, userId) =>
  TaskAssignee.findOne({ where: { taskId, userId } });

export const findAssignmentWithUser = (taskId, userId) =>
  TaskAssignee.findOne({
    where: { taskId, userId },
    include: [{ model: User, as: 'user', attributes: ['idUser', 'fullName', 'email'] }],
  });

export const findAssignmentsByTask = (taskId, options = {}) =>
  TaskAssignee.findAll({ where: { taskId }, ...options });

export const destroyAssignment = (assignment, options = {}) =>
  assignment.destroy(options);

export const bulkCreateAssignments = (rows, options = {}) =>
  TaskAssignee.bulkCreate(rows, options);

export const updateAssignment = (assignment, data) =>
  assignment.update(data);

export const saveAssignment = (assignment) =>
  assignment.save();

export const findPendingReminderAssignments = () =>
  TaskAssignee.findAll({
    where: { [Op.or]: [{ reminder48hSent: false }, { reminder24hSent: false }] },
    include: [
      { model: Task, as: 'task', where: { status: 'Pendiente' }, include: [{ model: Company, as: 'company', attributes: ['legalName'] }] },
      { model: User, as: 'user', attributes: ['idUser', 'fullName', 'email'] },
    ],
  });

export const countUsersByIds = (ids, transaction) =>
  User.count({ where: { idUser: { [Op.in]: ids } }, transaction });

export const findCompanyById = (id, transaction) =>
  Company.findByPk(id, { transaction });

export const findCompanyByLegalName = (legalName, transaction) =>
  Company.findOne({ where: { legalName }, transaction });

export const findContactById = (id, options = {}) =>
  Contact.findByPk(id, options);

export const findContactByNameAndCompany = ({ fullName, companyId }, transaction) =>
  Contact.findOne({
    where: { fullName, ...(companyId ? { companyId } : {}) },
    transaction,
  });

export const findActivityById = (id, transaction) =>
  Activity.findByPk(id, { transaction });

export const runTransaction = (fn) =>
  sequelize.transaction(fn);
