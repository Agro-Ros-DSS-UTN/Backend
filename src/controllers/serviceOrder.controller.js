import { Op } from 'sequelize';
import {
  sequelize, ServiceOrder, AppliedProduct, ServiceEvaluation, Employee, Company, CatalogItem, Opportunity, User, Activity,
} from '../models/index.js';
import { SERVICE_ORDER_STATUSES, EVALUATION_RESULTS, ORDER_EXECUTOR_ROLES } from '../models/services.model.js';
import { asyncHandler, badRequest, conflict, idParam, notFound, toInt } from '../utils/http.js';
import { dataUrl, number, parseDate, text, oneOf } from '../utils/validation.js';

const include = [
  { model: AppliedProduct, as: 'appliedProducts', include: [{ model: CatalogItem, as: 'item', attributes: ['id', 'name'] }] },
  { model: ServiceEvaluation, as: 'evaluation' },
  { model: Employee, as: 'technicians', attributes: ['id', 'fullName', 'licenseNumber', 'role'], through: { attributes: [] } },
  { model: Company, as: 'company', attributes: ['id', 'legalName', 'cuit'], paranoid: false },
  { model: CatalogItem, as: 'service', attributes: ['id', 'name', 'serviceType'] },
  { model: Opportunity, as: 'opportunity', attributes: ['id', 'title', 'status'], paranoid: false },
  { model: User, as: 'createdBy', attributes: ['idUser', 'fullName'] },
];

export const serializeServiceOrder = (o) => {
  if (!o) return null;
  const j = typeof o.toJSON === 'function' ? o.toJSON() : o;
  const technicians = (j.technicians || []).map((t) => ({ id: t.id, fullName: t.fullName, licenseNumber: t.licenseNumber }));
  const ev = j.evaluation
    ? { ...j.evaluation, efficacy: j.evaluation.efficacy, ppmPH3: j.evaluation.ppmPH3 !== null && j.evaluation.ppmPH3 !== undefined ? Number(j.evaluation.ppmPH3) : null }
    : null;
  return {
    ...j,
    technicians,
    technicianIds: technicians.map((t) => t.id),
    evaluation: ev,
    company: j.company ? { id: j.company.id, legalName: j.company.legalName, cuit: j.company.cuit } : null,
    service: j.service ? { id: j.service.id, name: j.service.name, serviceType: j.service.serviceType } : null,
    // compatibilidad v1
    date: j.scheduledDate,
    orderNotes: j.notes ?? null,
    technicianName: technicians.map((t) => t.fullName).join(', ') || null,
  };
};

const detailRow = (p, i) => {
  const t = (k, max = 150) => text(p[k], `appliedProducts[${i}].${k}`, max) ?? null;
  const itemId = toInt(p.itemId);
  return {
    itemId: itemId && !Number.isNaN(itemId) ? itemId : null,
    facilityType: t('facilityType', 40), number: t('number', 20), capacityTn: t('capacityTn', 20), grain: t('grain', 60),
    quantityTn: t('quantityTn', 20), grainCondition: t('grainCondition', 10), facilityCondition: t('facilityCondition', 10),
    infestationLevel: t('infestationLevel', 10), product: t('product'), activeIngredient: t('activeIngredient'),
    dose: t('dose', 100), batch: t('batch', 100), withdrawalPeriod: t('withdrawalPeriod', 100), totalQuantity: t('totalQuantity', 100),
  };
};

const image = (v, field) => {
  if (v === undefined) return undefined;
  if (!v) return null;
  const s = dataUrl(v, field, 8);
  if (!/^data:(image\/|application\/pdf)/i.test(s)) throw badRequest(`${field}: solo se aceptan imágenes o PDF`, { [field]: 'typeNotAllowed' });
  return s;
};

const orderData = (b) => {
  const d = {};
  const set = (k, v) => { if (v !== undefined) d[k] = v; };
  set('orderNumber', text(b.orderNumber, 'orderNumber', 50));
  const fp = b.scheduledDate !== undefined ? b.scheduledDate : b.date;
  set('scheduledDate', fp !== undefined ? parseDate(fp, 'scheduledDate') : undefined);
  set('completedDate', b.completedDate !== undefined ? parseDate(b.completedDate, 'completedDate') : undefined);
  set('status', b.status !== undefined ? oneOf(b.status, SERVICE_ORDER_STATUSES, 'status') : undefined);
  for (const [k, max] of [['customerCode', 50], ['customerName', 150], ['centerCode', 50], ['centerName', 150], ['plantCode', 50], ['plantName', 150], ['silo', 200], ['address', 255], ['locality', 100], ['province', 100], ['workType', 100]]) {
    if (b[k] !== undefined) d[k] = text(b[k] === null ? null : String(b[k]), k, max);
  }
  set('notes', text(b.notes !== undefined ? b.notes : b.orderNotes, 'notes', 10000));
  set('recommendations', text(b.recommendations, 'recommendations', 10000));
  set('technicianSignature', image(b.technicianSignature, 'technicianSignature'));
  set('customerSignature', image(b.customerSignature, 'customerSignature'));
  set('originalOrderImage', image(b.originalOrderImage, 'originalOrderImage'));
  return d;
};

