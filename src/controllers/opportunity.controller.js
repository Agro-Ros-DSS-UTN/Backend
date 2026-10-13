import { Op } from 'sequelize';
import {
  sequelize, Opportunity, Company, User, Contact, Activity, CatalogItem, ServiceOrder,
} from '../models/index.js';
import { OPEN_STATUSES, OPPORTUNITY_STATUSES } from '../models/commercial.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, forbidden, idParam, notFound, pick, toInt } from '../utils/http.js';
import { number, parseDate, required, text, oneOf } from '../utils/validation.js';

// Estados v1 que todavía puede mandar alguna pantalla vieja (valores, no nombres).
const V1_STATUS = {
  Lead: 'Prospecto', Prospecto: 'Prospecto', 'Negociación': 'Cotizado', Negociacion: 'Cotizado',
  Activo: 'Ganada', Inactivo: 'Perdida', Perdido: 'Perdida', Ganado: 'Ganada',
};
const normalizeStatus = (e) => (e === undefined || e === null || e === '' ? e : (OPPORTUNITY_STATUSES.includes(e) ? e : V1_STATUS[e] || e));

export const includeOpportunity = [
  { model: Company, as: 'company', attributes: ['id', 'legalName', 'localityId'], paranoid: false },
  { model: User, as: 'owner', attributes: ['idUser', 'fullName', 'role'] },
  { model: Contact, as: 'contact', attributes: ['id', 'fullName', 'nationalId'], paranoid: false },
];

export const serializeOpportunity = (o) => {
  if (!o) return null;
  const j = typeof o.toJSON === 'function' ? o.toJSON() : o;
  const num = (v) => (v !== null && v !== undefined ? Number(v) : null);
  return {
    id: j.id,
    title: j.title,
    status: j.status,
    open: OPEN_STATUSES.includes(j.status),
    potential: j.potential ?? null,
    potentialVolume: num(j.potentialVolume),
    billedVolume: num(j.billedVolume),
    startDate: j.startDate,
    expectedCloseDate: j.expectedCloseDate ?? null,
    lastActivityAt: j.lastActivityAt ?? null,
    daysWithoutContact: j.daysWithoutContact ?? null,
    lossReason: j.lossReason ?? null,
    companyId: j.companyId ?? null,
    company: j.company?.legalName ?? null,
    userId: j.userId ?? null,
    createdById: j.createdById ?? null,
    owner: j.owner ? { idUser: j.owner.idUser, fullName: j.owner.fullName } : null,
    contactId: j.contactId ?? null,
    contact: j.contact ? { id: j.contact.id, fullName: j.contact.fullName } : null,
    items: Array.isArray(j.items) ? j.items.map((i) => ({ id: i.id, name: i.name, type: i.type, quantity: i.OpportunityItem?.quantity !== undefined ? num(i.OpportunityItem.quantity) : null })) : undefined,
    activities: j.activities,
    activityCount: j.activityCount !== undefined ? Number(j.activityCount) : undefined,
    deletedAt: j.deletedAt ?? null,
    // compatibilidad v1
    dealName: j.title,
    customerPotential: j.potential ?? null,
    closeDate: j.expectedCloseDate ?? null,
    clientCompanyId: j.companyId ?? null,
    ClientCompany: j.company ? { id: j.company.id, companyName: j.company.legalName } : null,
    ownerId: j.userId ?? null,
    ownerName: j.owner?.fullName ?? null,
    contactName: j.contact?.fullName ?? null,
  };
};

