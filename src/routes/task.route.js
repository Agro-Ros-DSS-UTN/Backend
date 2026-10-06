/* eslint-disable */
import { Router } from 'express';
import {
  createTask,
  getAllTasks,
  updateTask,
  updateTaskStatus,
  finalizeTask,
  deleteTask
} from '../controllers/task.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/tasks', createTask);
router.get('/tasks', getAllTasks);
router.put('/tasks/:id', updateTask);
// Ambas necesitan saber quién finaliza para aplicar el control de permisos.
router.patch('/tasks/:id/status', verifyToken, updateTaskStatus);
router.patch('/tasks/:id/finalizar', verifyToken, finalizeTask);
router.delete('/tasks/:id', deleteTask);

export default router;
