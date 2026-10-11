import { Op } from 'sequelize';
import { sequelize, Contacto, ContactoTelefono, Empresa, Localidad } from '../models/index.js';
import { asyncHandler, badRequest, notFound, pick, toInt } from '../utils/http.js';
import { requerido, texto } from '../utils/validacion.js';
import { isAdmin } from '../middlewares/auth.middleware.js';

export const serializeContacto = (c) => {
  if (!c) return null;
  const j = typeof c.toJSON === 'function' ? c.toJSON() : c;
  const telefonos = Array.isArray(j.telefonos) ? j.telefonos.map((t) => (typeof t === 'string' ? t : t.numero)) : [];
  const empresa = j.empresa ? { id: j.empresa.id, razonSocial: j.empresa.razonSocial, nombreEmpresa: j.empresa.razonSocial } : null;
  return {
    id: j.id,
    nombreApellido: j.nombreApellido,
    dni: j.dni ?? null,
    cargo: j.cargo ?? null,
    email: j.email ?? null,
    esPrincipal: Boolean(j.esPrincipal),
    observaciones: j.observaciones ?? null,
    empresaId: j.empresaId ?? null,
    empresa: empresa?.razonSocial ?? null,
    telefonos,
    telefono: telefonos[0] ?? null,
    fechaAlta: j.fechaAlta ?? null,
    fechaBaja: j.fechaBaja ?? null,
    localidad: j.empresa?.localidad?.nombre ?? null, // la ubicación es la de su empresa
    fechaAgregado: j.fechaAlta ?? null,
    // compatibilidad v1
    numDoc: j.dni ?? null,
    direccionMail: j.email ?? null,
    tipoClient: j.cargo ?? null,
    nota: j.observaciones ?? null,
    clientCompanyId: j.empresaId ?? null,
    ClientCompany: empresa,
    ClientPhones: telefonos.map((numero) => ({ numTelefono: numero })),
  };
};

const include = [
  { model: Empresa, as: 'empresa', attributes: ['id', 'razonSocial', 'localidadId'], include: [{ model: Localidad, as: 'localidad', attributes: ['id', 'nombre'] }] },
  { model: ContactoTelefono, as: 'telefonos' },
];

const datosContacto = (body) => {
  const b = {
    ...body,
    dni: body.dni !== undefined ? body.dni : body.numDoc,
    email: body.email !== undefined ? body.email : body.direccionMail,
    cargo: body.cargo !== undefined ? body.cargo : body.tipoClient,
    observaciones: body.observaciones !== undefined ? body.observaciones : body.nota,
    empresaId: body.empresaId !== undefined ? body.empresaId : body.clientCompanyId,
  };
  const d = pick(b, ['nombreApellido', 'dni', 'cargo', 'email', 'esPrincipal', 'observaciones', 'empresaId']);
  if (d.nombreApellido !== undefined) d.nombreApellido = texto(d.nombreApellido, 'nombreApellido', 150);
  if (d.dni !== undefined) d.dni = texto(d.dni, 'dni', 20);
  if (d.cargo !== undefined) d.cargo = texto(d.cargo, 'cargo', 50);
  if (d.email !== undefined) d.email = texto(d.email, 'email', 150);
  if (d.observaciones !== undefined) d.observaciones = texto(d.observaciones, 'observaciones', 5000);
  if (d.esPrincipal !== undefined) d.esPrincipal = Boolean(d.esPrincipal);
  if (d.empresaId !== undefined) {
    d.empresaId = d.empresaId ? toInt(d.empresaId) : null;
    if (Number.isNaN(d.empresaId)) throw badRequest('empresaId no es válido');
  }
  return d;
};

const telefonosDe = (body) => {
  if (Array.isArray(body.telefonos)) return body.telefonos.map((t) => (typeof t === 'object' ? t?.numero : t));
  if (body.telefono !== undefined) return [body.telefono];
  return undefined;
};

const guardarTelefonos = async (contactoId, lista, transaction) => {
  if (lista === undefined) return;
  const limpios = [...new Set(lista.map((t) => texto(t, 'telefono', 30)).filter(Boolean))];
  await ContactoTelefono.destroy({ where: { contactoId }, transaction });
  if (limpios.length) await ContactoTelefono.bulkCreate(limpios.map((numero) => ({ contactoId, numero })), { transaction });
};

// /contactos/:id es numérico. La ruta heredada /clientes/:x acepta también el DNI.
const buscar = async (param, opts = {}) => {
  const n = toInt(param);
  if (n && !Number.isNaN(n) && n > 0 && n < 100000000) {
    const c = await Contacto.findByPk(n, opts);
    if (c) return c;
  }
  if (!param) return null;
  return Contacto.findOne({ ...opts, where: { dni: String(param) } });
};

export const listar = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.empresaId) where.empresaId = toInt(req.query.empresaId);
  const q = String(req.query.q || '').trim();
  if (q) where[Op.or] = [{ nombreApellido: { [Op.like]: `%${q}%` } }, { dni: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }];
  const contactos = await Contacto.findAll({ where, include, order: [['nombreApellido', 'ASC']], paranoid: !(isAdmin(req) && req.query.incluirBajas === '1') });
  res.json({ data: contactos.map(serializeContacto) });
});

export const obtener = asyncHandler(async (req, res) => {
  const c = await buscar(req.params.id, { include });
  if (!c) throw notFound('Contacto');
  res.json({ data: serializeContacto(c) });
});

export const crear = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const d = datosContacto(body);
  if (!d.nombreApellido && (body.nombre || body.apellido)) d.nombreApellido = texto(`${body.nombre || ''} ${body.apellido || ''}`, 'nombreApellido', 150);
  requerido(d, ['nombreApellido']);
  if (d.empresaId && !(await Empresa.findByPk(d.empresaId))) throw badRequest('La empresa indicada no existe', { empresaId: 'inexistente' });
  const id = await sequelize.transaction(async (transaction) => {
    const c = await Contacto.create(d, { transaction });
    await guardarTelefonos(c.id, telefonosDe(body), transaction);
    return c.id;
  });
  const full = await Contacto.findByPk(id, { include });
  res.status(201).json({ message: 'Contacto creado', data: serializeContacto(full) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const c = await buscar(req.params.id);
  if (!c) throw notFound('Contacto');
  const body = req.body || {};
  const d = datosContacto(body);
  if (d.nombreApellido === null) throw badRequest('El nombre no puede quedar vacío');
  if (d.empresaId && !(await Empresa.findByPk(d.empresaId))) throw badRequest('La empresa indicada no existe', { empresaId: 'inexistente' });
  await sequelize.transaction(async (transaction) => {
    await c.update(d, { transaction });
    await guardarTelefonos(c.id, telefonosDe(body), transaction);
  });
  const full = await Contacto.findByPk(c.id, { include });
  res.json({ message: 'Contacto actualizado', data: serializeContacto(full) });
});

// Baja lógica: el contacto deja de aparecer pero sus oportunidades conservan la referencia.
export const eliminar = asyncHandler(async (req, res) => {
  const c = await buscar(req.params.id);
  if (!c) throw notFound('Contacto');
  await c.destroy();
  res.json({ message: 'Contacto dado de baja' });
});

export const restaurar = asyncHandler(async (req, res) => {
  const c = await Contacto.findByPk(toInt(req.params.id), { paranoid: false });
  if (!c) throw notFound('Contacto');
  await c.restore();
  res.json({ message: 'Contacto restaurado', data: serializeContacto(c) });
});
