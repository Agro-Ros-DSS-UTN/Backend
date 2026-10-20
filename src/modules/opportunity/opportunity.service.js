import { OPEN_STATUSES, OPPORTUNITY_STATUSES } from './opportunity.entity.js';
import * as opportunityRepository from './opportunity.repository.js';
import { badRequest, forbidden, notFound, pick, toInt } from '../../shared/utils/http.js';
import { number, parseDate, required, text, oneOf } from '../../shared/utils/validation.js';

export { includeOpportunity } from './opportunity.repository.js';

// Estados v1 que todavía puede mandar alguna pantalla vieja (valores, no nombres).
const V1_STATUS = {
  Lead: 'Prospecto', Prospecto: 'Prospecto', 'Negociación': 'Cotizado', Negociacion: 'Cotizado',
  Activo: 'Ganada', Inactivo: 'Perdida', Perdido: 'Perdida', Ganado: 'Ganada',
};
const normalizeStatus = (e) => (e === undefined || e === null || e === '' ? e : (OPPORTUNITY_STATUSES.includes(e) ? e : V1_STATUS[e] || e));

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
  if (d.companyId && !(await opportunityRepository.findCompanyById(d.companyId, { transaction }))) {
    throw badRequest('La empresa indicada no existe', { companyId: 'missing' });
  }
  if (d.contactId) {
    const c = await opportunityRepository.findContactById(d.contactId, { transaction });
    if (!c) throw badRequest('El contacto indicado no existe', { contactId: 'missing' });
    if (d.companyId && c.companyId && c.companyId !== d.companyId) {
      throw badRequest('El contacto pertenece a otra empresa', { contactId: 'otherCompany' });
    }
  }
  if (d.userId && !(await opportunityRepository.findUserById(d.userId, { transaction }))) {
    throw badRequest('El responsable indicado no existe', { userId: 'missing' });
  }
};

// Un vendedor ve y edita sus oportunidades y las que no tienen responsable.
const canView = ({ admin, currentUserId }, o) => admin || !o.userId || o.userId === currentUserId;

const saveItems = async (opportunity, items, transaction) => {
  if (!Array.isArray(items)) return;
  const rows = items
    .map((i) => (typeof i === 'object' ? { itemId: toInt(i.itemId ?? i.id), quantity: number(i.quantity, 'quantity', { min: 0 }) } : { itemId: toInt(i), quantity: null }))
    .filter((i) => i.itemId && !Number.isNaN(i.itemId));
  const uniqueIds = [...new Set(rows.map((f) => f.itemId))];
  if (rows.length && (await opportunityRepository.countCatalogItemsByIds(uniqueIds, transaction)) !== uniqueIds.length) {
    throw badRequest('Algún ítem del catálogo no existe', { items: 'missing' });
  }
  await opportunityRepository.replaceItems(opportunity, rows, transaction);
};

// Crea una oportunidad dentro de una transacción. Lo usa también el registro de actividad (alta en línea).
export const createOpportunityInTransaction = async ({ admin, currentUserId }, body, transaction) => {
  const d = opportunityData(body);
  if (!d.title) {
    const e = d.companyId ? await opportunityRepository.findCompanyById(d.companyId, { transaction }) : null;
    d.title = e ? `Seguimiento comercial — ${e.legalName}` : null;
  }
  required(d, ['title', 'companyId']);
  if (!admin) d.userId = currentUserId; // el vendedor solo crea a su nombre
  else if (d.userId === undefined) d.userId = currentUserId;
  await validateReferences(d, transaction);
  const o = await opportunityRepository.create(
    { ...d, status: d.status || 'Prospecto', lastActivityAt: new Date(), createdById: currentUserId },
    { transaction }
  );
  await saveItems(o, body.items, transaction);
  return o;
};

