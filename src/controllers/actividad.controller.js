import { Op } from 'sequelize';
import {
  sequelize, Actividad, Adjunto, Oportunidad, Empresa, Usuario, Tarea, TareaAsignado, OrdenServicio, ParadaRuta, HojaRuta,
} from '../models/index.js';
import { TIPOS_CONTACTO, TIPOS_TAREA, NIVELES, ESTADOS_ABIERTOS } from '../models/comercial.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, forbidden, idParam, notFound, toInt } from '../utils/http.js';
import { dataUrl, numero, parseFecha, parseFechaHora, texto, unoDe } from '../utils/validacion.js';
import { crearOportunidad } from './oportunidad.controller.js';
import { crearNotificacion } from './notificacion.controller.js';

const TIPO_V1 = { Visita: 'visita', Llamada: 'llamada', WhatsApp: 'whatsapp', Whatsapp: 'whatsapp', Email: 'email', Correo: 'email', 'Reunión': 'reunion', Reunion: 'reunion' };
const normalizarTipo = (t) => (t ? TIPO_V1[t] || String(t).toLowerCase() : 'visita');

const include = [
  {
    model: Oportunidad, as: 'oportunidad', attributes: ['id', 'titulo', 'estado', 'empresaId', 'usuarioId'], paranoid: false,
    include: [{ model: Empresa, as: 'empresa', attributes: ['id', 'razonSocial'], paranoid: false }],
  },
  {
    model: OrdenServicio, as: 'ordenServicio', attributes: ['id', 'numeroOrden', 'empresaId', 'clienteNombre'], paranoid: false,
    include: [{ model: Empresa, as: 'empresa', attributes: ['id', 'razonSocial'], paranoid: false }],
  },
  { model: Usuario, as: 'autor', attributes: ['idUser', 'nombreApellido'] },
  { model: Adjunto, as: 'adjuntos' },
  { model: Tarea, as: 'tareas', attributes: ['id', 'titulo', 'estado', 'fechaVencimiento'] },
];

export const serializeActividad = (a) => {
  if (!a) return null;
  const j = typeof a.toJSON === 'function' ? a.toJSON() : a;
  const empresa = j.oportunidad?.empresa || j.ordenServicio?.empresa || null;
  const adjuntos = (j.adjuntos || []).map((x) => ({ id: x.id, tipo: x.tipo, nombreArchivo: x.nombreArchivo, mimeType: x.mimeType, tamanioKb: x.tamanioKb, url: `/adjuntos/${x.id}` }));
  return {
    id: j.id,
    tipoContacto: j.tipoContacto,
    fechaHora: j.fechaHora,
    descripcion: j.descripcion ?? null,
    resultado: j.resultado ?? null,
    montoVenta: j.montoVenta !== null && j.montoVenta !== undefined ? Number(j.montoVenta) : null,
    sinSeguimiento: Boolean(j.sinSeguimiento),
    oportunidadId: j.oportunidadId ?? null,
    oportunidad: j.oportunidad ? { id: j.oportunidad.id, titulo: j.oportunidad.titulo, estado: j.oportunidad.estado } : null,
    ordenServicioId: j.ordenServicioId ?? null,
    ordenServicio: j.ordenServicio ? { id: j.ordenServicio.id, numeroOrden: j.ordenServicio.numeroOrden } : null,
    empresaId: empresa?.id ?? null,
    empresa: empresa?.razonSocial ?? j.ordenServicio?.clienteNombre ?? null,
    paradaId: j.paradaId ?? null,
    usuarioId: j.usuarioId ?? null,
    autor: j.autor ? { idUser: j.autor.idUser, nombreApellido: j.autor.nombreApellido } : null,
    adjuntos,
    tareas: j.tareas,
    fechaRegistro: j.fechaRegistro,
    clientUuid: j.clientUuid ?? null,
    // compatibilidad v1
    idFormulario: j.id,
    opportunityId: j.oportunidadId ?? null,
    idUser: j.usuarioId ?? null,
    autorNombre: j.autor?.nombreApellido ?? null,
  };
};