const opportunityData = (b) => {
  const d = pick({
    ...b,
    title: b.title ?? b.dealName,
    potential: b.potential ?? b.customerPotential,
    expectedCloseDate: b.expectedCloseDate !== undefined ? b.expectedCloseDate : b.closeDate,
    companyId: b.companyId !== undefined ? b.companyId : b.clientCompanyId,
    userId: b.userId !== undefined ? b.userId : b.ownerId,
    status: normalizeStatus(b.status),
  }, ['title', 'status', 'potential', 'potentialVolume', 'billedVolume', 'expectedCloseDate', 'lossReason', 'companyId', 'userId', 'contactId']);
  if (d.title !== undefined) d.title = text(d.title, 'title', 200);
  if (d.status !== undefined) d.status = oneOf(d.status, OPPORTUNITY_STATUSES, 'status');
  if (d.potential !== undefined) d.potential = text(d.potential, 'potential', 50);
  if (d.potentialVolume !== undefined) d.potentialVolume = number(d.potentialVolume, 'potentialVolume', { min: 0 });
  if (d.billedVolume !== undefined) d.billedVolume = number(d.billedVolume, 'billedVolume', { min: 0 });
  if (d.expectedCloseDate !== undefined) d.expectedCloseDate = parseDate(d.expectedCloseDate, 'expectedCloseDate');
  if (d.lossReason !== undefined) d.lossReason = text(d.lossReason, 'lossReason', 255);
  if (d.companyId !== undefined) d.companyId = d.companyId ? toInt(d.companyId) : null;
  if (d.contactId !== undefined) d.contactId = d.contactId ? toInt(d.contactId) : null;
  if (d.userId !== undefined) d.userId = d.userId ? String(d.userId) : null;
  return d;
};

const validateReferences = async (d, transaction) => {
  if (d.companyId && !(await Company.findByPk(d.companyId, { transaction }))) throw badRequest('La empresa indicada no existe', { companyId: 'missing' });
  if (d.contactId) {
    const c = await Contact.findByPk(d.contactId, { transaction });
    if (!c) throw badRequest('El contacto indicado no existe', { contactId: 'missing' });
    if (d.companyId && c.companyId && c.companyId !== d.companyId) throw badRequest('El contacto pertenece a otra empresa', { contactId: 'otherCompany' });
  }
  if (d.userId && !(await User.findByPk(d.userId, { transaction }))) throw badRequest('El responsable indicado no existe', { userId: 'missing' });
};

// Un vendedor ve y edita sus oportunidades y las que no tienen responsable.
const canView = (req, o) => isAdmin(req) || !o.userId || o.userId === req.user.idUser;

export const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = normalizeStatus(String(req.query.status));
  if (req.query.open === '1') where.status = { [Op.in]: OPEN_STATUSES };
  if (req.query.companyId) where.companyId = toInt(req.query.companyId);
  // Para registrar una actividad, el vendedor necesita ver las oportunidades
  // abiertas de la empresa aunque estén a nombre de otro vendedor.
  const forActivity = req.query.forActivity === '1' && where.companyId;
  if (!isAdmin(req) && !forActivity) where[Op.or] = [{ userId: req.user.idUser }, { userId: null }];
  else if (isAdmin(req) && req.query.userId) where.userId = String(req.query.userId);
  const opportunities = await Opportunity.findAll({
    where,
    include: includeOpportunity,
    attributes: { include: [[sequelize.literal('(SELECT COUNT(*) FROM activities a WHERE a.opportunity_id = Opportunity.id)'), 'activityCount']] },
    order: [['lastActivityAt', 'DESC'], ['id', 'DESC']],
    limit: Math.min(Number(req.query.limit) || 1000, 2000),
    paranoid: !(isAdmin(req) && req.query.includeDeleted === '1'),
  });
  res.json({ data: opportunities.map(serializeOpportunity) });
});

export const get = asyncHandler(async (req, res) => {
  const o = await Opportunity.findByPk(idParam(req), {
    include: [
      ...includeOpportunity,
      { model: CatalogItem, as: 'items', attributes: ['id', 'name', 'type'], through: { attributes: ['quantity'] } },
      { model: Activity, as: 'activities', include: [{ model: User, as: 'author', attributes: ['idUser', 'fullName'] }] },
      { model: ServiceOrder, as: 'serviceOrders', attributes: ['id', 'orderNumber', 'status', 'scheduledDate'] },
    ],
    order: [[{ model: Activity, as: 'activities' }, 'occurredAt', 'DESC']],
  });
  if (!o) throw notFound('Oportunidad');
  if (!canView(req, o)) throw forbidden('Esta oportunidad está asignada a otro vendedor');
  res.json({ data: { ...serializeOpportunity(o), serviceOrders: o.serviceOrders } });
});

