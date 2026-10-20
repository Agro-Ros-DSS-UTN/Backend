import * as notificationRepository from './notification.repository.js';
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
