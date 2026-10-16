import { Op } from 'sequelize';
import { Notification } from '../../shared/models/index.js';

export const create = (data) =>
  Notification.create(data);

export const findAllByUser = ({ userId, unreadOnly }) => {
  const where = { userId };
  if (unreadOnly) where.isRead = false;
  return Notification.findAll({
    where,
    order: [['occurredAt', 'DESC']],
    limit: 100,
  });
};

export const countUnreadByUser = (userId) =>
  Notification.count({ where: { userId, isRead: false } });

export const findOneByIdAndUser = (id, userId) =>
  Notification.findOne({ where: { id, userId } });

export const update = (notification, data) =>
  notification.update(data);

export const markAllReadForUser = async (userId) => {
  const [n] = await Notification.update(
    { isRead: true },
    { where: { userId, isRead: false } }
  );
  return n;
};

export const clearReadOlderThan = (userId, cutoffDate) =>
  Notification.destroy({
    where: {
      userId,
      isRead: true,
      occurredAt: { [Op.lt]: cutoffDate },
    },
  });
