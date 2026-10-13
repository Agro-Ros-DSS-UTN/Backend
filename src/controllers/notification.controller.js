import { Op } from 'sequelize';
import { Notification } from '../models/index.js';
import { asyncHandler, idParam, notFound } from '../utils/http.js';

// Alta interna (desde otros controladores). Nunca interrumpe la operación principal.
export const createNotification = async (userId, type, message, entity = null, entityId = null) => {
  try {
    if (!userId) return null;
    return await Notification.create({ userId, type, message: String(message).slice(0, 255), entity, entityId: entityId !== null ? String(entityId) : null });
  } catch (e) {
    console.warn('[notificaciones] No se pudo registrar:', e.message);
    return null;
  }
};

// Cada usuario ve solo sus notificaciones.
export const list = asyncHandler(async (req, res) => {
  const where = { userId: req.user.idUser };
  if (req.query.unread === '1') where.isRead = false;
  const notifications = await Notification.findAll({ where, order: [['occurredAt', 'DESC']], limit: 100 });
  const unread = await Notification.count({ where: { userId: req.user.idUser, isRead: false } });
  res.json({ data: notifications, unread });
});

export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOne({ where: { id: idParam(req), userId: req.user.idUser } });
  if (!n) throw notFound('Notificación');
  await n.update({ isRead: true });
  res.json({ message: 'Notificación leída', data: n });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const [n] = await Notification.update({ isRead: true }, { where: { userId: req.user.idUser, isRead: false } });
  res.json({ message: `${n} notificaciones marcadas como leídas` });
});

export const clearRead = asyncHandler(async (req, res) => {
  const n = await Notification.destroy({ where: { userId: req.user.idUser, isRead: true, occurredAt: { [Op.lt]: new Date(Date.now() - 7 * 86400000) } } });
  res.json({ message: `${n} notificaciones antiguas eliminadas` });
});