const saveItems = async (opportunity, items, transaction) => {
  if (!Array.isArray(items)) return;
  const rows = items
    .map((i) => (typeof i === 'object' ? { itemId: toInt(i.itemId ?? i.id), quantity: number(i.quantity, 'quantity', { min: 0 }) } : { itemId: toInt(i), quantity: null }))
    .filter((i) => i.itemId && !Number.isNaN(i.itemId));
  if (rows.length && (await CatalogItem.count({ where: { id: { [Op.in]: rows.map((f) => f.itemId) } }, transaction })) !== new Set(rows.map((f) => f.itemId)).size) {
    throw badRequest('Algún ítem del catálogo no existe', { items: 'missing' });
  }
  await opportunity.setItems([], { transaction });
  for (const f of rows) await opportunity.addItem(f.itemId, { through: { quantity: f.quantity }, transaction });
};

// Crea una oportunidad. Lo usa también el registro de actividad (alta en línea).
export const createOpportunity = async (req, body, transaction) => {
  const d = opportunityData(body);
  if (!d.title) {
    const e = d.companyId ? await Company.findByPk(d.companyId, { transaction }) : null;
    d.title = e ? `Seguimiento comercial — ${e.legalName}` : null;
  }
  required(d, ['title', 'companyId']);
  if (!isAdmin(req)) d.userId = req.user.idUser; // el vendedor solo crea a su nombre
  else if (d.userId === undefined) d.userId = req.user.idUser;
  await validateReferences(d, transaction);
  const o = await Opportunity.create({ ...d, status: d.status || 'Prospecto', lastActivityAt: new Date(), createdById: req.user.idUser }, { transaction });
  await saveItems(o, body.items, transaction);
  return o;
};

export const create = asyncHandler(async (req, res) => {
  const o = await sequelize.transaction((transaction) => createOpportunity(req, req.body || {}, transaction));
  const full = await Opportunity.findByPk(o.id, { include: includeOpportunity });
  res.status(201).json({ message: 'Oportunidad creada', data: serializeOpportunity(full) });
});

export const update = asyncHandler(async (req, res) => {
  const o = await Opportunity.findByPk(idParam(req));
  if (!o) throw notFound('Oportunidad');
  if (!canView(req, o)) throw forbidden('Esta oportunidad está asignada a otro vendedor');
  const d = opportunityData(req.body || {});
  if (d.title === null) throw badRequest('El título no puede quedar vacío');
  if (!isAdmin(req) && d.userId !== undefined && d.userId !== req.user.idUser) {
    if (d.userId === o.userId) delete d.userId;
    else throw forbidden('Solo la administración puede reasignar oportunidades');
  }
  if (d.status && d.status !== 'Perdida') d.lossReason = d.lossReason ?? null;
  await sequelize.transaction(async (transaction) => {
    await validateReferences(d, transaction);
    await o.update({ ...d, lastActivityAt: new Date() }, { transaction });
    await saveItems(o, req.body?.items, transaction);
  });
  const full = await Opportunity.findByPk(o.id, { include: includeOpportunity });
  res.json({ message: 'Oportunidad actualizada', data: serializeOpportunity(full) });
});

export const remove = asyncHandler(async (req, res) => {
  const o = await Opportunity.findByPk(idParam(req));
  if (!o) throw notFound('Oportunidad');
  // P-3: el vendedor solo da de baja las oportunidades que cargó él, y siempre que no
  // tengan actividades de otros usuarios (la visibilidad es global, ver P-4).
  if (!isAdmin(req)) {
    if (o.createdById !== req.user.idUser) throw forbidden('Solo podés dar de baja las oportunidades que cargaste vos. Pedíselo a la administración.');
    const others = await Activity.count({ where: { opportunityId: o.id, userId: { [Op.ne]: req.user.idUser } } });
    if (others) throw forbidden(`La oportunidad tiene ${others} actividad(es) de otros usuarios. Pedile la baja a la administración.`);
  }
  await o.destroy();
  res.json({ message: 'Oportunidad dada de baja (sus actividades se conservan)' });
});

export const restore = asyncHandler(async (req, res) => {
  const o = await Opportunity.findByPk(idParam(req), { paranoid: false });
  if (!o) throw notFound('Oportunidad');
  await o.restore();
  res.json({ message: 'Oportunidad restaurada', data: serializeOpportunity(o) });
});
