import { sequelize, Roadmap, RoadmapStop, User, Company, Activity, Locality } from '../../shared/models/index.js';

export const includeRoadmap = [
  {
    model: RoadmapStop,
    as: 'stops',
    include: [
      {
        model: Company,
        as: 'company',
        attributes: ['id', 'legalName', 'address', 'latitude', 'longitude'],
        paranoid: false,
        include: [{ model: Locality, as: 'locality', attributes: ['id', 'name', 'latitude', 'longitude'] }],
      },
      { model: Activity, as: 'activity', attributes: ['id', 'contactType', 'occurredAt'] },
    ],
  },
  { model: User, as: 'assigned', attributes: ['idUser', 'fullName', 'role'] },
  { model: User, as: 'createdBy', attributes: ['idUser', 'fullName'] },
];

export const orderRoadmap = [['date', 'DESC'], [{ model: RoadmapStop, as: 'stops' }, 'sortOrder', 'ASC']];

export const findAll = ({ userId, status }) => {
  const where = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;
  return Roadmap.findAll({
    where,
    include: includeRoadmap,
    order: orderRoadmap,
  });
};

export const findById = (id, options = {}) =>
  Roadmap.findByPk(id, options);

export const findByIdFull = (id) =>
  Roadmap.findByPk(id, { include: includeRoadmap, order: orderRoadmap });

export const create = (data, options = {}) =>
  Roadmap.create(data, options);

export const update = (roadmap, data, options = {}) =>
  roadmap.update(data, options);

export const destroyWithStops = (roadmap) =>
  sequelize.transaction(async (transaction) => {
    const stops = await RoadmapStop.findAll({ where: { roadmapId: roadmap.id }, attributes: ['id'], transaction });
    if (stops.length) {
      await Activity.update({ roadmapStopId: null }, { where: { roadmapStopId: stops.map((p) => p.id) }, transaction });
    }
    await RoadmapStop.destroy({ where: { roadmapId: roadmap.id }, transaction });
    await roadmap.destroy({ transaction });
  });

export const findStopWithRoadmap = (id) =>
  RoadmapStop.findByPk(id, { include: [{ model: Roadmap, as: 'roadmap' }] });

export const createStop = (data, options = {}) =>
  RoadmapStop.create(data, options);

export const updateStop = (stop, data, options = {}) =>
  stop.update(data, options);

export const replaceStops = async (roadmapId, stops, transaction) => {
  await RoadmapStop.destroy({ where: { roadmapId }, transaction });
  if (stops.length) {
    await RoadmapStop.bulkCreate(stops.map((p) => ({ ...p, roadmapId })), { transaction });
  }
};

export const bulkCreateStops = (rows, transaction) =>
  RoadmapStop.bulkCreate(rows, { transaction });

export const findUserById = (userId) =>
  User.findByPk(userId);

export const findCompanyById = (companyId) =>
  Company.findByPk(companyId);

export const countCompaniesByIds = (ids, transaction) =>
  Company.count({ where: { id: ids }, transaction });

export const runTransaction = (fn) =>
  sequelize.transaction(fn);
