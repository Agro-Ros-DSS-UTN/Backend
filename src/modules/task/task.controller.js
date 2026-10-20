import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as taskService from './task.service.js';

export { serializeTask } from './task.service.js';

const authOf = (req) => ({
  admin: isAdmin(req),
  currentUserId: req.user.idUser,
  currentUserFullName: req.user.fullName,
});

export const list = asyncHandler(async (req, res) => {
  const data = await taskService.listTasks(req.query, authOf(req));
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await taskService.getTask(idParam(req), authOf(req));
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await taskService.createTask(req.body, authOf(req));
  res.status(201).json({ message: 'Tarea creada', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await taskService.updateTask(idParam(req), req.body, authOf(req));
  res.json({ message: 'Tarea actualizada', data });
});

export const complete = asyncHandler(async (req, res) => {
  const data = await taskService.completeTask(idParam(req), authOf(req));
  res.json({ message: 'Tarea finalizada', data });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const result = await taskService.changeTaskStatus(idParam(req), req.body, authOf(req));
  res.json(result);
});

export const remove = asyncHandler(async (req, res) => {
  const result = await taskService.removeTask(idParam(req), authOf(req));
  res.json(result);
});