// Compatibilidad con llamadas que reciben (req, body, transaction)
export const createOpportunity = async (reqOrAuth, body, transaction) => {
  const auth = reqOrAuth?.user
    ? { admin: reqOrAuth.user?.role === 'admin', currentUserId: reqOrAuth.user.idUser }
    : reqOrAuth;
  return createOpportunityInTransaction(auth, body, transaction);
};

export const listOpportunities = async (query = {}, { admin, currentUserId }) => {
  const status = query.status ? normalizeStatus(String(query.status)) : undefined;
  const open = query.open === '1';
  const companyId = query.companyId ? toInt(query.companyId) : undefined;
  const forActivity = query.forActivity === '1' && Boolean(companyId);
  const limit = Math.min(Number(query.limit) || 1000, 2000);
  const paranoid = !(admin && query.includeDeleted === '1');
  const opportunities = await opportunityRepository.findAll({
    status,
    open,
    companyId,
    forActivity,
    admin,
    currentUserId,
    userId: query.userId,
    limit,
    paranoid,
  });
  return opportunities.map(serializeOpportunity);
};

export const getOpportunity = async (id, { admin, currentUserId }) => {
  const o = await opportunityRepository.findByIdFull(id);
  if (!o) throw notFound('Oportunidad');
  if (!canView({ admin, currentUserId }, o)) throw forbidden('Esta oportunidad está asignada a otro vendedor');
  return { ...serializeOpportunity(o), serviceOrders: o.serviceOrders };
};

export const createNewOpportunity = async (body = {}, { admin, currentUserId }) => {
  const o = await opportunityRepository.runTransaction((transaction) =>
    createOpportunityInTransaction({ admin, currentUserId }, body, transaction)
  );
  const full = await opportunityRepository.findByIdWithSummary(o.id);
  return serializeOpportunity(full);
};

export const updateOpportunity = async (id, body = {}, { admin, currentUserId }) => {
  const o = await opportunityRepository.findById(id);
  if (!o) throw notFound('Oportunidad');
  if (!canView({ admin, currentUserId }, o)) throw forbidden('Esta oportunidad está asignada a otro vendedor');
  const d = opportunityData(body);
  if (d.title === null) throw badRequest('El título no puede quedar vacío');
  if (!admin && d.userId !== undefined && d.userId !== currentUserId) {
    if (d.userId === o.userId) delete d.userId;
    else throw forbidden('Solo la administración puede reasignar oportunidades');
  }
  if (d.status && d.status !== 'Perdida') d.lossReason = d.lossReason ?? null;
  await opportunityRepository.runTransaction(async (transaction) => {
    await validateReferences(d, transaction);
    await opportunityRepository.update(o, { ...d, lastActivityAt: new Date() }, { transaction });
    await saveItems(o, body?.items, transaction);
  });
  const full = await opportunityRepository.findByIdWithSummary(o.id);
  return serializeOpportunity(full);
};

export const removeOpportunity = async (id, { admin, currentUserId }) => {
  const o = await opportunityRepository.findById(id);
  if (!o) throw notFound('Oportunidad');
  // P-3: el vendedor solo da de baja las oportunidades que cargó él, y siempre que no
  // tengan actividades de otros usuarios (la visibilidad es global, ver P-4).
  if (!admin) {
    if (o.createdById !== currentUserId) {
      throw forbidden('Solo podés dar de baja las oportunidades que cargaste vos. Pedíselo a la administración.');
    }
    const others = await opportunityRepository.countOtherUsersActivities(o.id, currentUserId);
    if (others) {
      throw forbidden(`La oportunidad tiene ${others} actividad(es) de otros usuarios. Pedile la baja a la administración.`);
    }
  }
  await opportunityRepository.destroy(o);
  return { message: 'Oportunidad dada de baja (sus actividades se conservan)' };
};

export const restoreOpportunity = async (id) => {
  const o = await opportunityRepository.findById(id, { paranoid: false });
  if (!o) throw notFound('Oportunidad');
  await opportunityRepository.restore(o);
  return serializeOpportunity(o);
};
