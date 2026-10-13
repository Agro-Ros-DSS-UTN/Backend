import { Op, fn, col, literal } from 'sequelize';
import {
  sequelize, Company, Locality, Province, Contact, ContactPhone, User, Crop, Opportunity,
  ServiceOrder, ServiceEvaluation, CatalogItem, UserLocality,
} from '../models/index.js';
import { COMPANY_LEVELS } from '../models/company.model.js';
import { OPEN_STATUSES } from '../models/commercial.model.js';
import { efficacyOf } from '../models/services.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, forbidden, idParam, notFound, pick, toInt } from '../utils/http.js';
import { isValidCuit, formatCuit, number, required, text, oneOf } from '../utils/validation.js';
import { resolveLocality, serializeLocality } from './territory.controller.js';
import { serializeContact } from './contact.controller.js';

const includeBase = [
  { model: Locality, as: 'locality', include: [{ model: Province, as: 'province' }] },
  { model: User, as: 'createdBy', attributes: ['idUser', 'fullName', 'role'] },
];

export const serializeCompany = (e) => {
  if (!e) return null;
  const j = typeof e.toJSON === 'function' ? e.toJSON() : e;
  const loc = j.locality ? serializeLocality(j.locality) : null;
  const contacts = Array.isArray(j.contacts) ? j.contacts.map(serializeContact) : undefined;
  return {
    id: j.id,
    legalName: j.legalName,
    tradeName: j.tradeName ?? null,
    description: j.description ?? null,
    cuit: j.cuit,
    address: j.address ?? null,
    companyType: j.companyType,
    areaHa: j.areaHa !== null && j.areaHa !== undefined ? Number(j.areaHa) : null,
    currentSupplier: j.currentSupplier ?? null,
    level: j.level,
    parentCompanyId: j.parentCompanyId ?? null,
    localityId: j.localityId ?? null,
    // "localidad" queda como texto (las pantallas lo muestran tal cual); el detalle aparte.
    locality: loc?.name ?? null,
    localityDetails: loc ? { id: loc.id, name: loc.name, postalCode: loc.postalCode, provinceId: loc.provinceId, province: loc.province?.name ?? null } : null,
    province: loc?.province?.name ?? null,
    latitude: j.latitude !== null && j.latitude !== undefined ? Number(j.latitude) : null,
    longitude: j.longitude !== null && j.longitude !== undefined ? Number(j.longitude) : null,
    createdById: j.createdById ?? null,
    createdByName: j.createdBy?.fullName ?? null,
    createdByRole: j.createdBy?.role ?? null,
    createdAt: j.createdAt,
    deletedAt: j.deletedAt ?? null,
    crops: Array.isArray(j.crops) ? j.crops.map((c) => ({ id: c.id, name: c.name })) : undefined,
    contacts,
    openOpportunities: j.openOpportunities !== undefined ? Number(j.openOpportunities) : undefined,
    // compatibilidad con las pantallas que usan la forma v1
    companyName: j.legalName,
    companyDescription: j.description ?? null,
    companyAddress: j.address ?? null,
    companyLevel: j.level,
    Locality: loc ? { localityName: loc.name, postalCode: loc.postalCode, Province: loc.Province } : null,
    localityPostalCode: loc?.postalCode ?? null,
    Clients: contacts,
  };
};

