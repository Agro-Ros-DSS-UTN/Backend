import { Op } from 'sequelize';
import {
  Company, Contact, Opportunity, Task, ServiceOrder, Locality,
} from '../../shared/models/index.js';

export const globalSearch = async (query = '', { limit = 5, isSeller = false } = {}) => {
  const q = String(query || '').trim();
  if (!q || q.length < 2) {
    return { contacts: [], companies: [], deals: [], tasks: [], orders: [] };
  }

  const l = Math.min(20, Math.max(1, parseInt(limit, 10) || 5));

  const [companies, contacts, deals, tasks, orders] = await Promise.all([
    Company.findAll({
      where: {
        [Op.or]: [
          { legalName: { [Op.like]: `%${q}%` } },
          { tradeName: { [Op.like]: `%${q}%` } },
          { cuit: { [Op.like]: `%${q}%` } },
        ],
      },
      include: [{ model: Locality, as: 'locality', attributes: ['id', 'name'] }],
      attributes: ['id', 'legalName', 'tradeName', 'cuit', 'level'],
      limit: l,
    }),
    Contact.findAll({
      where: {
        [Op.or]: [
          { fullName: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
          { nationalId: { [Op.like]: `%${q}%` } },
        ],
      },
      attributes: ['id', 'fullName', 'email', 'nationalId'],
      limit: l,
    }),
    isSeller ? Promise.resolve([]) : Opportunity.findAll({
      where: {
        title: { [Op.like]: `%${q}%` },
      },
      include: [{ model: Company, as: 'company', attributes: ['id', 'legalName'], paranoid: false }],
      attributes: ['id', 'title', 'status'],
      limit: l,
    }),
    Task.findAll({
      where: {
        [Op.or]: [
          { title: { [Op.like]: `%${q}%` } },
          { description: { [Op.like]: `%${q}%` } },
        ],
      },
      attributes: ['id', 'title', 'description', 'status'],
      limit: l,
    }),
    isSeller ? Promise.resolve([]) : ServiceOrder.findAll({
      where: {
        [Op.or]: [
          { orderNumber: { [Op.like]: `%${q}%` } },
          { customerName: { [Op.like]: `%${q}%` } },
        ],
      },
      attributes: ['id', 'orderNumber', 'customerName', 'plantName', 'status'],
      limit: l,
    }),
  ]);

  return {
    companies: companies.map((c) => ({
      id: c.id,
      title: c.legalName || c.tradeName || 'Empresa',
      subtitle: [c.locality?.name, c.cuit].filter(Boolean).join(' · '),
      companyLevel: c.level,
    })),
    contacts: contacts.map((c) => ({
      id: c.id,
      title: c.fullName || 'Contacto',
      subtitle: c.email || c.nationalId || '',
    })),
    deals: deals.map((o) => ({
      id: o.id,
      title: o.title || 'Oportunidad',
      subtitle: [o.company?.legalName, o.status].filter(Boolean).join(' · '),
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title || t.description || 'Tarea',
      subtitle: t.status,
    })),
    orders: orders.map((o) => ({
      id: o.id,
      title: o.orderNumber || 'Orden de Servicio',
      subtitle: [o.customerName, o.plantName].filter(Boolean).join(' · '),
    })),
  };
};
