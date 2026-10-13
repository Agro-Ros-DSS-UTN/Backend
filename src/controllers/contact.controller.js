import { Op } from 'sequelize';
import { sequelize, Contact, ContactPhone, Company, Locality } from '../models/index.js';
import { asyncHandler, badRequest, notFound, pick, toInt } from '../utils/http.js';
import { required, text } from '../utils/validation.js';
import { isAdmin } from '../middlewares/auth.middleware.js';

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

const include = [
  { model: Company, as: 'company', attributes: ['id', 'legalName', 'localityId'], include: [{ model: Locality, as: 'locality', attributes: ['id', 'name'] }] },
  { model: ContactPhone, as: 'phones' },
];

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
  await ContactPhone.destroy({ where: { contactId }, transaction });
  if (clean.length) await ContactPhone.bulkCreate(clean.map((number) => ({ contactId, number })), { transaction });
};

// /contacts/:id es numérico; por compatibilidad también acepta el DNI.
const search = async (param, opts = {}) => {
  const n = toInt(param);
  if (n && !Number.isNaN(n) && n > 0 && n < 100000000) {
    const c = await Contact.findByPk(n, opts);
    if (c) return c;
  }
  if (!param) return null;
  return Contact.findOne({ ...opts, where: { nationalId: String(param) } });
};

export const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.companyId) where.companyId = toInt(req.query.companyId);
  const q = String(req.query.q || '').trim();
  if (q) where[Op.or] = [{ fullName: { [Op.like]: `%${q}%` } }, { nationalId: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }];
  const contacts = await Contact.findAll({ where, include, order: [['fullName', 'ASC']], paranoid: !(isAdmin(req) && req.query.includeDeleted === '1') });
  res.json({ data: contacts.map(serializeContact) });
});

export const get = asyncHandler(async (req, res) => {
  const c = await search(req.params.id, { include });
  if (!c) throw notFound('Contacto');
  res.json({ data: serializeContact(c) });
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const d = contactData(body);
  if (!d.fullName && (body.name || body.surname)) d.fullName = text(`${body.name || ''} ${body.surname || ''}`, 'fullName', 150);
  required(d, ['fullName']);
  if (d.companyId && !(await Company.findByPk(d.companyId))) throw badRequest('La empresa indicada no existe', { companyId: 'missing' });
  const id = await sequelize.transaction(async (transaction) => {
    const c = await Contact.create(d, { transaction });
    await savePhones(c.id, phonesOf(body), transaction);
    return c.id;
  });
  const full = await Contact.findByPk(id, { include });
  res.status(201).json({ message: 'Contacto creado', data: serializeContact(full) });
});

export const update = asyncHandler(async (req, res) => {
  const c = await search(req.params.id);
  if (!c) throw notFound('Contacto');
  const body = req.body || {};
  const d = contactData(body);
  if (d.fullName === null) throw badRequest('El nombre no puede quedar vacío');
  if (d.companyId && !(await Company.findByPk(d.companyId))) throw badRequest('La empresa indicada no existe', { companyId: 'missing' });
  await sequelize.transaction(async (transaction) => {
    await c.update(d, { transaction });
    await savePhones(c.id, phonesOf(body), transaction);
  });
  const full = await Contact.findByPk(c.id, { include });
  res.json({ message: 'Contacto actualizado', data: serializeContact(full) });
});

// Baja lógica: el contacto deja de aparecer pero sus oportunidades conservan la referencia.
export const remove = asyncHandler(async (req, res) => {
  const c = await search(req.params.id);
  if (!c) throw notFound('Contacto');
  await c.destroy();
  res.json({ message: 'Contacto dado de baja' });
});

export const restore = asyncHandler(async (req, res) => {
  const c = await Contact.findByPk(toInt(req.params.id), { paranoid: false });
  if (!c) throw notFound('Contacto');
  await c.restore();
  res.json({ message: 'Contacto restaurado', data: serializeContact(c) });
});
