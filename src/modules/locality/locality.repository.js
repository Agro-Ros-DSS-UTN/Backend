import { Op } from 'sequelize';
import { Province, Locality, Company } from '../../shared/models/index.js';

export const findAll = ({ q, provinceId, limit }) => {
  const where = {};
  if (q) {
    where[Op.or] = [
      { name: { [Op.like]: `%${q}%` } },
      { postalCode: { [Op.like]: `${q}%` } },
    ];
  }
  if (provinceId) where.provinceId = provinceId;
  return Locality.findAll({
    where,
    include: [{ model: Province, as: 'province' }],
    order: [['name', 'ASC']],
    limit,
  });
};

export const findById = (id, options = {}) =>
  Locality.findByPk(id, options);

export const findByIdWithProvince = (id) =>
  Locality.findByPk(id, { include: [{ model: Province, as: 'province' }] });

export const findOne = (where, options = {}) =>
  Locality.findOne({ where, ...options });

export const create = (data, options = {}) =>
  Locality.create(data, options);

export const update = (locality, data) =>
  locality.update(data);

export const destroy = (locality) =>
  locality.destroy();

export const countCompanies = (localityId) =>
  Company.count({ where: { localityId }, paranoid: false });