const companyData = (body, { cuitActual } = {}) => {
  const b = {
    ...body,
    legalName: body.legalName ?? body.companyName,
    description: body.description ?? body.companyDescription,
    address: body.address ?? body.companyAddress,
    level: body.level ?? body.companyLevel,
  };
  const d = pick(b, ['legalName', 'tradeName', 'description', 'cuit', 'address', 'companyType', 'areaHa', 'currentSupplier', 'level', 'parentCompanyId', 'latitude', 'longitude']);
  if (d.legalName !== undefined) d.legalName = text(d.legalName, 'legalName', 150);
  if (d.tradeName !== undefined) d.tradeName = text(d.tradeName, 'tradeName', 150);
  if (d.description !== undefined) d.description = text(d.description, 'description', 5000);
  if (d.address !== undefined) d.address = text(d.address, 'address', 150);
  if (d.companyType !== undefined) d.companyType = text(d.companyType, 'companyType', 50);
  if (d.currentSupplier !== undefined) d.currentSupplier = text(d.currentSupplier, 'currentSupplier', 150);
  if (d.areaHa !== undefined) d.areaHa = number(d.areaHa, 'areaHa', { min: 0 });
  if (d.latitude !== undefined) d.latitude = number(d.latitude, 'latitude', { min: -90, max: 90 });
  if (d.longitude !== undefined) d.longitude = number(d.longitude, 'longitude', { min: -180, max: 180 });
  if (d.level !== undefined) d.level = oneOf(d.level, COMPANY_LEVELS, 'level');
  if (d.parentCompanyId !== undefined) d.parentCompanyId = d.parentCompanyId ? toInt(d.parentCompanyId) : null;
  const digitsOnly = (v) => String(v || '').replace(/\D/g, '');
  if (d.cuit !== undefined && cuitActual !== undefined && digitsOnly(d.cuit) === digitsOnly(cuitActual)) {
    delete d.cuit; // sin cambios: no se revalidan CUIT cargados antes de la v2
  } else if (d.cuit !== undefined) {
    if (!isValidCuit(d.cuit)) throw badRequest('El CUIT no es válido (revisá el dígito verificador)', { cuit: 'invalid' });
    d.cuit = formatCuit(d.cuit);
  }
  return d;
};

// Admin, quien la registró, o un vendedor que tiene la localidad en su zona.
const canEdit = async (req, company) => {
  if (isAdmin(req) || company.createdById === req.user.idUser) return true;
  if (!company.localityId) return false;
  return Boolean(await UserLocality.findOne({ where: { userId: req.user.idUser, localityId: company.localityId } }));
};

// La administración puede indicar quién es el responsable del registro.
const chosenCreator = async (req, id, transaction) => {
  if (!isAdmin(req) || !id) return null;
  const u = await User.findByPk(String(id), { transaction });
  if (!u) throw badRequest('El usuario responsable indicado no existe', { createdById: 'missing' });
  return u.idUser;
};

const branchIds = async (rootId) => {
  const ids = [rootId];
  let border = [rootId];
  for (let level = 0; level < 4 && border.length; level++) {
    const children = await Company.findAll({ where: { parentCompanyId: { [Op.in]: border } }, attributes: ['id'] });
    border = children.map((h) => h.id).filter((id) => !ids.includes(id));
    ids.push(...border);
  }
  return ids;
};

export const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.companyType) where.companyType = String(req.query.companyType);
  if (req.query.localityId) where.localityId = String(req.query.localityId);
  const q = String(req.query.q || '').trim();
  if (q) where[Op.or] = [{ legalName: { [Op.like]: `%${q}%` } }, { tradeName: { [Op.like]: `%${q}%` } }, { cuit: { [Op.like]: `%${q}%` } }];
  if (req.query.myZone === '1' || req.query.myZone === 'true') {
    const zone = await UserLocality.findAll({ where: { userId: req.user.idUser }, attributes: ['localityId'] });
    if (zone.length) where.localityId = { [Op.in]: zone.map((z) => z.localityId) };
  }
  const includeDeleted = isAdmin(req) && req.query.includeDeleted === '1';
  const companies = await Company.findAll({
    where,
    paranoid: !includeDeleted,
    include: [
      ...includeBase,
      { model: Contact, as: 'contacts', required: false, include: [{ model: ContactPhone, as: 'phones' }] },
    ],
    attributes: {
      include: [[literal(`(SELECT COUNT(*) FROM opportunities o WHERE o.company_id = Company.id AND o.deleted_at IS NULL AND o.status IN (${OPEN_STATUSES.map((e) => `'${e}'`).join(',')}))`), 'openOpportunities']],
    },
    order: [['legalName', 'ASC']],
  });
  res.json({ data: companies.map(serializeCompany) });
});

