import * as contactRepository from './contact.repository.js';
import { badRequest, notFound, pick, toInt } from '../../shared/utils/http.js';
import { required, text } from '../../shared/utils/validation.js';

export const serializeContact = (c) => {
  if (!c) return null;
  const j = typeof c.toJSON === 'function' ? c.toJSON() : c;
  const phones = Array.isArray(j.phones) ? j.phones.map((t) => (typeof t === 'string' ? t : t.number)) : [];
  const company = j.company ? { id: j.company.id, legalName: j.company.legalName, companyName: j.company.legalName } : null;
  return {
    id: j.id,
    fullName: j.fullName,
    nationalId: j.nationalId ?? null,
    jobTitle: j.jobTitle ?? null,
    email: j.email ?? null,
    isPrimary: Boolean(j.isPrimary),
    notes: j.notes ?? null,
    companyId: j.companyId ?? null,
    company: company?.legalName ?? null,
    phones,
    phone: phones[0] ?? null,
    createdAt: j.createdAt ?? null,
    deletedAt: j.deletedAt ?? null,
    locality: j.company?.locality?.name ?? null, // la ubicación es la de su empresa
    addedAt: j.createdAt ?? null,
    // compatibilidad con las pantallas que usan la forma v1
    docNumber: j.nationalId ?? null,
    clientType: j.jobTitle ?? null,
    note: j.notes ?? null,
    clientCompanyId: j.companyId ?? null,
    ClientCompany: company,
    ClientPhones: phones.map((number) => ({ phoneNumber: number })),
  };
};

const contactData = (body) => {
  const b = {
    ...body,
    nationalId: body.nationalId !== undefined ? body.nationalId : body.docNumber,
    jobTitle: body.jobTitle !== undefined ? body.jobTitle : body.clientType,
    notes: body.notes !== undefined ? body.notes : body.note,
    companyId: body.companyId !== undefined ? body.companyId : body.clientCompanyId,
  };
  const d = pick(b, ['fullName', 'nationalId', 'jobTitle', 'email', 'isPrimary', 'notes', 'companyId']);
  if (d.fullName !== undefined) d.fullName = text(d.fullName, 'fullName', 150);
  if (d.nationalId !== undefined) d.nationalId = text(d.nationalId, 'nationalId', 20);
  if (d.jobTitle !== undefined) d.jobTitle = text(d.jobTitle, 'jobTitle', 50);
  if (d.email !== undefined) d.email = text(d.email, 'email', 150);
  if (d.notes !== undefined) d.notes = text(d.notes, 'notes', 5000);
  if (d.isPrimary !== undefined) d.isPrimary = Boolean(d.isPrimary);
  if (d.companyId !== undefined) {
    d.companyId = d.companyId ? toInt(d.companyId) : null;
    if (Number.isNaN(d.companyId)) throw badRequest('companyId no es válido');
  }
  return d;
};

const phonesOf = (body) => {
  if (Array.isArray(body.phones)) return body.phones.map((t) => (typeof t === 'object' ? t?.number : t));
  if (body.phone !== undefined) return [body.phone];
  return undefined;
};

const savePhones = async (contactId, listing, transaction) => {
  if (listing === undefined) return;
  const clean = [...new Set(listing.map((t) => text(t, 'phone', 30)).filter(Boolean))];
  await contactRepository.replacePhones(contactId, clean, transaction);
};

// /contacts/:id es numérico; por compatibilidad también acepta el DNI.
const search = async (param, opts = {}) => {
  const n = toInt(param);
  if (n && !Number.isNaN(n) && n > 0 && n < 100000000) {
    const c = await contactRepository.findById(n, opts);
    if (c) return c;
  }
  if (!param) return null;
  return contactRepository.findOne({ nationalId: String(param) }, opts);
};

export const listContacts = async (query = {}, { admin } = {}) => {
  const companyId = query.companyId ? toInt(query.companyId) : undefined;
  const q = String(query.q || '').trim();
  const paranoid = !(admin && query.includeDeleted === '1');
  const contacts = await contactRepository.findAll({
    companyId,
    q,
    paranoid,
    page: query.page,
    limit: query.limit,
  });
  return contacts.map(serializeContact);
};

export const getContact = async (idOrNationalId) => {
  const c = await search(idOrNationalId, { include: contactRepository.includeContact });
  if (!c) throw notFound('Contacto');
  return serializeContact(c);
};

export const createContact = async (body = {}) => {
  const d = contactData(body);
  if (!d.fullName && (body.name || body.surname)) d.fullName = text(`${body.name || ''} ${body.surname || ''}`, 'fullName', 150);
  required(d, ['fullName']);
  if (d.companyId && !(await contactRepository.findCompanyById(d.companyId))) {
    throw badRequest('La empresa indicada no existe', { companyId: 'missing' });
  }
  const id = await contactRepository.runTransaction(async (transaction) => {
    const c = await contactRepository.create(d, { transaction });
    await savePhones(c.id, phonesOf(body), transaction);
    return c.id;
  });
  const full = await contactRepository.findByIdFull(id);
  return serializeContact(full);
};

export const updateContact = async (idOrNationalId, body = {}) => {
  const c = await search(idOrNationalId);
  if (!c) throw notFound('Contacto');
  const d = contactData(body);
  if (d.fullName === null) throw badRequest('El nombre no puede quedar vacío');
  if (d.companyId && !(await contactRepository.findCompanyById(d.companyId))) {
    throw badRequest('La empresa indicada no existe', { companyId: 'missing' });
  }
  await contactRepository.runTransaction(async (transaction) => {
    await contactRepository.update(c, d, { transaction });
    await savePhones(c.id, phonesOf(body), transaction);
  });
  const full = await contactRepository.findByIdFull(c.id);
  return serializeContact(full);
};

// Baja lógica: el contacto deja de aparecer pero sus oportunidades conservan la referencia.
export const removeContact = async (idOrNationalId) => {
  const c = await search(idOrNationalId);
  if (!c) throw notFound('Contacto');
  await contactRepository.destroy(c);
  return { message: 'Contacto dado de baja' };
};

export const restoreContact = async (id) => {
  const c = await contactRepository.findById(toInt(id), { paranoid: false });
  if (!c) throw notFound('Contacto');
  await contactRepository.restore(c);
  return serializeContact(c);
};
