import { COMPANY_LEVELS } from './company.entity.js';
import { efficacyOf } from '../service-order/serviceEvaluation.entity.js';
import * as companyRepository from './company.repository.js';
import { badRequest, forbidden, notFound, pick, toInt } from '../../shared/utils/http.js';
import { isValidCuit, formatCuit, number, required, text, oneOf } from '../../shared/utils/validation.js';
import { resolveLocality, serializeLocality } from '../locality/locality.service.js';
import { serializeContact } from '../contact/contact.service.js';
import { isLocalityInZone, zoneLocalityIds } from '../user/user.service.js';

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
    localityDetails: loc ? {
      id: loc.id, name: loc.name, postalCode: loc.postalCode, provinceId: loc.provinceId, province: loc.province?.name ?? null,
      latitude: loc.latitude != null ? Number(loc.latitude) : null, longitude: loc.longitude != null ? Number(loc.longitude) : null,
    } : null,
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
const canEdit = async ({ admin, currentUserId }, company) => {
  if (admin || company.createdById === currentUserId) return true;
  if (!company.localityId) return false;
  return isLocalityInZone(currentUserId, company.localityId);
};

// La administración puede indicar quién es el responsable del registro.
const chosenCreator = async ({ admin }, id, transaction) => {
  if (!admin || !id) return null;
  const u = await companyRepository.findUserById(id, { transaction });
  if (!u) throw badRequest('El usuario responsable indicado no existe', { createdById: 'missing' });
  return u.idUser;
};

const branchIds = async (rootId) => {
  const ids = [rootId];
  let border = [rootId];
  for (let level = 0; level < 4 && border.length; level++) {
    const children = await companyRepository.findChildrenIds(border);
    border = children.map((h) => h.id).filter((id) => !ids.includes(id));
    ids.push(...border);
  }
  return ids;
};

export const listCompanies = async (query = {}, { admin, currentUserId }) => {
  let localityIds;
  if (query.myZone === '1' || query.myZone === 'true') {
    const zoneIds = await zoneLocalityIds(currentUserId);
    if (zoneIds.length) localityIds = zoneIds;
  }
  const includeDeleted = admin && query.includeDeleted === '1';
  const companies = await companyRepository.findAll({
    companyType: query.companyType,
    localityId: query.localityId,
    localityIds,
    q: String(query.q || '').trim(),
    paranoid: !includeDeleted,
  });
  return companies.map(serializeCompany);
};

export const getCompany = async (id, { admin }) => {
  const e = await companyRepository.findByIdWithDetails(id, {
    paranoid: !admin,
    withCrops: true,
    withPhoneDetails: true,
  });
  if (!e) throw notFound('Empresa');
  return serializeCompany(e);
};

// Jerarquía completa (madre → regiones → subsedes) a partir de cualquier nodo.
export const getCompanyTree = async (id) => {
  let actual = await companyRepository.findById(id);
  if (!actual) throw notFound('Empresa');
  for (let i = 0; i < 5 && actual.parentCompanyId; i++) {
    const parent = await companyRepository.findById(actual.parentCompanyId);
    if (!parent) break;
    actual = parent;
  }
  const headOffice = await companyRepository.findByIdWithDetails(actual.id, { withPhoneDetails: true });
  const regions = await companyRepository.findChildrenWithContacts(headOffice.id);
  const branches = regions.length
    ? await companyRepository.findChildrenWithContacts(regions.map((r) => r.id))
    : [];
  return {
    ...serializeCompany(headOffice),
    regions: regions.map((r) => ({
      ...serializeCompany(r),
      branches: branches.filter((s) => s.parentCompanyId === r.id).map(serializeCompany),
    })),
  };
};

export const createCompany = async (body = {}, { admin, currentUserId }) => {
  // Una regional o subsede con el mismo CUIT que su empresa principal no se revalida.
  const parentId = toInt(body?.parentCompanyId);
  const parent = parentId ? await companyRepository.findById(parentId) : null;
  const d = companyData(body, { cuitActual: parent?.cuit });
  required(d, ['legalName', 'cuit']);
  const result = await companyRepository.runTransaction(async (transaction) => {
    const localityId = await resolveLocality({
      localityId: body.localityId,
      locality: body.locality,
      postalCode: body.postalCode ?? body.localityPostalCode,
    }, { transaction });
    if (d.parentCompanyId && !(await companyRepository.findById(d.parentCompanyId, { transaction }))) {
      throw badRequest('La empresa principal no existe');
    }
    const createdById = await chosenCreator({ admin }, body.createdById, transaction);
    const company = await companyRepository.create({
      ...d,
      companyType: d.companyType || 'Productor',
      level: d.level || (d.parentCompanyId ? 'subsede' : 'independiente'),
      localityId: localityId ?? null,
      createdById: createdById || currentUserId,
    }, { transaction });

    if (Array.isArray(body.cropIds)) {
      await companyRepository.setCrops(company, body.cropIds.map(Number).filter(Boolean), transaction);
    }

    // Alta opcional de un contacto en el mismo paso (compatibilidad con el formulario actual).
    let contact = null;
    const newContactData = body.contact || body.newContact;
    const existingId = body.existingContactId;
    if (existingId) {
      contact = await companyRepository.findContactById(Number(existingId), { transaction });
      if (contact) await companyRepository.updateContact(contact, { companyId: company.id }, { transaction });
    } else if (newContactData && (newContactData.fullName || newContactData.name)) {
      const name = text(newContactData.fullName || `${newContactData.name || ''} ${newContactData.surname || ''}`, 'fullName', 150);
      contact = await companyRepository.createContact({
        fullName: name,
        nationalId: text(newContactData.nationalId ?? newContactData.docNumber, 'nationalId', 20),
        jobTitle: text(newContactData.jobTitle ?? newContactData.clientType, 'jobTitle', 50),
        email: text(newContactData.email, 'email', 150),
        notes: text(newContactData.notes ?? newContactData.note, 'notes', 5000),
        isPrimary: true,
        companyId: company.id,
      }, { transaction });
      const phone = text(newContactData.phone, 'phone', 30);
      if (phone) await companyRepository.createContactPhone({ contactId: contact.id, number: phone }, { transaction });
    }
    return { company, contact };
  });
  const full = await companyRepository.findByIdWithDetails(result.company.id, { withPhoneDetails: false });
  return {
    data: serializeCompany(full),
    contact: result.contact ? serializeContact(result.contact) : null,
  };
};