// Pantallas viejas mandaban { fotoUrl, audioData } en "archivoAdjunto".
const adjuntosDe = (body) => {
  const lista = [];
  if (Array.isArray(body.adjuntos)) lista.push(...body.adjuntos);
  const v1 = body.archivoAdjunto;
  if (v1 && typeof v1 === 'object') {
    if (v1.fotoUrl) lista.push({ tipo: 'foto', contenido: v1.fotoUrl });
    if (v1.audioData) lista.push({ tipo: 'audio', contenido: v1.audioData });
  }
  if (lista.length > 6) throw badRequest('Se pueden adjuntar hasta 6 archivos por actividad');
  return lista.map((x, i) => {
    const contenido = dataUrl(x.contenido ?? x.data ?? x.url, `adjuntos[${i}]`, 6);
    if (!contenido) return null;
    const mime = contenido.slice(5, contenido.indexOf(';'));
    const tipo = x.tipo && ['foto', 'audio', 'documento'].includes(x.tipo) ? x.tipo : mime.startsWith('image/') ? 'foto' : mime.startsWith('audio/') ? 'audio' : 'documento';
    return {
      tipo,
      nombreArchivo: texto(x.nombreArchivo ?? x.nombre, 'nombreArchivo', 200) ?? null,
      mimeType: mime,
      tamanioKb: Math.ceil(((contenido.length - contenido.indexOf(',') - 1) * 3) / 4 / 1024),
      contenido,
    };
  }).filter(Boolean);
};

const datosActividad = (b) => {
  const d = {};
  if (b.tipoContacto !== undefined) d.tipoContacto = unoDe(normalizarTipo(b.tipoContacto), TIPOS_CONTACTO, 'tipoContacto');
  if (b.fechaHora !== undefined) {
    d.fechaHora = parseFechaHora(b.fechaHora, 'fecha y hora');
    // Una actividad registra algo que ya pasó (margen de 15 min por relojes desfasados).
    if (d.fechaHora && d.fechaHora.getTime() > Date.now() + 15 * 60000) throw badRequest('La fecha de la actividad no puede ser futura. Para algo pendiente, creá una tarea.', { fechaHora: 'futura' });
  }
  if (b.descripcion !== undefined) d.descripcion = texto(b.descripcion, 'descripcion', 10000);
  if (b.resultado !== undefined) d.resultado = texto(b.resultado, 'resultado', 255);
  if (b.montoVenta !== undefined) d.montoVenta = numero(b.montoVenta, 'montoVenta', { min: 0 });
  if (b.sinSeguimiento !== undefined) d.sinSeguimiento = Boolean(b.sinSeguimiento);
  return d;
};

// Oportunidad de la actividad: id explícito, alta en línea, o (pantallas v1)
// la oportunidad abierta más reciente de la empresa, creándola si no hay.
const resolverOportunidad = async (req, body, transaction) => {
  const id = toInt(body.oportunidadId ?? body.opportunityId);
  if (id && !Number.isNaN(id)) {
    const o = await Oportunidad.findByPk(id, { transaction });
    if (!o) throw badRequest('La oportunidad indicada no existe', { oportunidadId: 'inexistente' });
    return { oportunidad: o, creada: false };
  }
  const nueva = body.nuevaOportunidad;
  let empresaId = toInt(nueva?.empresaId ?? body.empresaId);
  if (!empresaId && typeof body.empresa === 'string' && body.empresa.trim()) {
    const e = await Empresa.findOne({ where: { razonSocial: body.empresa.trim() }, transaction });
    if (!e) throw badRequest(`No existe la empresa "${body.empresa.trim()}". Registrala primero o elegila de la lista.`, { empresa: 'inexistente' });
    empresaId = e.id;
  }
  if (!empresaId) return { oportunidad: null, creada: false };
  if (!nueva) {
    const abierta = await Oportunidad.findOne({
      where: { empresaId, estado: { [Op.in]: ESTADOS_ABIERTOS }, ...(isAdmin(req) ? {} : { [Op.or]: [{ usuarioId: req.user.idUser }, { usuarioId: null }] }) },
      order: [['fechaUltimaActualizacion', 'DESC']],
      transaction,
    });
    if (abierta) return { oportunidad: abierta, creada: false };
  }
  const o = await crearOportunidad(req, { ...(nueva || {}), empresaId }, transaction);
  return { oportunidad: o, creada: true };
};

