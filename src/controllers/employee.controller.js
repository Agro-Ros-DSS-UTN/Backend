/* eslint-disable */
import Employee from '../models/employee.model.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

const buildPayload = (b = {}) => ({
  nombreApellido: b.nombreApellido,
  dni: b.dni || null,
  matricula: b.matricula || null,
  puesto: b.puesto || 'Operario',
  telefono: b.telefono || null,
  email: b.email || null,
  empresa: b.empresa || null,
  fechaIngreso: b.fechaIngreso || null,
  activo: b.activo !== undefined ? Boolean(b.activo) : true,
  profileImage: b.profileImage !== undefined ? b.profileImage : null,
  observaciones: b.observaciones || null
});

export const getAllEmployees = asyncHandler(async (req, res) => {
  const employees = await Employee.findAll({ order: [['nombreApellido', 'ASC']] });
  return res.status(200).json({ message: 'Empleados obtenidos exitosamente', data: employees });
});

export const getEmployeeById = asyncHandler(async (req, res) => {
  const employee = await Employee.findByPk(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Empleado no encontrado' });
  return res.status(200).json({ data: employee });
});

export const createEmployee = asyncHandler(async (req, res) => {
  if (!req.body?.nombreApellido) {
    return res.status(400).json({ message: 'El nombre y apellido del empleado es obligatorio' });
  }
  const employee = await Employee.create(buildPayload(req.body));
  return res.status(201).json({ message: 'Empleado registrado exitosamente', data: employee });
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByPk(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Empleado no encontrado' });

  const current = employee.toJSON();
  await employee.update(buildPayload({ ...current, ...req.body }));
  return res.status(200).json({ message: 'Empleado actualizado exitosamente', data: employee });
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByPk(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Empleado no encontrado' });
  await employee.destroy();
  return res.status(200).json({ message: 'Empleado eliminado exitosamente', id: Number(req.params.id) });
});