export const get = asyncHandler(async (req, res) => {
  const id = idParam(req);
  const e = await Company.findByPk(id, {
    paranoid: !isAdmin(req),
    include: [
      ...includeBase,
      { model: Contact, as: 'contacts', include: [{ model: ContactPhone, as: 'phones' }] },
      { model: Crop, as: 'crops', through: { attributes: [] } },
    ],
  });
  if (!e) throw notFound('Empresa');
  res.json({ data: serializeCompany(e) });
});

// Jerarquía completa (madre → regiones → subsedes) a partir de cualquier nodo.
export const tree = asyncHandler(async (req, res) => {
  let actual = await Company.findByPk(idParam(req));
  if (!actual) throw notFound('Empresa');
  for (let i = 0; i < 5 && actual.parentCompanyId; i++) {
    const parent = await Company.findByPk(actual.parentCompanyId);
    if (!parent) break;
    actual = parent;
  }
  const inc = [...includeBase, { model: Contact, as: 'contacts', include: [{ model: ContactPhone, as: 'phones' }] }];
  const headOffice = await Company.findByPk(actual.id, { include: inc });
  const regions = await Company.findAll({ where: { parentCompanyId: headOffice.id }, include: inc, order: [['legalName', 'ASC']] });
  const branches = regions.length
    ? await Company.findAll({ where: { parentCompanyId: { [Op.in]: regions.map((r) => r.id) } }, include: inc, order: [['legalName', 'ASC']] })
    : [];
  res.json({
    data: {
      ...serializeCompany(headOffice),
      regions: regions.map((r) => ({ ...serializeCompany(r), branches: branches.filter((s) => s.parentCompanyId === r.id).map(serializeCompany) })),
    },
  });
});

export const create = asyncHandler(async (req, res) => {
  // Una regional o subsede con el mismo CUIT que su empresa principal no se revalida.
  const parentId = toInt(req.body?.parentCompanyId);
  const parent = parentId ? await Company.findByPk(parentId) : null;
  const d = companyData(req.body || {}, { cuitActual: parent?.cuit });
  required(d, ['legalName', 'cuit']);
  const result = await sequelize.transaction(async (transaction) => {
    const localityId = await resolveLocality({
      localityId: req.body.localityId,
      locality: req.body.locality,
      postalCode: req.body.postalCode ?? req.body.localityPostalCode,
    }, { transaction });
    if (d.parentCompanyId && !(await Company.findByPk(d.parentCompanyId, { transaction }))) throw badRequest('La empresa principal no existe');
    const createdById = await chosenCreator(req, req.body.createdById, transaction);
    const company = await Company.create({
      ...d,
      companyType: d.companyType || 'Productor',
      level: d.level || (d.parentCompanyId ? 'subsede' : 'independiente'),
      localityId: localityId ?? null,
      createdById: createdById || req.user.idUser,
    }, { transaction });

    if (Array.isArray(req.body.cropIds)) await company.setCrops(req.body.cropIds.map(Number).filter(Boolean), { transaction });

    // Alta opcional de un contacto en el mismo paso (compatibilidad con el formulario actual).
    let contact = null;
    const newContactData = req.body.contact || req.body.newContact;
    const existingId = req.body.existingContactId;
    if (existingId) {
      contact = await Contact.findByPk(Number(existingId), { transaction });
      if (contact) await contact.update({ companyId: company.id }, { transaction });
    } else if (newContactData && (newContactData.fullName || newContactData.name)) {
      const name = text(newContactData.fullName || `${newContactData.name || ''} ${newContactData.surname || ''}`, 'fullName', 150);
      contact = await Contact.create({
        fullName: name,
        nationalId: text(newContactData.nationalId ?? newContactData.docNumber, 'nationalId', 20),
        jobTitle: text(newContactData.jobTitle ?? newContactData.clientType, 'jobTitle', 50),
        email: text(newContactData.email, 'email', 150),
        notes: text(newContactData.notes ?? newContactData.note, 'notes', 5000),
        isPrimary: true,
        companyId: company.id,
      }, { transaction });
      const phone = text(newContactData.phone, 'phone', 30);
      if (phone) await ContactPhone.create({ contactId: contact.id, number: phone }, { transaction });
    }
    return { company, contact };
  });
  const full = await Company.findByPk(result.company.id, { include: [...includeBase, { model: Contact, as: 'contacts' }] });
  res.status(201).json({ message: 'Empresa registrada', data: serializeCompany(full), contact: result.contact ? serializeContact(result.contact) : null });
});