const crearTareaDeSeguimiento = async (req, actividad, empresaId, t, transaction) => {
  const titulo = texto(t.titulo ?? t.descripcion, 'tarea.titulo', 200);
  const notas = texto(t.notas, 'tarea.notas', 5000);
  if (!titulo) throw badRequest('Indicá qué hay que hacer en la tarea de seguimiento', { 'tarea.titulo': 'obligatorio' });
  const fechaVencimiento = parseFecha(t.fechaVencimiento, 'tarea.fechaVencimiento');
  if (!fechaVencimiento) throw badRequest('Indicá la fecha de la tarea de seguimiento', { 'tarea.fechaVencimiento': 'obligatorio' });
  const tarea = await Tarea.create({
    titulo,
    descripcion: texto(t.descripcion, 'tarea.descripcion', 5000),
    tipo: unoDe(t.tipo || 'llamada', TIPOS_TAREA, 'tarea.tipo'),
    prioridad: unoDe(t.prioridad || 'Media', NIVELES, 'tarea.prioridad'),
    fechaVencimiento,
    horaVencimiento: /^\d{2}:\d{2}$/.test(t.horaVencimiento || '') ? t.horaVencimiento : null,
    notas: notas ?? null,
    empresaId,
    actividadId: actividad.id,
    creadoPorId: req.user.idUser,
  }, { transaction });
  const asignados = Array.isArray(t.asignadosIds) && t.asignadosIds.length ? [...new Set(t.asignadosIds.map(String))] : [req.user.idUser];
  if ((await Usuario.count({ where: { idUser: { [Op.in]: asignados } }, transaction })) !== asignados.length) throw badRequest('Algún usuario asignado no existe');
  await TareaAsignado.bulkCreate(asignados.map((usuarioId) => ({ tareaId: tarea.id, usuarioId })), { transaction });
  return { tarea, asignados };
};

export const listar = asyncHandler(async (req, res) => {
  const where = {};
  if (!isAdmin(req)) where.usuarioId = req.user.idUser;
  else if (req.query.usuarioId) where.usuarioId = String(req.query.usuarioId);
  if (req.query.oportunidadId) where.oportunidadId = toInt(req.query.oportunidadId);
  if (req.query.ordenServicioId) where.ordenServicioId = toInt(req.query.ordenServicioId);
  const desde = parseFecha(req.query.desde, 'desde');
  const hasta = parseFecha(req.query.hasta, 'hasta');
  if (desde || hasta) where.fechaHora = { ...(desde ? { [Op.gte]: parseFechaHora(desde) } : {}), ...(hasta ? { [Op.lt]: new Date(parseFechaHora(hasta).getTime() + 86400000) } : {}) };
  const empresaId = toInt(req.query.empresaId);
  if (empresaId) {
    const opps = await Oportunidad.findAll({ where: { empresaId }, attributes: ['id'], paranoid: false });
    const ordenes = await OrdenServicio.findAll({ where: { empresaId }, attributes: ['id'], paranoid: false });
    where[Op.and] = [{ [Op.or]: [{ oportunidadId: { [Op.in]: opps.map((o) => o.id).concat(0) } }, { ordenServicioId: { [Op.in]: ordenes.map((o) => o.id).concat(0) } }] }];
  }
  const actividades = await Actividad.findAll({
    where,
    include,
    order: [['fechaHora', 'DESC'], ['id', 'DESC']],
    limit: Math.min(Number(req.query.limit) || 1000, 3000),
  });
  res.json({ data: actividades.map(serializeActividad) });
});

