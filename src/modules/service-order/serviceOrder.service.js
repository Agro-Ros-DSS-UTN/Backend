import { SERVICE_ORDER_STATUSES } from './serviceOrder.entity.js';
import { EVALUATION_RESULTS } from './serviceEvaluation.entity.js';
import * as serviceOrderRepository from './serviceOrder.repository.js';
import { badRequest, conflict, notFound, toInt } from '../../shared/utils/http.js';
import { dataUrl, number, parseDate, text, oneOf } from '../../shared/utils/validation.js';

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
    if (d.companyId && !(await serviceOrderRepository.findCompanyById(d.companyId, transaction))) {
      throw badRequest('La empresa indicada no existe', { companyId: 'missing' });
    }
  } else if (d.customerName) {
    const e = await serviceOrderRepository.findCompanyByLegalName(d.customerName, transaction);
    if (e) d.companyId = e.id;
  }
  if (b.serviceId !== undefined) {
    d.serviceId = b.serviceId ? toInt(b.serviceId) : null;
    if (d.serviceId) {
      const s = await serviceOrderRepository.findServiceItemById(d.serviceId, transaction);
      if (!s || s.type !== 'servicio') throw badRequest('El servicio indicado no existe en el catálogo', { serviceId: 'missing' });
      if (!d.workType) d.workType = s.name;
    }
  } else if (d.workType) {
    const s = await serviceOrderRepository.findServiceItemByName(d.workType, transaction);
    if (s) d.serviceId = s.id;
  }
  if (b.opportunityId !== undefined) {
    d.opportunityId = b.opportunityId ? toInt(b.opportunityId) : null;
    if (d.opportunityId && !(await serviceOrderRepository.findOpportunityById(d.opportunityId, transaction))) {
      throw badRequest('La oportunidad indicada no existe', { opportunityId: 'missing' });
    }
  }
  // Técnicos: solo empleados activos con rol técnico o supervisor.
  let technicianIds;
  if (Array.isArray(b.technicianIds)) technicianIds = [...new Set(b.technicianIds.map((x) => toInt(x)).filter(Boolean))];
  else if (typeof b.technicianName === 'string') {
    const names = b.technicianName.split(/[,;/]| y /).map((s) => s.trim()).filter(Boolean);
    technicianIds = [];
    for (const n of names) {
      const employee = await serviceOrderRepository.findExecutorEmployeeByName(n, transaction);
      if (!employee) throw badRequest(`"${n}" no está registrado como técnico. Cargalo en Empleados con rol Técnico.`, { technicianName: 'notTechnician' });
      technicianIds.push(employee.id);
    }
  }
  if (technicianIds?.length) {
    const valid = await serviceOrderRepository.findActiveExecutorEmployeesByIds(technicianIds, transaction);
    if (valid.length !== technicianIds.length) {
      throw badRequest('Solo se pueden asignar empleados activos con rol Técnico o Supervisor', { technicianIds: 'notTechnician' });
    }
  }
  return technicianIds;
};

export const listServiceOrders = async (query = {}) => {
  const status = query.status ? oneOf(String(query.status), SERVICE_ORDER_STATUSES, 'status') : undefined;
  const companyId = query.companyId ? toInt(query.companyId) : undefined;
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  const paranoid = query.includeDeleted !== '1';
  const orders = await serviceOrderRepository.findAll({ status, companyId, from, to, paranoid });
  return orders.map(serializeServiceOrder);
};

export const getServiceOrder = async (id) => {
  const o = await serviceOrderRepository.findByIdFull(id, { withTechnicalVisits: true });
  if (!o) throw notFound('Orden de servicio');
  return serializeServiceOrder(o);
};

export const createServiceOrder = async (body = {}, { currentUserId }) => {
  const d = orderData(body);
  if (!d.orderNumber) throw badRequest('El número de orden es obligatorio', { orderNumber: 'required' });
  if (await serviceOrderRepository.findByOrderNumber(d.orderNumber)) {
    throw conflict(`Ya existe la orden N° ${d.orderNumber}`);
  }
  const id = await serviceOrderRepository.runTransaction(async (transaction) => {
    const technicianIds = await resolveReferences(body, d, transaction);
    if (!d.customerName && d.companyId) {
      d.customerName = (await serviceOrderRepository.findCompanyById(d.companyId, transaction)).legalName;
    }
    if (!d.customerName) throw badRequest('Indicá la empresa o el nombre del cliente', { customerName: 'required' });
    const o = await serviceOrderRepository.create({
      ...d,
      scheduledDate: d.scheduledDate || new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10),
      workType: d.workType || 'Fumigación de Silo',
      status: d.status || 'Programada',
      createdById: currentUserId,
    }, { transaction });
    if (technicianIds?.length) await serviceOrderRepository.setTechnicians(o, technicianIds, transaction);
    if (Array.isArray(body.appliedProducts) && body.appliedProducts.length) {
      await serviceOrderRepository.bulkCreateAppliedProducts(
        body.appliedProducts.map(detailRow).map((p) => ({ ...p, serviceOrderId: o.id })),
        transaction
      );
    }
    return o.id;
  });
  return serializeServiceOrder(await serviceOrderRepository.findByIdFull(id));
};