export const updateCompany = async (id, body = {}, { admin, currentUserId }) => {
  const company = await companyRepository.findById(id);
  if (!company) throw notFound('Empresa');
  if (!(await canEdit({ admin, currentUserId }, company))) {
    throw forbidden('Solo la administración, quien registró la empresa o el vendedor de la zona pueden editarla');
  }
  const d = companyData(body, { cuitActual: company.cuit });
  if (d.parentCompanyId === id) throw badRequest('Una empresa no puede ser su propia empresa principal');
  if (d.parentCompanyId && (await branchIds(id)).includes(d.parentCompanyId)) {
    throw badRequest('La empresa principal no puede ser una de sus propias sucursales');
  }
  await companyRepository.runTransaction(async (transaction) => {
    const localityId = await resolveLocality({
      localityId: body.localityId,
      locality: body.locality,
      postalCode: body.postalCode ?? body.localityPostalCode,
    }, { transaction });
    if (localityId !== undefined) d.localityId = localityId;
    // Si cambia la dirección o la localidad y no llega un punto nuevo, el anterior ya no corresponde:
    // se borra para que el mapa no muestre la empresa en un lugar que no es el suyo.
    const moved = (d.address !== undefined && (d.address || null) !== (company.address || null))
      || (d.localityId !== undefined && d.localityId !== company.localityId);
    if (moved && body.latitude === undefined && body.longitude === undefined) {
      d.latitude = null;
      d.longitude = null;
    }
    if ((d.latitude == null) !== (d.longitude == null) && (d.latitude !== undefined || d.longitude !== undefined)) {
      throw badRequest('La ubicación necesita latitud y longitud juntas');
    }
    if (admin && body.createdById !== undefined) {
      d.createdById = (await chosenCreator({ admin }, body.createdById, transaction)) || null;
    }
    await companyRepository.update(company, d, { transaction });
    if (Array.isArray(body.cropIds)) {
      await companyRepository.setCrops(company, body.cropIds.map(Number).filter(Boolean), transaction);
    }
  });
  const full = await companyRepository.findByIdWithDetails(id, { withPhoneDetails: false });
  return serializeCompany(full);
};

// Baja lógica (solo administración). El historial queda intacto.
export const removeCompany = async (id) => {
  const company = await companyRepository.findById(id);
  if (!company) throw notFound('Empresa');
  await companyRepository.destroy(company);
  return { message: 'Empresa dada de baja. Se puede restaurar desde Empresas → Ver bajas.' };
};

export const restoreCompany = async (id) => {
  const company = await companyRepository.findById(id, { paranoid: false });
  if (!company) throw notFound('Empresa');
  await companyRepository.restore(company);
  return serializeCompany(company);
};

// CUU06: tablero de servicios de la empresa para mostrarle al cliente.
// Incluye las sucursales de la empresa. Si no tiene órdenes, devuelve los
// indicadores generales de la provincia sin datos que identifiquen a otros clientes.
export const getCompanyDashboard = async (id, query = {}) => {
  const company = await companyRepository.findByIdWithLocality(id);
  if (!company) throw notFound('Empresa');
  const months = [6, 12, 24].includes(Number(query.months)) ? Number(query.months) : 12;
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - months + 1, 1);
  const fromStr = from.toISOString().slice(0, 10);

  const serviceWhere = query.serviceType ? { serviceType: String(query.serviceType) } : undefined;
  const calculate = async (companyIds) => {
    const orders = await companyRepository.findServiceOrdersForDashboard({ companyIds, fromStr, serviceWhere });
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
      const inProvince = await companyRepository.findCompaniesInProvince(provinceId);
      zoneIds = inProvince.map((e) => e.id);
    }
    data = await calculate(zoneIds);
    scope = provinceId ? 'province' : 'general';
  }
  const { orders, ...indicators } = data;
  return {
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
  };
};