// Vincula empresa, servicio, oportunidad y técnicos. Acepta ids o (pantalla v1) nombres.
const resolveReferences = async (b, d, transaction) => {
  if (b.companyId !== undefined) {
    d.companyId = b.companyId ? toInt(b.companyId) : null;
    if (d.companyId && !(await Company.findByPk(d.companyId, { transaction }))) throw badRequest('La empresa indicada no existe', { companyId: 'missing' });
  } else if (d.customerName) {
    const e = await Company.findOne({ where: { legalName: d.customerName }, transaction });
    if (e) d.companyId = e.id;
  }
  if (b.serviceId !== undefined) {
    d.serviceId = b.serviceId ? toInt(b.serviceId) : null;
    if (d.serviceId) {
      const s = await CatalogItem.findByPk(d.serviceId, { transaction });
      if (!s || s.type !== 'servicio') throw badRequest('El servicio indicado no existe en el catálogo', { serviceId: 'missing' });
      if (!d.workType) d.workType = s.name;
    }
  } else if (d.workType) {
    const s = await CatalogItem.findOne({ where: { type: 'servicio', name: d.workType }, transaction });
    if (s) d.serviceId = s.id;
  }
  if (b.opportunityId !== undefined) {
    d.opportunityId = b.opportunityId ? toInt(b.opportunityId) : null;
    if (d.opportunityId && !(await Opportunity.findByPk(d.opportunityId, { transaction }))) throw badRequest('La oportunidad indicada no existe', { opportunityId: 'missing' });
  }
  // Técnicos: solo empleados activos con rol técnico o supervisor.
  let technicianIds;
  if (Array.isArray(b.technicianIds)) technicianIds = [...new Set(b.technicianIds.map((x) => toInt(x)).filter(Boolean))];
  else if (typeof b.technicianName === 'string') {
    const names = b.technicianName.split(/[,;/]| y /).map((s) => s.trim()).filter(Boolean);
    technicianIds = [];
    for (const n of names) {
      const employee = await Employee.findOne({ where: { fullName: n, role: { [Op.in]: ORDER_EXECUTOR_ROLES } }, transaction });
      if (!employee) throw badRequest(`"${n}" no está registrado como técnico. Cargalo en Empleados con rol Técnico.`, { technicianName: 'notTechnician' });
      technicianIds.push(employee.id);
    }
  }
  if (technicianIds?.length) {
    const valid = await Employee.findAll({ where: { id: { [Op.in]: technicianIds }, role: { [Op.in]: ORDER_EXECUTOR_ROLES }, active: true }, attributes: ['id'], transaction });
    if (valid.length !== technicianIds.length) throw badRequest('Solo se pueden asignar empleados activos con rol Técnico o Supervisor', { technicianIds: 'notTechnician' });
  }
  return technicianIds;
};

export const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = oneOf(String(req.query.status), SERVICE_ORDER_STATUSES, 'status');
  if (req.query.companyId) where.companyId = toInt(req.query.companyId);
  const from = parseDate(req.query.from, 'from');
  const to = parseDate(req.query.to, 'to');
  if (from || to) where.scheduledDate = { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) };
  const orders = await ServiceOrder.findAll({ where, include, order: [['scheduledDate', 'DESC'], ['id', 'DESC']], paranoid: req.query.includeDeleted !== '1' });
  res.json({ data: orders.map(serializeServiceOrder) });
});

export const get = asyncHandler(async (req, res) => {
  const o = await ServiceOrder.findByPk(idParam(req), { include: [...include, { model: Activity, as: 'technicalVisits', attributes: ['id', 'occurredAt', 'description', 'userId'] }] });
  if (!o) throw notFound('Orden de servicio');
  res.json({ data: serializeServiceOrder(o) });
});

export const create = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const d = orderData(b);
  if (!d.orderNumber) throw badRequest('El número de orden es obligatorio', { orderNumber: 'required' });
  if (await ServiceOrder.findOne({ where: { orderNumber: d.orderNumber }, paranoid: false })) throw conflict(`Ya existe la orden N° ${d.orderNumber}`);
  const id = await sequelize.transaction(async (transaction) => {
    const technicianIds = await resolveReferences(b, d, transaction);
    if (!d.customerName && d.companyId) d.customerName = (await Company.findByPk(d.companyId, { transaction })).legalName;
    if (!d.customerName) throw badRequest('Indicá la empresa o el nombre del cliente', { customerName: 'required' });
    const o = await ServiceOrder.create({
      ...d,
      scheduledDate: d.scheduledDate || new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10),
      workType: d.workType || 'Fumigación de Silo',
      status: d.status || 'Programada',
      createdById: req.user.idUser,
    }, { transaction });
    if (technicianIds?.length) await o.setTechnicians(technicianIds, { transaction });
    if (Array.isArray(b.appliedProducts) && b.appliedProducts.length) {
      await AppliedProduct.bulkCreate(b.appliedProducts.map(detailRow).map((p) => ({ ...p, serviceOrderId: o.id })), { transaction });
    }
    return o.id;
  });
  res.status(201).json({ message: 'Orden de servicio creada', data: serializeServiceOrder(await ServiceOrder.findByPk(id, { include })) });
});

