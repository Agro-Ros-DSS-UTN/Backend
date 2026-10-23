import { asyncHandler, idParam } from '../../shared/utils/http.js';
import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as notificationService from './notification.service.js';

export { createNotification } from './notification.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await notificationService.listNotifications(req.user.idUser, req.query);
  res.json(result);
});

export const summary = asyncHandler(async (req, res) => {
  const data = await notificationService.getNotificationSummary(req.user.idUser || req.user.id, {
    admin: isAdmin(req),
  });
  res.json({ data });
});

export const markRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markNotificationRead(idParam(req), req.user.idUser);
  res.json({ message: 'Notificación leída', data });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsRead(req.user.idUser);
  res.json(result);
});

export const clearRead = asyncHandler(async (req, res) => {
  const result = await notificationService.clearReadNotifications(req.user.idUser);
  res.json(result);
});