const cargar = async (req, id) => {
  const a = await Actividad.findByPk(id, { include });
  if (!a) throw notFound('Actividad');
  if (!isAdmin(req) && a.usuarioId !== req.user.idUser) throw forbidden('Solo podés ver y editar tus propias actividades');
  return a;
};

export const obtener = asyncHandler(async (req, res) => {
  res.json({ data: serializeActividad(await cargar(req, idParam(req))) });
});

// CUU01 — Registrar una actividad. Todo en una transacción: oportunidad (si se
// crea en línea), actividad, adjuntos y tarea de seguimiento.
export const crear = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const clientUuid = texto(body.clientUuid, 'clientUuid', 36);
  if (clientUuid) {
    // Reenvío desde la cola offline: si ya se guardó, se devuelve la misma.
    const previa = await Actividad.findOne({ where: { clientUuid }, include });
    if (previa) {
      if (previa.usuarioId !== req.user.idUser && !isAdmin(req)) throw forbidden();
      return res.status(200).json({ message: 'La actividad ya estaba registrada', data: serializeActividad(previa), duplicada: true });
    }
  }
  const d = datosActividad(body);
  if (!d.fechaHora) d.fechaHora = new Date();
  const adjuntos = adjuntosDe(body);
  const ordenServicioId = toInt(body.ordenServicioId);

  const resultado = await sequelize.transaction(async (transaction) => {
    let oportunidad = null;
    let creada = false;
    let empresaId = null;
    if (ordenServicioId) {
      if (body.oportunidadId || body.nuevaOportunidad) throw badRequest('Una actividad pertenece a una oportunidad o a una orden de servicio, no a ambas');
      const os = await OrdenServicio.findByPk(ordenServicioId, { transaction });
      if (!os) throw badRequest('La orden de servicio no existe', { ordenServicioId: 'inexistente' });
      empresaId = os.empresaId;
    } else {
      ({ oportunidad, creada } = await resolverOportunidad(req, body, transaction));
      if (!oportunidad) throw badRequest('Elegí la empresa y la oportunidad de la actividad (o creá una nueva).', { oportunidadId: 'obligatorio' });
      empresaId = oportunidad.empresaId;
    }

    let paradaId = toInt(body.paradaId);
    if (paradaId) {
      const parada = await ParadaRuta.findByPk(paradaId, { include: [{ model: HojaRuta, as: 'hojaRuta', attributes: ['usuarioId'] }], transaction });
      if (!parada || (!isAdmin(req) && parada.hojaRuta?.usuarioId !== req.user.idUser)) paradaId = null;
      else if (parada.estado !== 'completada') await parada.update({ estado: 'completada' }, { transaction });
    }

    const actividad = await Actividad.create({
      ...d,
      tipoContacto: d.tipoContacto || 'visita',
      oportunidadId: oportunidad?.id ?? null,
      ordenServicioId: ordenServicioId || null,
      paradaId: paradaId || null,
      usuarioId: req.user.idUser, // el autor siempre es quien está logueado
      fechaRegistro: new Date(),
      clientUuid,
    }, { transaction });

    if (adjuntos.length) await Adjunto.bulkCreate(adjuntos.map((x) => ({ ...x, actividadId: actividad.id })), { transaction });

    if (oportunidad) {
      const cambios = { fechaUltimaActualizacion: d.fechaHora > (oportunidad.fechaUltimaActualizacion || 0) ? d.fechaHora : oportunidad.fechaUltimaActualizacion };
      if (oportunidad.estado === 'Prospecto') cambios.estado = 'Contactado';
      if (body.estadoOportunidad) cambios.estado = unoDe(body.estadoOportunidad, ['Prospecto', 'Contactado', 'Cotizado', 'Ganada', 'Perdida'], 'estadoOportunidad');
      await oportunidad.update(cambios, { transaction });
    }

    // Tareas de seguimiento (una o varias). "sinSeguimiento" deja constancia de que no hacen falta.
    const pedidas = Array.isArray(body.tareas) ? body.tareas : (body.tarea || body.seguimiento ? [body.tarea || body.seguimiento] : []);
    if (pedidas.length > 8) throw badRequest('Se pueden generar hasta 8 tareas de seguimiento por actividad');
    const tareas = [];
    if (!d.sinSeguimiento) {
      for (const t of pedidas) tareas.push(await crearTareaDeSeguimiento(req, actividad, empresaId, t, transaction));
    }
    return { actividad, oportunidadCreada: creada ? oportunidad : null, tareas };
  });

  for (const t of resultado.tareas) {
    for (const u of t.asignados.filter((x) => x !== req.user.idUser)) {
      await crearNotificacion(u, 'tarea_asignada', `Nueva tarea: ${t.tarea.titulo}`, 'tarea', t.tarea.id);
    }
  }
  const full = await Actividad.findByPk(resultado.actividad.id, { include });
  res.status(201).json({
    message: 'Actividad registrada',
    data: serializeActividad(full),
    oportunidadCreada: resultado.oportunidadCreada ? { id: resultado.oportunidadCreada.id, titulo: resultado.oportunidadCreada.titulo } : null,
    tareaId: resultado.tareas[0]?.tarea.id ?? null,
    tareaIds: resultado.tareas.map((t) => t.tarea.id),
  });
});

