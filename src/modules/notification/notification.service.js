import { Op } from 'sequelize';
import * as notificationRepository from './notification.repository.js';
import { Task, Promotion, ServiceEvaluation } from '../../shared/models/index.js';
import { notFound } from '../../shared/utils/http.js';


// Alta interna (desde otros servicios). Nunca interrumpe la operación principal.
export const createNotification = async (userId, type, message, entity = null, entityId = null) => {
  try {
    if (!userId) return null;
    return await notificationRepository.create({
      userId,
      type,
      message: String(message).slice(0, 255),
      entity,
      entityId: entityId !== null ? String(entityId) : null,
    });
  } catch (e) {
    console.warn('[notificaciones] No se pudo registrar:', e.message);
    return null;
  }
};

// Cada usuario ve solo sus notificaciones.
export const listNotifications = async (userId, query = {}) => {
  const unreadOnly = query.unread === '1';
  const [notifications, unread] = await Promise.all([
    notificationRepository.findAllByUser({ userId, unreadOnly }),
    notificationRepository.countUnreadByUser(userId),
  ]);
  return { data: notifications, unread };
};

export const markNotificationRead = async (id, userId) => {
  const n = await notificationRepository.findOneByIdAndUser(id, userId);
  if (!n) throw notFound('Notificación');
  await notificationRepository.update(n, { isRead: true });
  return n;
};

export const markAllNotificationsRead = async (userId) => {
  const count = await notificationRepository.markAllReadForUser(userId);
  return { message: `${count} notificaciones marcadas como leídas` };
};

export const clearReadNotifications = async (userId) => {
  const cutoffDate = new Date(Date.now() - 7 * 86400000);
  const count = await notificationRepository.clearReadOlderThan(userId, cutoffDate);
  return { message: `${count} notificaciones antiguas eliminadas` };
};

export const getNotificationSummary = async (userId, { admin = false } = {}) => {
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [unreadCount, overdueTasksCount, expiringPromotions, alertEvaluationsCount] = await Promise.all([
    notificationRepository.countUnreadByUser(userId),
    Task.count({
      where: {
        status: 'Pendiente',
        dueDate: { [Op.lt]: today },
        ...(admin ? {} : { createdById: userId }),
      },
    }),
    Promotion.findAll({
      where: {
        endDate: { [Op.gte]: today, [Op.lte]: nextWeek },
        status: 'Activa',
      },
      attributes: ['id', 'name', 'endDate'],
      limit: 5,
    }),
    admin ? ServiceEvaluation.count({
      where: {
        result: { [Op.in]: ['Con insectos vivos', 'Refumigación'] },
      },
    }) : Promise.resolve(0),
  ]);

  return {
    unread: unreadCount,
    overdueTasksCount,
    expiringPromotions: expiringPromotions.map((p) => {
      const msDiff = new Date(p.endDate).getTime() - new Date(today).getTime();
      const days = Math.max(0, Math.ceil(msDiff / 86400000));
      return { id: p.id, name: p.name, endDate: p.endDate, daysLeft: days };
    }),
    alertEvaluationsCount,
  };
};