export const updateServiceOrder = async (id, body = {}) => {
  const o = await serviceOrderRepository.findById(id);
  if (!o) throw notFound('Orden de servicio');
  const d = orderData(body);
  if (d.orderNumber === null || d.customerName === null) {
    throw badRequest('El número de orden y el cliente no pueden quedar vacíos');
  }
  if (d.orderNumber && d.orderNumber !== o.orderNumber && (await serviceOrderRepository.findByOrderNumber(d.orderNumber))) {
    throw conflict(`Ya existe la orden N° ${d.orderNumber}`);
  }
  if (d.status === 'Completada' && !o.completedDate && d.completedDate === undefined) {
    d.completedDate = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  }
  await serviceOrderRepository.runTransaction(async (transaction) => {
    const technicianIds = await resolveReferences(body, d, transaction);
    await serviceOrderRepository.update(o, d, { transaction });
    if (technicianIds) await serviceOrderRepository.setTechnicians(o, technicianIds, transaction);
    if (Array.isArray(body.appliedProducts)) {
      await serviceOrderRepository.replaceAppliedProducts(o.id, body.appliedProducts.map(detailRow), transaction);
    }
  });
  return serializeServiceOrder(await serviceOrderRepository.findByIdFull(o.id));
};

// Planilla de evaluación post-tratamiento + satisfacción del cliente (para el tablero CUU06).
export const saveServiceOrderEvaluation = async (id, body = {}) => {
  const o = await serviceOrderRepository.findById(id);
  if (!o) throw notFound('Orden de servicio');
  const photos = Array.isArray(body.photos)
    ? body.photos.slice(0, 10).map((f, i) => image(typeof f === 'object' ? f?.url ?? f?.data : f, `photos[${i}]`))
    : undefined;
  const payload = {
    serviceOrderId: o.id,
    evaluationDate: parseDate(body.evaluationDate, 'evaluationDate') || new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10),
    grainCondition: text(body.grainCondition, 'grainCondition', 5) || 'A',
    samplingPoint: text(body.samplingPoint, 'samplingPoint', 150) || 'Superficie',
    result: oneOf(body.result || 'Sin insectos vivos', EVALUATION_RESULTS, 'result'),
    ppmPH3: number(body.ppmPH3, 'ppmPH3', { min: 0 }),
    notes: text(body.notes, 'notes', 10000) ?? null,
    recommendations: text(body.recommendations, 'recommendations', 10000) ?? null,
    details: Array.isArray(body.details) ? JSON.stringify(body.details).slice(0, 2_000_000) : text(body.details, 'details', 2_000_000) ?? null,
    photos: photos ? JSON.stringify(photos.filter(Boolean)) : null,
    customerSignature: image(body.customerSignature, 'customerSignature') ?? null,
    technicianSignature: image(body.technicianSignature, 'technicianSignature') ?? null,
    customerSatisfaction: number(body.customerSatisfaction, 'customerSatisfaction', { integer: true, min: 1, max: 5 }),
    customerComment: text(body.customerComment, 'customerComment', 2000) ?? null,
  };
  await serviceOrderRepository.runTransaction(async (transaction) => {
    const ev = await serviceOrderRepository.findEvaluationByOrderId(o.id, transaction);
    if (ev) await serviceOrderRepository.updateEvaluation(ev, payload, transaction);
    else await serviceOrderRepository.createEvaluation(payload, transaction);
    if (o.status === 'Programada' || o.status === 'En Ejecución') {
      await serviceOrderRepository.update(o, { status: 'Completada', completedDate: o.completedDate || payload.evaluationDate }, { transaction });
    }
  });
  return serializeServiceOrder(await serviceOrderRepository.findByIdFull(o.id));
};

// Baja lógica: la orden deja de verse (y de contar en el tablero) pero se puede restaurar.
export const removeServiceOrder = async (id) => {
  const o = await serviceOrderRepository.findById(id);
  if (!o) throw notFound('Orden de servicio');
  await serviceOrderRepository.destroy(o);
  return { message: 'Orden de servicio dada de baja' };
};

export const restoreServiceOrder = async (id) => {
  const o = await serviceOrderRepository.findById(id, { paranoid: false });
  if (!o) throw notFound('Orden de servicio');
  await serviceOrderRepository.restore(o);
  return serializeServiceOrder(o);
};
