import { Op } from 'sequelize';
import {
  sequelize, ServiceOrder, AppliedProduct, ServiceEvaluation, Employee, Company, CatalogItem, Opportunity, User, Activity,
} from '../../shared/models/index.js';
import { ORDER_EXECUTOR_ROLES } from '../employee/employee.entity.js';
import { applyPagination } from '../../shared/utils/pagination.js';

export const includeServiceOrder = [
  { model: AppliedProduct, as: 'appliedProducts', include: [{ model: CatalogItem, as: 'item', attributes: ['id', 'name'] }] },
  { model: ServiceEvaluation, as: 'evaluation' },
  { model: Employee, as: 'technicians', attributes: ['id', 'fullName', 'licenseNumber', 'role'], through: { attributes: [] } },
  { model: Company, as: 'company', attributes: ['id', 'legalName', 'cuit'], paranoid: false },
  { model: CatalogItem, as: 'service', attributes: ['id', 'name', 'serviceType'] },
  { model: Opportunity, as: 'opportunity', attributes: ['id', 'title', 'status'], paranoid: false },
  { model: User, as: 'createdBy', attributes: ['idUser', 'fullName'] },
];

export const findAll = ({ status, companyId, from, to, paranoid = true, page, limit }) => {
  const where = {};
  if (status) where.status = status;
  if (companyId) where.companyId = companyId;
  if (from || to) {
    where.scheduledDate = {
      ...(from ? { [Op.gte]: from } : {}),
      ...(to ? { [Op.lte]: to } : {}),
    };
  }
  const queryOptions = applyPagination({
    where,
    include: includeServiceOrder,
    order: [['scheduledDate', 'DESC'], ['id', 'DESC']],
    paranoid,
  }, { page, limit });

  return ServiceOrder.findAll(queryOptions);
};

export const findById = (id, options = {}) =>
  ServiceOrder.findByPk(id, options);

export const findByIdFull = (id, { withTechnicalVisits = false } = {}) =>
  ServiceOrder.findByPk(id, {
    include: withTechnicalVisits
      ? [...includeServiceOrder, { model: Activity, as: 'technicalVisits', attributes: ['id', 'occurredAt', 'description', 'userId'] }]
      : includeServiceOrder,
  });

export const findByOrderNumber = (orderNumber) =>
  ServiceOrder.findOne({ where: { orderNumber }, paranoid: false });

export const create = (data, options = {}) =>
  ServiceOrder.create(data, options);

export const update = (order, data, options = {}) =>
  order.update(data, options);

export const destroy = (order) =>
  order.destroy();

export const restore = (order) =>
  order.restore();

export const setTechnicians = (order, technicianIds, transaction) =>
  order.setTechnicians(technicianIds, { transaction });

export const replaceAppliedProducts = async (serviceOrderId, rows, transaction) => {
  await AppliedProduct.destroy({ where: { serviceOrderId }, transaction });
  if (rows.length) {
    await AppliedProduct.bulkCreate(rows.map((p) => ({ ...p, serviceOrderId })), { transaction });
  }
};

export const bulkCreateAppliedProducts = (rows, transaction) =>
  AppliedProduct.bulkCreate(rows, { transaction });

export const findEvaluationByOrderId = (serviceOrderId, transaction) =>
  ServiceEvaluation.findOne({ where: { serviceOrderId }, transaction });

export const createEvaluation = (payload, transaction) =>
  ServiceEvaluation.create(payload, { transaction });

// Se actualiza por orden (no por la instancia): el número de evaluación es parte de la
// clave primaria y puede cambiar.
export const updateEvaluationByOrderId = (serviceOrderId, payload, transaction) =>
  ServiceEvaluation.update(payload, { where: { serviceOrderId }, transaction });

// Evaluación de otra orden que ya use ese número.
export const findEvaluationByNumber = (evaluationNumber, exceptOrderId, transaction) =>
  ServiceEvaluation.findOne({ where: { evaluationNumber, serviceOrderId: { [Op.ne]: exceptOrderId } }, transaction });

export const findCompanyById = (id, transaction) =>
  Company.findByPk(id, { transaction });

export const findCompanyByLegalName = (legalName, transaction) =>
  Company.findOne({ where: { legalName }, transaction });

export const findServiceItemById = (id, transaction) =>
  CatalogItem.findByPk(id, { transaction });

export const findServiceItemByName = (name, transaction) =>
  CatalogItem.findOne({ where: { type: 'servicio', name }, transaction });

export const findOpportunityById = (id, transaction) =>
  Opportunity.findByPk(id, { transaction });

export const findExecutorEmployeeByName = (fullName, transaction) =>
  Employee.findOne({
    where: { fullName, role: { [Op.in]: ORDER_EXECUTOR_ROLES } },
    transaction,
  });

export const findActiveExecutorEmployeesByIds = (ids, transaction) =>
  Employee.findAll({
    where: { id: { [Op.in]: ids }, role: { [Op.in]: ORDER_EXECUTOR_ROLES }, active: true },
    attributes: ['id'],
    transaction,
  });

export const runTransaction = (fn) =>
  sequelize.transaction(fn);
