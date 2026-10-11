import { Op } from 'sequelize';
import {
  sequelize, Oportunidad, Empresa, Usuario, Contacto, Actividad, ItemCatalogo, OrdenServicio,
} from '../models/index.js';
import { ESTADOS_ABIERTOS, ESTADOS_OPORTUNIDAD } from '../models/comercial.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, forbidden, idParam, notFound, pick, toInt } from '../utils/http.js';
import { numero, parseFecha, requerido, texto, unoDe } from '../utils/validacion.js';

// Estados v1 que todavía puede mandar alguna pantalla vieja.
const ESTADO_V1 = {
  Lead: 'Prospecto', Prospecto: 'Prospecto', 'Negociación': 'Cotizado', Negociacion: 'Cotizado',
  Activo: 'Ganada', Inactivo: 'Perdida', Perdido: 'Perdida', Ganado: 'Ganada',
};
const normalizarEstado = (e) => (e === undefined || e === null || e === '' ? e : (ESTADOS_OPORTUNIDAD.includes(e) ? e : ESTADO_V1[e] || e));

export const includeOportunidad = [
  { model: Empresa, as: 'empresa', attributes: ['id', 'razonSocial', 'localidadId'], paranoid: false },
  { model: Usuario, as: 'responsable', attributes: ['idUser', 'nombreApellido', 'rol'] },
  { model: Contacto, as: 'contacto', attributes: ['id', 'nombreApellido', 'dni'], paranoid: false },
];

export const serializeOportunidad = (o) => {
  if (!o) return null;
  const j = typeof o.toJSON === 'function' ? o.toJSON() : o;
  const num = (v) => (v !== null && v !== undefined ? Number(v) : null);
  return {
    id: j.id,
    titulo: j.titulo,
    estado: j.estado,
    abierta: ESTADOS_ABIERTOS.includes(j.estado),
    potencialidad: j.potencialidad ?? null,
    volumenPotencial: num(j.volumenPotencial),
    volumenFacturado: num(j.volumenFacturado),
    fechaInicio: j.fechaInicio,
    fechaCierreEstimada: j.fechaCierreEstimada ?? null,
    fechaUltimaActualizacion: j.fechaUltimaActualizacion ?? null,
    diasSinContacto: j.diasSinContacto ?? null,
    motivoPerdida: j.motivoPerdida ?? null,
    empresaId: j.empresaId ?? null,
    empresa: j.empresa?.razonSocial ?? null,
    usuarioId: j.usuarioId ?? null,
    creadoPorId: j.creadoPorId ?? null,
    responsable: j.responsable ? { idUser: j.responsable.idUser, nombreApellido: j.responsable.nombreApellido } : null,
    contactoId: j.contactoId ?? null,
    contacto: j.contacto ? { id: j.contacto.id, nombreApellido: j.contacto.nombreApellido } : null,
    items: Array.isArray(j.items) ? j.items.map((i) => ({ id: i.id, nombre: i.nombre, tipo: i.tipo, cantidad: i.OportunidadItem?.cantidad !== undefined ? num(i.OportunidadItem.cantidad) : null })) : undefined,
    actividades: j.actividades,
    cantidadActividades: j.cantidadActividades !== undefined ? Number(j.cantidadActividades) : undefined,
    fechaBaja: j.fechaBaja ?? null,
    // compatibilidad v1
    nombreNegocio: j.titulo,
    potencialidadCliente: j.potencialidad ?? null,
    fechaCierre: j.fechaCierreEstimada ?? null,
    clientCompanyId: j.empresaId ?? null,
    ClientCompany: j.empresa ? { id: j.empresa.id, nombreEmpresa: j.empresa.razonSocial } : null,
    propietarioId: j.usuarioId ?? null,
    propietario: j.responsable?.nombreApellido ?? null,
    contactoNombre: j.contacto?.nombreApellido ?? null,
  };
};