export const update = asyncHandler(async (req, res) => {
  const o = await ServiceOrder.findByPk(idParam(req));
  if (!o) throw notFound('Orden de servicio');
  const b = req.body || {};
  const d = orderData(b);
  if (d.orderNumber === null || d.customerName === null) throw badRequest('El número de orden y el cliente no pueden quedar vacíos');
  if (d.orderNumber && d.orderNumber !== o.orderNumber && (await ServiceOrder.findOne({ where: { orderNumber: d.orderNumber }, paranoid: false }))) throw conflict(`Ya existe la orden N° ${d.orderNumber}`);
  if (d.status === 'Completada' && !o.completedDate && d.completedDate === undefined) d.completedDate = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  await sequelize.transaction(async (transaction) => {
    const technicianIds = await resolveReferences(b, d, transaction);
    await o.update(d, { transaction });
    if (technicianIds) await o.setTechnicians(technicianIds, { transaction });
    if (Array.isArray(b.appliedProducts)) {
      await AppliedProduct.destroy({ where: { serviceOrderId: o.id }, transaction });
      if (b.appliedProducts.length) await AppliedProduct.bulkCreate(b.appliedProducts.map(detailRow).map((p) => ({ ...p, serviceOrderId: o.id })), { transaction });
    }
  });
  res.json({ message: 'Orden de servicio actualizada', data: serializeServiceOrder(await ServiceOrder.findByPk(o.id, { include })) });
});

// Planilla de evaluación post-tratamiento + satisfacción del cliente (para el tablero CUU06).
export const saveEvaluation = asyncHandler(async (req, res) => {
  const o = await ServiceOrder.findByPk(idParam(req));
  if (!o) throw notFound('Orden de servicio');
  const b = req.body || {};
  const photos = Array.isArray(b.photos) ? b.photos.slice(0, 10).map((f, i) => image(typeof f === 'object' ? f?.url ?? f?.data : f, `photos[${i}]`)) : undefined;
  const payload = {
    serviceOrderId: o.id,
    evaluationDate: parseDate(b.evaluationDate, 'evaluationDate') || new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10),
    grainCondition: text(b.grainCondition, 'grainCondition', 5) || 'A',
    samplingPoint: text(b.samplingPoint, 'samplingPoint', 150) || 'Superficie',
    result: oneOf(b.result || 'Sin insectos vivos', EVALUATION_RESULTS, 'result'),
    ppmPH3: number(b.ppmPH3, 'ppmPH3', { min: 0 }),
    notes: text(b.notes, 'notes', 10000) ?? null,
    recommendations: text(b.recommendations, 'recommendations', 10000) ?? null,
    details: Array.isArray(b.details) ? JSON.stringify(b.details).slice(0, 2_000_000) : text(b.details, 'details', 2_000_000) ?? null,
    photos: photos ? JSON.stringify(photos.filter(Boolean)) : null,
    customerSignature: image(b.customerSignature, 'customerSignature') ?? null,
    technicianSignature: image(b.technicianSignature, 'technicianSignature') ?? null,
    customerSatisfaction: number(b.customerSatisfaction, 'customerSatisfaction', { integer: true, min: 1, max: 5 }),
    customerComment: text(b.customerComment, 'customerComment', 2000) ?? null,
  };
  await sequelize.transaction(async (transaction) => {
    const ev = await ServiceEvaluation.findOne({ where: { serviceOrderId: o.id }, transaction });
    if (ev) await ev.update(payload, { transaction });
    else await ServiceEvaluation.create(payload, { transaction });
    if (o.status === 'Programada' || o.status === 'En Ejecución') {
      await o.update({ status: 'Completada', completedDate: o.completedDate || payload.evaluationDate }, { transaction });
    }
  });
  res.json({ message: 'Evaluación guardada', data: serializeServiceOrder(await ServiceOrder.findByPk(o.id, { include })) });
});

// Baja lógica: la orden deja de verse (y de contar en el tablero) pero se puede restaurar.
export const remove = asyncHandler(async (req, res) => {
  const o = await ServiceOrder.findByPk(idParam(req));
  if (!o) throw notFound('Orden de servicio');
  await o.destroy();
  res.json({ message: 'Orden de servicio dada de baja' });
});

export const restore = asyncHandler(async (req, res) => {
  const o = await ServiceOrder.findByPk(idParam(req), { paranoid: false });
  if (!o) throw notFound('Orden de servicio');
  await o.restore();
  res.json({ message: 'Orden restaurada', data: serializeServiceOrder(o) });
});
