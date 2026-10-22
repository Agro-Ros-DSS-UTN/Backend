import { Op } from 'sequelize';
import { sequelize, Contact, ContactPhone, Company, Locality } from '../../shared/models/index.js';
import { applyPagination } from '../../shared/utils/pagination.js';

export const includeContact = [
  { model: Company, as: 'company', attributes: ['id', 'legalName', 'localityId'], include: [{ model: Locality, as: 'locality', attributes: ['id', 'name'] }] },
  { model: ContactPhone, as: 'phones' },
];

export const findAll = ({ companyId, q, paranoid = true, page, limit }) => {
  const where = {};
  if (companyId) where.companyId = companyId;
  if (q) {
    where[Op.or] = [
      { fullName: { [Op.like]: `%${q}%` } },
      { nationalId: { [Op.like]: `%${q}%` } },
      { email: { [Op.like]: `%${q}%` } },
    ];
  }
  const queryOptions = applyPagination({
    where,
    include: includeContact,
    order: [['fullName', 'ASC']],
    paranoid,
  }, { page, limit });

  return Contact.findAll(queryOptions);
};

export const findById = (id, options = {}) =>
  Contact.findByPk(id, options);

export const findByIdFull = (id, options = {}) =>
  Contact.findByPk(id, { include: includeContact, ...options });

export const findOne = (where, options = {}) =>
  Contact.findOne({ where, ...options });

export const create = (data, options = {}) =>
  Contact.create(data, options);

export const update = (contact, data, options = {}) =>
  contact.update(data, options);

export const destroy = (contact, options = {}) =>
  contact.destroy(options);

export const restore = (contact, options = {}) =>
  contact.restore(options);

export const replacePhones = async (contactId, numbers, transaction) => {
  await ContactPhone.destroy({ where: { contactId }, transaction });
  if (numbers.length) {
    await ContactPhone.bulkCreate(numbers.map((number) => ({ contactId, number })), { transaction });
  }
};

export const createPhone = (data, options = {}) =>
  ContactPhone.create(data, options);

export const findCompanyById = (companyId, options = {}) =>
  Company.findByPk(companyId, options);

export const runTransaction = (fn) =>
  sequelize.transaction(fn);
