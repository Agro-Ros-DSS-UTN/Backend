/* eslint-disable */
import { Router } from 'express';
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
} from '../controllers/employee.controller.js';

const router = Router();

router.get('/empleados', getAllEmployees);
router.get('/empleados/:id', getEmployeeById);
router.post('/empleados', createEmployee);
router.put('/empleados/:id', updateEmployee);
router.delete('/empleados/:id', deleteEmployee);

export default router;
