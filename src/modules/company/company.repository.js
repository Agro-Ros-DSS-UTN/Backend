import { Op, literal } from 'sequelize';
import {
  sequelize, Company, Locality, Province, Contact, ContactPhone, User, Crop,
  ServiceOrder, ServiceEvaluation, CatalogItem, UserLocality,
} from '../../shared/models/index.js';
import { OPEN_STATUSES } from '../commercial/opportunity.entity.js';

export const includeBase = [
  { model: Locality, as: 'locality', include: [{ model: Province, as: 'province' }] },
  { model: User, as: 'createdBy', attributes: ['idUser', 'fullName', 'role'] },
];

export const includeWithContacts = [
  ...includeBase,
  { model: Contact, as: 'contacts', include: [{ model: ContactPhone, as: 'phones' }] },
];

export const findAll = ({ companyType, localityId, localityIds, q, paranoid = true }) => {
  const where = {};
  if (companyType) where.companyType = String(companyType);
  if (localityId) where.localityId = String(localityId);
  if (localityIds?.length) where.localityId = { [Op.in]: localityIds };
  if (q) {
    where[Op.or] = [
      { legalName: { [Op.like]: `%${q}%` } },
      { tradeName: { [Op.like]: `%${q}%` } },
      { cuit: { [Op.like]: `%${q}%` } },
    ];
  }
  return Company.findAll({
    where,
    paranoid,
    include: [
      ...includeBase,
      { model: Contact, as: 'contacts', required: false, include: [{ model: ContactPhone, as: 'phones' }] },
    ],
    attributes: {
      include: [[literal(`(SELECT COUNT(*) FROM opportunities o WHERE o.company_id = Company.id AND o.deleted_at IS NULL AND o.status IN (${OPEN_STATUSES.map((e) => `'${e}'`).join(',')}))`), 'openOpportunities']],
    },
    order: [['legalName', 'ASC']],
  });
};

export const findById = (id, options = {}) =>
  Company.findByPk(id, options);

export const findByIdWithDetails = (id, { paranoid = true, withCrops = false, withPhoneDetails = true } = {}) => {
  const include = [
    ...includeBase,
    withPhoneDetails
      ? { model: Contact, as: 'contacts', include: [{ model: ContactPhone, as: 'phones' }] }
      : { model: Contact, as: 'contacts' },
    ...(withCrops ? [{ model: Crop, as: 'crops', through: { attributes: [] } }] : []),
  ];
  return Company.findByPk(id, { paranoid, include });
};

export const findByIdWithLocality = (id) =>
  Company.findByPk(id, { include: [{ model: Locality, as: 'locality' }] });

export const findOne = (where, options = {}) =>
  Company.findOne({ where, ...options });

export const countByIds = (ids, transaction) =>
  Company.count({ where: { id: ids }, transaction });

export const findChildrenIds = (parentIds) =>
  Company.findAll({ where: { parentCompanyId: { [Op.in]: parentIds } }, attributes: ['id'] });

export const findChildrenWithContacts = (parentIds) =>
  Company.findAll({
    where: { parentCompanyId: Array.isArray(parentIds) ? { [Op.in]: parentIds } : parentIds },
    include: includeWithContacts,
    order: [['legalName', 'ASC']],
  });

export const findCompaniesInProvince = (provinceId) =>
  Company.findAll({
    include: [{ model: Locality, as: 'locality', where: { provinceId }, attributes: [] }],
    attributes: ['id'],
  });

export const create = (data, options = {}) =>
  Company.create(data, options);

export const update = (company, data, options = {}) =>
  company.update(data, options);

export const destroy = (company) =>
  company.destroy();

export const restore = (company) =>
  company.restore();

export const setCrops = (company, cropIds, transaction) =>
  company.setCrops(cropIds, { transaction });

export const findAllCrops = () =>
  Crop.findAll({ order: [['name', 'ASC']] });

export const createCrop = (data) =>
  Crop.create(data);

export const findUserById = (id, options = {}) =>
  User.findByPk(String(id), options);

export const hasUserLocality = async (userId, localityId) =>
  Boolean(await UserLocality.findOne({ where: { userId, localityId } }));

export const findUserLocalityIds = async (userId) => {
  const rows = await UserLocality.findAll({ where: { userId }, attributes: ['localityId'] });
  return rows.map((z) => z.localityId);
};

export const findContactById = (id, options = {}) =>
  Contact.findByPk(id, options);

export const updateContact = (contact, data, options = {}) =>
  contact.update(data, options);

export const createContact = (data, options = {}) =>
  Contact.create(data, options);

export const createContactPhone = (data, options = {}) =>
  ContactPhone.create(data, options);

export const findServiceOrdersForDashboard = ({ companyIds, fromStr, serviceWhere }) =>
  ServiceOrder.findAll({
    where: {
      ...(companyIds ? { companyId: { [Op.in]: companyIds } } : {}),
      scheduledDate: { [Op.gte]: fromStr },
    },
    include: [
      { model: ServiceEvaluation, as: 'evaluation', attributes: ['result', 'customerSatisfaction', 'evaluationDate'] },
      { model: CatalogItem, as: 'service', attributes: ['id', 'name', 'serviceType'], ...(serviceWhere ? { where: serviceWhere, required: true } : { required: false }) },
    ],
    attributes: ['id', 'orderNumber', 'scheduledDate', 'completedDate', 'status', 'workType', 'companyId'],
    order: [['scheduledDate', 'ASC']],
  });

export const runTransaction = (fn) =>
  sequelize.transaction(fn);
