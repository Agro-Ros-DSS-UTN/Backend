import { Op } from 'sequelize';
import { Employee, ServiceOrderEmployee } from '../../shared/models/index.js';

export const findAll = ({ roles, active }) => {
  const where = {};
  if (roles) where.role = { [Op.in]: roles };
  if (active) where.active = true;
  return Employee.findAll({ where, order: [['fullName', 'ASC']] });
};

export const findById = (id, options = {}) =>
  Employee.findByPk(id, options);

export const findOne = (where, options = {}) =>
  Employee.findOne({ where, ...options });

export const create = (data, options = {}) =>
  Employee.create(data, options);

export const update = (employee, data, options = {}) =>
  employee.update(data, options);

export const destroy = (employee, options = {}) =>
  employee.destroy(options);

export const countOrdersForEmployee = (employeeId) =>
  ServiceOrderEmployee.count({ where: { employeeId } });