const datosOportunidad = (b) => {
  const d = pick({
    ...b,
    titulo: b.titulo ?? b.nombreNegocio,
    potencialidad: b.potencialidad ?? b.potencialidadCliente,
    fechaCierreEstimada: b.fechaCierreEstimada !== undefined ? b.fechaCierreEstimada : b.fechaCierre,
    empresaId: b.empresaId !== undefined ? b.empresaId : b.clientCompanyId,
    usuarioId: b.usuarioId !== undefined ? b.usuarioId : b.propietarioId,
    estado: normalizarEstado(b.estado),
  }, ['titulo', 'estado', 'potencialidad', 'volumenPotencial', 'volumenFacturado', 'fechaCierreEstimada', 'motivoPerdida', 'empresaId', 'usuarioId', 'contactoId']);
  if (d.titulo !== undefined) d.titulo = texto(d.titulo, 'titulo', 200);
  if (d.estado !== undefined) d.estado = unoDe(d.estado, ESTADOS_OPORTUNIDAD, 'estado');
  if (d.potencialidad !== undefined) d.potencialidad = texto(d.potencialidad, 'potencialidad', 50);
  if (d.volumenPotencial !== undefined) d.volumenPotencial = numero(d.volumenPotencial, 'volumenPotencial', { min: 0 });
  if (d.volumenFacturado !== undefined) d.volumenFacturado = numero(d.volumenFacturado, 'volumenFacturado', { min: 0 });
  if (d.fechaCierreEstimada !== undefined) d.fechaCierreEstimada = parseFecha(d.fechaCierreEstimada, 'fechaCierreEstimada');
  if (d.motivoPerdida !== undefined) d.motivoPerdida = texto(d.motivoPerdida, 'motivoPerdida', 255);
  if (d.empresaId !== undefined) d.empresaId = d.empresaId ? toInt(d.empresaId) : null;
  if (d.contactoId !== undefined) d.contactoId = d.contactoId ? toInt(d.contactoId) : null;
  if (d.usuarioId !== undefined) d.usuarioId = d.usuarioId ? String(d.usuarioId) : null;
  return d;
};

const validarReferencias = async (d, transaction) => {
  if (d.empresaId && !(await Empresa.findByPk(d.empresaId, { transaction }))) throw badRequest('La empresa indicada no existe', { empresaId: 'inexistente' });
  if (d.contactoId) {
    const c = await Contacto.findByPk(d.contactoId, { transaction });
    if (!c) throw badRequest('El contacto indicado no existe', { contactoId: 'inexistente' });
    if (d.empresaId && c.empresaId && c.empresaId !== d.empresaId) throw badRequest('El contacto pertenece a otra empresa', { contactoId: 'otra empresa' });
  }
  if (d.usuarioId && !(await Usuario.findByPk(d.usuarioId, { transaction }))) throw badRequest('El responsable indicado no existe', { usuarioId: 'inexistente' });
};

// Un vendedor ve y edita sus oportunidades y las que no tienen responsable.
const puedeVer = (req, o) => isAdmin(req) || !o.usuarioId || o.usuarioId === req.user.idUser;

export const listar = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.estado) where.estado = normalizarEstado(String(req.query.estado));
  if (req.query.abiertas === '1') where.estado = { [Op.in]: ESTADOS_ABIERTOS };
  if (req.query.empresaId) where.empresaId = toInt(req.query.empresaId);
  // Para registrar una actividad, el vendedor necesita ver las oportunidades
  // abiertas de la empresa aunque estén a nombre de otro vendedor.
  const paraActividad = req.query.paraActividad === '1' && where.empresaId;
  if (!isAdmin(req) && !paraActividad) where[Op.or] = [{ usuarioId: req.user.idUser }, { usuarioId: null }];
  else if (isAdmin(req) && req.query.usuarioId) where.usuarioId = String(req.query.usuarioId);
  const oportunidades = await Oportunidad.findAll({
    where,
    include: includeOportunidad,
    attributes: { include: [[sequelize.literal('(SELECT COUNT(*) FROM actividades a WHERE a.oportunidad_id = Oportunidad.id)'), 'cantidadActividades']] },
    order: [['fechaUltimaActualizacion', 'DESC'], ['id', 'DESC']],
    limit: Math.min(Number(req.query.limit) || 1000, 2000),
    paranoid: !(isAdmin(req) && req.query.incluirBajas === '1'),
  });
  res.json({ data: oportunidades.map(serializeOportunidad) });
});

export const obtener = asyncHandler(async (req, res) => {
  const o = await Oportunidad.findByPk(idParam(req), {
    include: [
      ...includeOportunidad,
      { model: ItemCatalogo, as: 'items', attributes: ['id', 'nombre', 'tipo'], through: { attributes: ['cantidad'] } },
      { model: Actividad, as: 'actividades', include: [{ model: Usuario, as: 'autor', attributes: ['idUser', 'nombreApellido'] }] },
      { model: OrdenServicio, as: 'ordenesServicio', attributes: ['id', 'numeroOrden', 'estado', 'fechaProgramada'] },
    ],
    order: [[{ model: Actividad, as: 'actividades' }, 'fechaHora', 'DESC']],
  });
  if (!o) throw notFound('Oportunidad');
  if (!puedeVer(req, o)) throw forbidden('Esta oportunidad está asignada a otro vendedor');
  res.json({ data: { ...serializeOportunidad(o), ordenesServicio: o.ordenesServicio } });
});

