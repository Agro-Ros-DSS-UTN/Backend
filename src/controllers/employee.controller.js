import { Op } from 'sequelize';
import { Employee, ServiceOrderEmployee } from '../models/index.js';
import { EMPLOYEE_ROLES } from '../models/services.model.js';
import { asyncHandler, badRequest, idParam, notFound } from '../utils/http.js';
import { dataUrl, parseDate, required, text, oneOf } from '../utils/validation.js';

const ROLE_FROM_JOB_TITLE = (jobTitle = '') => {
  const p = String(jobTitle).toLowerCase();
  if (p.includes('técnic') || p.includes('tecnic') || p.includes('aplicador') || p.includes('fumig')) return 'tecnico';
  if (p.includes('supervis')) return 'supervisor';
  if (p.includes('chofer') || p.includes('conductor')) return 'chofer';
  if (p.includes('admin')) return 'administrativo';
  return 'ayudante';
};

const data = (b) => {
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
export const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.role) where.role = { [Op.in]: String(req.query.role).split(',').map((r) => oneOf(r.trim(), EMPLOYEE_ROLES, 'role')) };
  if (req.query.active === '1') where.active = true;
  const employees = await Employee.findAll({ where, order: [['fullName', 'ASC']] });
  res.json({ data: employees });
});

export const get = asyncHandler(async (req, res) => {
  const e = await Employee.findByPk(idParam(req));
  if (!e) throw notFound('Empleado');
  res.json({ data: e });
});

export const create = asyncHandler(async (req, res) => {
  const d = data(req.body || {});
  required(d, ['fullName']);
  const e = await Employee.create({ ...d, role: d.role || ROLE_FROM_JOB_TITLE(d.jobTitle) });
  res.status(201).json({ message: 'Empleado creado', data: e });
});

export const update = asyncHandler(async (req, res) => {
  const e = await Employee.findByPk(idParam(req));
  if (!e) throw notFound('Empleado');
  const d = data(req.body || {});
  if (d.fullName === null) throw badRequest('El nombre no puede quedar vacío');
  await e.update(d);
  res.json({ message: 'Empleado actualizado', data: e });
});

// Si figura en órdenes de servicio se desactiva en lugar de borrarse.
export const remove = asyncHandler(async (req, res) => {
  const e = await Employee.findByPk(idParam(req));
  if (!e) throw notFound('Empleado');
  if (await ServiceOrderEmployee.count({ where: { employeeId: e.id } })) {
    await e.update({ active: false });
    return res.json({ message: 'El empleado figura en órdenes de servicio: se desactivó en lugar de eliminarse.', data: e });
  }
  await e.destroy();
  res.json({ message: 'Empleado eliminado' });
});
