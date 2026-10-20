import { EMPLOYEE_ROLES } from './employee.entity.js';
import * as employeeRepository from './employee.repository.js';
import { badRequest, notFound } from '../../shared/utils/http.js';
import { dataUrl, parseDate, required, text, oneOf } from '../../shared/utils/validation.js';

const ROLE_FROM_JOB_TITLE = (jobTitle = '') => {
  const p = String(jobTitle).toLowerCase();
  if (p.includes('técnic') || p.includes('tecnic') || p.includes('aplicador') || p.includes('fumig')) return 'tecnico';
  if (p.includes('supervis')) return 'supervisor';
  if (p.includes('chofer') || p.includes('conductor')) return 'chofer';
  if (p.includes('admin')) return 'administrativo';
  return 'ayudante';
};

const employeeData = (b) => {
  const d = {};
  const set = (k, v) => { if (v !== undefined) d[k] = v; };
  set('fullName', text(b.fullName, 'fullName', 150));
  set('nationalId', text(b.nationalId, 'nationalId', 30));
  set('licenseNumber', text(b.licenseNumber, 'licenseNumber', 50));
  set('role', b.role !== undefined ? oneOf(b.role, EMPLOYEE_ROLES, 'role') : undefined);
  set('jobTitle', text(b.jobTitle, 'jobTitle', 100));
  set('phone', text(b.phone, 'phone', 50));
  set('email', text(b.email, 'email', 150));
  set('company', text(b.company, 'company', 150));
  set('hireDate', b.hireDate !== undefined ? parseDate(b.hireDate, 'hireDate') : undefined);
  set('active', b.active !== undefined ? Boolean(b.active) : undefined);
  set('notes', text(b.notes, 'notes', 5000));
  if (b.profileImage !== undefined) {
    d.profileImage = b.profileImage ? dataUrl(b.profileImage, 'profileImage', 3) : null;
    if (d.profileImage && !d.profileImage.startsWith('data:image/')) throw badRequest('La foto debe ser una imagen', { profileImage: 'typeNotAllowed' });
  }
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw badRequest('El email no es válido', { email: 'format' });
  return d;
};

// ?role=tecnico,supervisor&active=1 → selector de técnicos de la orden de servicio.
export const listEmployees = async (query = {}) => {
  const roles = query.role
    ? String(query.role).split(',').map((r) => oneOf(r.trim(), EMPLOYEE_ROLES, 'role'))
    : undefined;
  const active = query.active === '1';
  return employeeRepository.findAll({ roles, active });
};

export const getEmployee = async (id) => {
  const e = await employeeRepository.findById(id);
  if (!e) throw notFound('Empleado');
  return e;
};

export const createEmployee = async (body = {}) => {
  const d = employeeData(body);
  required(d, ['fullName']);
  return employeeRepository.create({ ...d, role: d.role || ROLE_FROM_JOB_TITLE(d.jobTitle) });
};

export const updateEmployee = async (id, body = {}) => {
  const e = await employeeRepository.findById(id);
  if (!e) throw notFound('Empleado');
  const d = employeeData(body);
  if (d.fullName === null) throw badRequest('El nombre no puede quedar vacío');
  await employeeRepository.update(e, d);
  return e;
};

// Si figura en órdenes de servicio se desactiva en lugar de borrarse.
export const removeEmployee = async (id) => {
  const e = await employeeRepository.findById(id);
  if (!e) throw notFound('Empleado');
  if (await employeeRepository.countOrdersForEmployee(e.id)) {
    await employeeRepository.update(e, { active: false });
    return { message: 'El empleado figura en órdenes de servicio: se desactivó en lugar de eliminarse.', data: e };
  }
  await employeeRepository.destroy(e);
  return { message: 'Empleado eliminado' };
};
