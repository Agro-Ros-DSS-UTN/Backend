import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as notificationService from './notification.service.js';

export { createNotification } from './notification.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await notificationService.listNotifications(req.user.idUser, req.query);
  res.json(result);
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