export const actualizar = asyncHandler(async (req, res) => {
  const a = await cargar(req, idParam(req));
  const body = req.body || {};
  const d = datosActividad(body);
  const adjuntos = adjuntosDe(body);
  await sequelize.transaction(async (transaction) => {
    const nuevaOpp = toInt(body.oportunidadId ?? body.opportunityId);
    if (nuevaOpp && !Number.isNaN(nuevaOpp) && nuevaOpp !== a.oportunidadId && !a.ordenServicioId) {
      if (!(await Oportunidad.findByPk(nuevaOpp, { transaction }))) throw badRequest('La oportunidad indicada no existe');
      d.oportunidadId = nuevaOpp;
    }
    await a.update(d, { transaction });
    if (adjuntos.length) await Adjunto.bulkCreate(adjuntos.map((x) => ({ ...x, actividadId: a.id })), { transaction });
    if (Array.isArray(body.quitarAdjuntos) && body.quitarAdjuntos.length) {
      await Adjunto.destroy({ where: { actividadId: a.id, id: { [Op.in]: body.quitarAdjuntos.map(Number) } }, transaction });
    }
  });
  const full = await Actividad.findByPk(a.id, { include });
  res.json({ message: 'Actividad actualizada', data: serializeActividad(full) });
});

export const eliminar = asyncHandler(async (req, res) => {
  const a = await cargar(req, idParam(req));
  await sequelize.transaction(async (transaction) => {
    await Adjunto.destroy({ where: { actividadId: a.id }, transaction });
    await Tarea.update({ actividadId: null }, { where: { actividadId: a.id }, transaction });
    await a.destroy({ transaction });
  });
  res.json({ message: 'Actividad eliminada', id: a.id });
});

// Contenido de un adjunto (data URL). Lo ve el autor de la actividad o la administración.
export const obtenerAdjunto = asyncHandler(async (req, res) => {
  const adj = await Adjunto.scope('conContenido').findByPk(idParam(req), {
    include: [{ model: Actividad, as: 'actividad', attributes: ['usuarioId'] }],
  });
  if (!adj) throw notFound('Adjunto');
  if (!isAdmin(req) && adj.actividad?.usuarioId !== req.user.idUser) throw forbidden('No podés ver este adjunto');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.json({ data: { id: adj.id, tipo: adj.tipo, mimeType: adj.mimeType, nombreArchivo: adj.nombreArchivo, contenido: adj.contenido } });
});
