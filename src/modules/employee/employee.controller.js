import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as employeeService from './employee.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await employeeService.listEmployees(req.query);
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await employeeService.getEmployee(idParam(req));
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await employeeService.createEmployee(req.body);
  res.status(201).json({ message: 'Empleado creado', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await employeeService.updateEmployee(idParam(req), req.body);
  res.json({ message: 'Empleado actualizado', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await employeeService.removeEmployee(idParam(req));
  res.json(result);
});