export const update = asyncHandler(async (req, res) => {
  const id = idParam(req);
  const company = await Company.findByPk(id);
  if (!company) throw notFound('Empresa');
  if (!(await canEdit(req, company))) throw forbidden('Solo la administración, quien registró la empresa o el vendedor de la zona pueden editarla');
  const d = companyData(req.body || {}, { cuitActual: company.cuit });
  if (d.parentCompanyId === id) throw badRequest('Una empresa no puede ser su propia empresa principal');
  if (d.parentCompanyId && (await branchIds(id)).includes(d.parentCompanyId)) throw badRequest('La empresa principal no puede ser una de sus propias sucursales');
  await sequelize.transaction(async (transaction) => {
    const localityId = await resolveLocality({
      localityId: req.body.localityId,
      locality: req.body.locality,
      postalCode: req.body.postalCode ?? req.body.localityPostalCode,
    }, { transaction });
    if (localityId !== undefined) d.localityId = localityId;
    if (isAdmin(req) && req.body.createdById !== undefined) d.createdById = (await chosenCreator(req, req.body.createdById, transaction)) || null;
    await company.update(d, { transaction });
    if (Array.isArray(req.body.cropIds)) await company.setCrops(req.body.cropIds.map(Number).filter(Boolean), { transaction });
  });
  const full = await Company.findByPk(id, { include: [...includeBase, { model: Contact, as: 'contacts' }] });
  res.json({ message: 'Empresa actualizada', data: serializeCompany(full) });
});

// Baja lógica (solo administración). El historial queda intacto.
export const remove = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(idParam(req));
  if (!company) throw notFound('Empresa');
  await company.destroy();
  res.json({ message: 'Empresa dada de baja. Se puede restaurar desde Empresas → Ver bajas.' });
});

export const restore = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(idParam(req), { paranoid: false });
  if (!company) throw notFound('Empresa');
  await company.restore();
  res.json({ message: 'Empresa restaurada', data: serializeCompany(company) });
});

