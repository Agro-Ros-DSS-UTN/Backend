/* eslint-disable */
import { Router } from 'express';
import { createTask, getAllTasks, updateTaskStatus } from '../controllers/task.controller.js';

const router = Router();

router.post('/tasks', createTask);
router.get('/tasks', getAllTasks);
router.patch('/tasks/:id/status', updateTaskStatus);

export default router;
