import { Op } from 'sequelize';
import { User, Locality, Province, sequelize } from '../../shared/models/index.js';

const zoneInclude = [
  { model: Locality, as: 'zone', through: { attributes: [] }, include: [{ model: Province, as: 'province' }] },
];

export const findAuthById = (idUser) => User.scope('auth').findByPk(idUser);

export const findAuthMinimalById = (idUser) =>
  User.scope('auth').findByPk(idUser, {
    attributes: ['idUser', 'fullName', 'role', 'accountStatus', 'tokenVersion'],
  });

export const findWithImageById = (idUser, options = {}) =>
  User.scope('withImage').findByPk(idUser, options);

export const findById = (idUser, options = {}) => User.findByPk(idUser, options);

export const findByIdWithZone = (idUser, { withImage = false } = {}) =>
  (withImage ? User.scope('withImage') : User).findByPk(idUser, { include: zoneInclude });

export const findAllActiveMinimal = () =>
  User.findAll({
    where: { accountStatus: 'Activo' },
    attributes: ['idUser', 'fullName', 'role'],
    order: [['fullName', 'ASC']],
  });

export const findAllWithZone = () =>
  User.findAll({
    include: zoneInclude,
    order: [['fullName', 'ASC']],
  });

export const create = (data, options = {}) => User.create(data, options);

export const save = (user, options = {}) => user.save(options);

export const destroy = (user) => user.destroy();

export const updateProfileImage = (idUser, profileImage) =>
  User.update({ profileImage }, { where: { idUser } });

export const findLocalitiesByIds = (ids) =>
  Locality.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id'] });

export const replaceUserZone = (user, localities) =>
  sequelize.transaction(async (transaction) => {
    await user.setZone(localities, { transaction });
  });

export const countByIds = (ids, transaction) =>
  User.count({ where: { idUser: { [Op.in]: ids } }, transaction });