// CUU06: tablero de servicios de la empresa para mostrarle al cliente.
// Incluye las sucursales de la empresa. Si no tiene órdenes, devuelve los
// indicadores generales de la provincia sin datos que identifiquen a otros clientes.
export const dashboard = asyncHandler(async (req, res) => {
  const id = idParam(req);
  const company = await Company.findByPk(id, { include: [{ model: Locality, as: 'locality' }] });
  if (!company) throw notFound('Empresa');
  const months = [6, 12, 24].includes(Number(req.query.months)) ? Number(req.query.months) : 12;
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - months + 1, 1);
  const fromStr = from.toISOString().slice(0, 10);

  const serviceWhere = req.query.serviceType ? { serviceType: String(req.query.serviceType) } : undefined;
  const calculate = async (companyIds) => {
    const orders = await ServiceOrder.findAll({
      where: { ...(companyIds ? { companyId: { [Op.in]: companyIds } } : {}), scheduledDate: { [Op.gte]: fromStr } },
      include: [
        { model: ServiceEvaluation, as: 'evaluation', attributes: ['result', 'customerSatisfaction', 'evaluationDate'] },
        { model: CatalogItem, as: 'service', attributes: ['id', 'name', 'serviceType'], ...(serviceWhere ? { where: serviceWhere, required: true } : { required: false }) },
      ],
      attributes: ['id', 'orderNumber', 'scheduledDate', 'completedDate', 'status', 'workType', 'companyId'],
      order: [['scheduledDate', 'ASC']],
    });
    const completed = orders.filter((o) => o.status === 'Completada');
    const onDate = completed.filter((o) => o.completedDate && o.completedDate <= o.scheduledDate);
    const sat = completed.map((o) => o.evaluation?.customerSatisfaction).filter((n) => n);
    const byMonth = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(from);
      d.setUTCMonth(from.getUTCMonth() + i);
      const key = d.toISOString().slice(0, 7);
      byMonth.push({ month: key, completed: completed.filter((o) => String(o.completedDate || o.scheduledDate).startsWith(key)).length });
    }
    const results = { effective: 0, partial: 0, ineffective: 0, notEvaluated: 0 };
    for (const o of completed) {
      const ef = efficacyOf(o.evaluation?.result);
      results[ef || 'notEvaluated']++;
    }
    const byService = {};
    for (const o of completed) {
      const name = o.service?.name || o.workType || 'Otro';
      byService[name] = (byService[name] || 0) + 1;
    }
    return {
      completedOrders: completed.length,
      scheduledOrders: orders.filter((o) => o.status === 'Programada' || o.status === 'En Ejecución').length,
      onTimeRate: completed.length ? Math.round((onDate.length / completed.length) * 1000) / 10 : null,
      averageSatisfaction: sat.length ? Math.round((sat.reduce((a, b) => a + b, 0) / sat.length) * 10) / 10 : null,
      evaluations: sat.length,
      results,
      byMonth,
      topServices: Object.entries(byService).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, quantity]) => ({ name, quantity })),
      orders,
    };
  };

  const ids = await branchIds(id);
  const own = await calculate(ids);
  let scope = 'company';
  let data = own;
  if (own.completedOrders === 0) {
    // Prospecto: indicadores generales de la provincia (o de toda la empresa si no hay localidad).
    const provinceId = company.locality?.provinceId;
    let zoneIds = null;
    if (provinceId) {
      const inProvince = await Company.findAll({ include: [{ model: Locality, as: 'locality', where: { provinceId }, attributes: [] }], attributes: ['id'] });
      zoneIds = inProvince.map((e) => e.id);
    }
    data = await calculate(zoneIds);
    scope = provinceId ? 'province' : 'general';
  }
  const { orders, ...indicators } = data;
  res.json({
    data: {
      company: { id: company.id, legalName: company.legalName },
      scope,
      months,
      updatedAt: new Date().toISOString(),
      ...indicators,
      // El detalle de órdenes solo se muestra cuando son de la propia empresa.
      latestOrders: scope === 'company'
        ? orders.filter((o) => o.status === 'Completada').slice(-5).reverse().map((o) => ({
            orderNumber: o.orderNumber, date: o.completedDate || o.scheduledDate, service: o.service?.name || o.workType,
            result: o.evaluation?.result || null, satisfaction: o.evaluation?.customerSatisfaction || null,
          }))
        : [],
    },
  });
});

export const listCrops = asyncHandler(async (req, res) => {
  res.json({ data: await Crop.findAll({ order: [['name', 'ASC']] }) });
});

export const createCrop = asyncHandler(async (req, res) => {
  const name = text(req.body?.name, 'name', 100);
  required({ name }, ['name']);
  const c = await Crop.create({ name, demandMonths: text(req.body?.demandMonths, 'demandMonths', 40) });
  res.status(201).json({ message: 'Cultivo creado', data: c });
});