const guardarItems = async (oportunidad, items, transaction) => {
  if (!Array.isArray(items)) return;
  const filas = items
    .map((i) => (typeof i === 'object' ? { itemId: toInt(i.itemId ?? i.id), cantidad: numero(i.cantidad, 'cantidad', { min: 0 }) } : { itemId: toInt(i), cantidad: null }))
    .filter((i) => i.itemId && !Number.isNaN(i.itemId));
  if (filas.length && (await ItemCatalogo.count({ where: { id: { [Op.in]: filas.map((f) => f.itemId) } }, transaction })) !== new Set(filas.map((f) => f.itemId)).size) {
    throw badRequest('Algún ítem del catálogo no existe', { items: 'inexistente' });
  }
  await oportunidad.setItems([], { transaction });
  for (const f of filas) await oportunidad.addItem(f.itemId, { through: { cantidad: f.cantidad }, transaction });
};

// Crea una oportunidad. Lo usa también el registro de actividad (alta en línea).
export const crearOportunidad = async (req, body, transaction) => {
  const d = datosOportunidad(body);
  if (!d.titulo) {
    const e = d.empresaId ? await Empresa.findByPk(d.empresaId, { transaction }) : null;
    d.titulo = e ? `Seguimiento comercial — ${e.razonSocial}` : null;
  }
  requerido(d, ['titulo', 'empresaId']);
  if (!isAdmin(req)) d.usuarioId = req.user.idUser; // el vendedor solo crea a su nombre
  else if (d.usuarioId === undefined) d.usuarioId = req.user.idUser;
  await validarReferencias(d, transaction);
  const o = await Oportunidad.create({ ...d, estado: d.estado || 'Prospecto', fechaUltimaActualizacion: new Date(), creadoPorId: req.user.idUser }, { transaction });
  await guardarItems(o, body.items, transaction);
  return o;
};

export const crear = asyncHandler(async (req, res) => {
  const o = await sequelize.transaction((transaction) => crearOportunidad(req, req.body || {}, transaction));
  const full = await Oportunidad.findByPk(o.id, { include: includeOportunidad });
  res.status(201).json({ message: 'Oportunidad creada', data: serializeOportunidad(full) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const o = await Oportunidad.findByPk(idParam(req));
  if (!o) throw notFound('Oportunidad');
  if (!puedeVer(req, o)) throw forbidden('Esta oportunidad está asignada a otro vendedor');
  const d = datosOportunidad(req.body || {});
  if (d.titulo === null) throw badRequest('El título no puede quedar vacío');
  if (!isAdmin(req) && d.usuarioId !== undefined && d.usuarioId !== req.user.idUser) {
    if (d.usuarioId === o.usuarioId) delete d.usuarioId;
    else throw forbidden('Solo la administración puede reasignar oportunidades');
  }
  if (d.estado && d.estado !== 'Perdida') d.motivoPerdida = d.motivoPerdida ?? null;
  await sequelize.transaction(async (transaction) => {
    await validarReferencias(d, transaction);
    await o.update({ ...d, fechaUltimaActualizacion: new Date() }, { transaction });
    await guardarItems(o, req.body?.items, transaction);
  });
  const full = await Oportunidad.findByPk(o.id, { include: includeOportunidad });
  res.json({ message: 'Oportunidad actualizada', data: serializeOportunidad(full) });
});

export const eliminar = asyncHandler(async (req, res) => {
  const o = await Oportunidad.findByPk(idParam(req));
  if (!o) throw notFound('Oportunidad');
  // P-3: el vendedor solo da de baja las oportunidades que cargó él, y siempre que no
  // tengan actividades de otros usuarios (la visibilidad es global, ver P-4).
  if (!isAdmin(req)) {
    if (o.creadoPorId !== req.user.idUser) throw forbidden('Solo podés dar de baja las oportunidades que cargaste vos. Pedíselo a la administración.');
    const ajenas = await Actividad.count({ where: { oportunidadId: o.id, usuarioId: { [Op.ne]: req.user.idUser } } });
    if (ajenas) throw forbidden(`La oportunidad tiene ${ajenas} actividad(es) de otros usuarios. Pedile la baja a la administración.`);
  }
  await o.destroy();
  res.json({ message: 'Oportunidad dada de baja (sus actividades se conservan)' });
});

export const restaurar = asyncHandler(async (req, res) => {
  const o = await Oportunidad.findByPk(idParam(req), { paranoid: false });
  if (!o) throw notFound('Oportunidad');
  await o.restore();
  res.json({ message: 'Oportunidad restaurada', data: serializeOportunidad(o) });
});
