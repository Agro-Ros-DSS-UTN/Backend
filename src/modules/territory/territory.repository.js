import { Op } from 'sequelize';
import { Province, Locality, Company, UserLocality } from '../../shared/models/index.js';

export const findAllProvinces = () =>
  Province.findAll({ order: [['name', 'ASC']] });

export const findProvinceById = (id) =>
  Province.findByPk(id);

export const findAllLocalities = ({ q, provinceId, limit }) => {
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

export const findLocalityById = (id, options = {}) =>
  Locality.findByPk(id, options);

export const findLocalityByIdWithProvince = (id) =>
  Locality.findByPk(id, { include: [{ model: Province, as: 'province' }] });

export const findLocalityOne = (where, options = {}) =>
  Locality.findOne({ where, ...options });

export const createLocality = (data, options = {}) =>
  Locality.create(data, options);

export const updateLocality = (locality, data) =>
  locality.update(data);

export const destroyLocality = (locality) =>
  locality.destroy();

export const countCompaniesInLocality = (localityId) =>
  Company.count({ where: { localityId }, paranoid: false });

export const findUserLocality = (userId, localityId) =>
  UserLocality.findOne({ where: { userId, localityId } });

export const findUserLocalities = (userId) =>
  UserLocality.findAll({ where: { userId }, attributes: ['localityId'] });
