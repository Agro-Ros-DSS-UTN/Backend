/* eslint-disable */
import { Router } from 'express';
import {
  createTask,
  getAllTasks,
  updateTask,
  updateTaskStatus,
  deleteTask
} from '../controllers/task.controller.js';

const router = Router();

router.post('/tasks', createTask);
router.get('/tasks', getAllTasks);
router.put('/tasks/:id', updateTask);
router.patch('/tasks/:id/status', updateTaskStatus);
router.delete('/tasks/:id', deleteTask);

export default router;
