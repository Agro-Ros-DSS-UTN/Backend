import { Op } from 'sequelize';
import {
  sequelize, OrdenServicio, ProductoAplicado, EvaluacionServicio, Empleado, Empresa, ItemCatalogo, Oportunidad, Usuario, Actividad,
} from '../models/index.js';
import { ESTADOS_ORDEN, RESULTADOS_EVALUACION } from '../models/servicios.model.js';
import { asyncHandler, badRequest, conflict, idParam, notFound, toInt } from '../utils/http.js';
import { dataUrl, numero, parseFecha, texto, unoDe } from '../utils/validacion.js';

const include = [
  { model: ProductoAplicado, as: 'productosAplicados', include: [{ model: ItemCatalogo, as: 'item', attributes: ['id', 'nombre'] }] },
  { model: EvaluacionServicio, as: 'evaluacion' },
  { model: Empleado, as: 'tecnicos', attributes: ['id', 'nombreApellido', 'matricula', 'rol'], through: { attributes: [] } },
  { model: Empresa, as: 'empresa', attributes: ['id', 'razonSocial', 'cuit'], paranoid: false },
  { model: ItemCatalogo, as: 'servicio', attributes: ['id', 'nombre', 'tipoServicio'] },
  { model: Oportunidad, as: 'oportunidad', attributes: ['id', 'titulo', 'estado'], paranoid: false },
  { model: Usuario, as: 'creadoPor', attributes: ['idUser', 'nombreApellido'] },
];

export const serializeOrden = (o) => {
  if (!o) return null;
  const j = typeof o.toJSON === 'function' ? o.toJSON() : o;
  const tecnicos = (j.tecnicos || []).map((t) => ({ id: t.id, nombreApellido: t.nombreApellido, matricula: t.matricula }));
  const ev = j.evaluacion
    ? { ...j.evaluacion, eficacia: j.evaluacion.eficacia, ppmPH3: j.evaluacion.ppmPH3 !== null && j.evaluacion.ppmPH3 !== undefined ? Number(j.evaluacion.ppmPH3) : null }
    : null;
  return {
    ...j,
    tecnicos,
    tecnicoIds: tecnicos.map((t) => t.id),
    evaluacion: ev,
    empresa: j.empresa ? { id: j.empresa.id, razonSocial: j.empresa.razonSocial, cuit: j.empresa.cuit } : null,
    servicio: j.servicio ? { id: j.servicio.id, nombre: j.servicio.nombre, tipoServicio: j.servicio.tipoServicio } : null,
    // compatibilidad v1
    fecha: j.fechaProgramada,
    observacionesOrden: j.observaciones ?? null,
    tecnicoAplicador: tecnicos.map((t) => t.nombreApellido).join(', ') || null,
  };
};

const detalleFila = (p, i) => {
  const t = (k, max = 150) => texto(p[k], `productosAplicados[${i}].${k}`, max) ?? null;
  const itemId = toInt(p.itemId);
  return {
    itemId: itemId && !Number.isNaN(itemId) ? itemId : null,
    tipoInstalacion: t('tipoInstalacion', 40), numero: t('numero', 20), capacidadTn: t('capacidadTn', 20), grano: t('grano', 60),
    cantidadTn: t('cantidadTn', 20), estadoCereal: t('estadoCereal', 10), estadoInstalaciones: t('estadoInstalaciones', 10),
    estadoInfestacion: t('estadoInfestacion', 10), producto: t('producto'), principioActivo: t('principioActivo'),
    dosis: t('dosis', 100), lote: t('lote', 100), tiempoCarencia: t('tiempoCarencia', 100), cantidadTotal: t('cantidadTotal', 100),
  };
};

const imagen = (v, campo) => {
  if (v === undefined) return undefined;
  if (!v) return null;
  const s = dataUrl(v, campo, 8);
  if (!/^data:(image\/|application\/pdf)/i.test(s)) throw badRequest(`${campo}: solo se aceptan imágenes o PDF`, { [campo]: 'tipo no permitido' });
  return s;
};

const datosOrden = (b) => {
  const d = {};
  const set = (k, v) => { if (v !== undefined) d[k] = v; };
  set('numeroOrden', texto(b.numeroOrden, 'numeroOrden', 50));
  const fp = b.fechaProgramada !== undefined ? b.fechaProgramada : b.fecha;
  set('fechaProgramada', fp !== undefined ? parseFecha(fp, 'fechaProgramada') : undefined);
  set('fechaRealizada', b.fechaRealizada !== undefined ? parseFecha(b.fechaRealizada, 'fechaRealizada') : undefined);
  set('estado', b.estado !== undefined ? unoDe(b.estado, ESTADOS_ORDEN, 'estado') : undefined);
  for (const [k, max] of [['clienteId', 50], ['clienteNombre', 150], ['centroId', 50], ['centroNombre', 150], ['plantaId', 50], ['plantaNombre', 150], ['silo', 200], ['direccion', 255], ['localidad', 100], ['provincia', 100], ['tipoTrabajo', 100]]) {
    if (b[k] !== undefined) d[k] = texto(b[k] === null ? null : String(b[k]), k, max);
  }
  set('observaciones', texto(b.observaciones !== undefined ? b.observaciones : b.observacionesOrden, 'observaciones', 10000));
  set('recomendaciones', texto(b.recomendaciones, 'recomendaciones', 10000));
  set('firmaTecnico', imagen(b.firmaTecnico, 'firmaTecnico'));
  set('firmaCliente', imagen(b.firmaCliente, 'firmaCliente'));
  set('imagenOrdenOriginal', imagen(b.imagenOrdenOriginal, 'imagenOrdenOriginal'));
  return d;
};

// Vincula empresa, servicio, oportunidad y técnicos. Acepta ids o (pantalla v1) nombres.
const resolverReferencias = async (b, d, transaction) => {
  if (b.empresaId !== undefined) {
    d.empresaId = b.empresaId ? toInt(b.empresaId) : null;
    if (d.empresaId && !(await Empresa.findByPk(d.empresaId, { transaction }))) throw badRequest('La empresa indicada no existe', { empresaId: 'inexistente' });
  } else if (d.clienteNombre) {
    const e = await Empresa.findOne({ where: { razonSocial: d.clienteNombre }, transaction });
    if (e) d.empresaId = e.id;
  }
  if (b.servicioId !== undefined) {
    d.servicioId = b.servicioId ? toInt(b.servicioId) : null;
    if (d.servicioId) {
      const s = await ItemCatalogo.findByPk(d.servicioId, { transaction });
      if (!s || s.tipo !== 'servicio') throw badRequest('El servicio indicado no existe en el catálogo', { servicioId: 'inexistente' });
      if (!d.tipoTrabajo) d.tipoTrabajo = s.nombre;
    }
  } else if (d.tipoTrabajo) {
    const s = await ItemCatalogo.findOne({ where: { tipo: 'servicio', nombre: d.tipoTrabajo }, transaction });
    if (s) d.servicioId = s.id;
  }
  if (b.oportunidadId !== undefined) {
    d.oportunidadId = b.oportunidadId ? toInt(b.oportunidadId) : null;
    if (d.oportunidadId && !(await Oportunidad.findByPk(d.oportunidadId, { transaction }))) throw badRequest('La oportunidad indicada no existe', { oportunidadId: 'inexistente' });
  }
  // Técnicos: solo empleados activos con rol "tecnico".
  let tecnicoIds;
  if (Array.isArray(b.tecnicoIds)) tecnicoIds = [...new Set(b.tecnicoIds.map((x) => toInt(x)).filter(Boolean))];
  else if (typeof b.tecnicoAplicador === 'string') {
    const nombres = b.tecnicoAplicador.split(/[,;/]| y /).map((s) => s.trim()).filter(Boolean);
    tecnicoIds = [];
    for (const n of nombres) {
      const emp = await Empleado.findOne({ where: { nombreApellido: n, rol: 'tecnico' }, transaction });
      if (!emp) throw badRequest(`"${n}" no está registrado como técnico. Cargalo en Empleados con rol Técnico.`, { tecnicoAplicador: 'no es técnico' });
      tecnicoIds.push(emp.id);
    }
  }
  if (tecnicoIds?.length) {
    const validos = await Empleado.findAll({ where: { id: { [Op.in]: tecnicoIds }, rol: 'tecnico', activo: true }, attributes: ['id'], transaction });
    if (validos.length !== tecnicoIds.length) throw badRequest('Solo se pueden asignar empleados activos con rol Técnico', { tecnicoIds: 'no es técnico' });
  }
  return tecnicoIds;
};

export const listar = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.estado) where.estado = unoDe(String(req.query.estado), ESTADOS_ORDEN, 'estado');
  if (req.query.empresaId) where.empresaId = toInt(req.query.empresaId);
  const desde = parseFecha(req.query.desde, 'desde');
  const hasta = parseFecha(req.query.hasta, 'hasta');
  if (desde || hasta) where.fechaProgramada = { ...(desde ? { [Op.gte]: desde } : {}), ...(hasta ? { [Op.lte]: hasta } : {}) };
  const ordenes = await OrdenServicio.findAll({ where, include, order: [['fechaProgramada', 'DESC'], ['id', 'DESC']], paranoid: req.query.incluirBajas !== '1' });
  res.json({ data: ordenes.map(serializeOrden) });
});

export const obtener = asyncHandler(async (req, res) => {
  const o = await OrdenServicio.findByPk(idParam(req), { include: [...include, { model: Actividad, as: 'visitasTecnicas', attributes: ['id', 'fechaHora', 'descripcion', 'usuarioId'] }] });
  if (!o) throw notFound('Orden de servicio');
  res.json({ data: serializeOrden(o) });
});

export const crear = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const d = datosOrden(b);
  if (!d.numeroOrden) throw badRequest('El número de orden es obligatorio', { numeroOrden: 'obligatorio' });
  if (await OrdenServicio.findOne({ where: { numeroOrden: d.numeroOrden }, paranoid: false })) throw conflict(`Ya existe la orden N° ${d.numeroOrden}`);
  const id = await sequelize.transaction(async (transaction) => {
    const tecnicoIds = await resolverReferencias(b, d, transaction);
    if (!d.clienteNombre && d.empresaId) d.clienteNombre = (await Empresa.findByPk(d.empresaId, { transaction })).razonSocial;
    if (!d.clienteNombre) throw badRequest('Indicá la empresa o el nombre del cliente', { clienteNombre: 'obligatorio' });
    const o = await OrdenServicio.create({
      ...d,
      fechaProgramada: d.fechaProgramada || new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10),
      tipoTrabajo: d.tipoTrabajo || 'Fumigación de Silo',
      estado: d.estado || 'Programada',
      creadoPorId: req.user.idUser,
    }, { transaction });
    if (tecnicoIds?.length) await o.setTecnicos(tecnicoIds, { transaction });
    if (Array.isArray(b.productosAplicados) && b.productosAplicados.length) {
      await ProductoAplicado.bulkCreate(b.productosAplicados.map(detalleFila).map((p) => ({ ...p, ordenServicioId: o.id })), { transaction });
    }
    return o.id;
  });
  res.status(201).json({ message: 'Orden de servicio creada', data: serializeOrden(await OrdenServicio.findByPk(id, { include })) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const o = await OrdenServicio.findByPk(idParam(req));
  if (!o) throw notFound('Orden de servicio');
  const b = req.body || {};
  const d = datosOrden(b);
  if (d.numeroOrden === null || d.clienteNombre === null) throw badRequest('El número de orden y el cliente no pueden quedar vacíos');
  if (d.numeroOrden && d.numeroOrden !== o.numeroOrden && (await OrdenServicio.findOne({ where: { numeroOrden: d.numeroOrden }, paranoid: false }))) throw conflict(`Ya existe la orden N° ${d.numeroOrden}`);
  if (d.estado === 'Completada' && !o.fechaRealizada && d.fechaRealizada === undefined) d.fechaRealizada = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  await sequelize.transaction(async (transaction) => {
    const tecnicoIds = await resolverReferencias(b, d, transaction);
    await o.update(d, { transaction });
    if (tecnicoIds) await o.setTecnicos(tecnicoIds, { transaction });
    if (Array.isArray(b.productosAplicados)) {
      await ProductoAplicado.destroy({ where: { ordenServicioId: o.id }, transaction });
      if (b.productosAplicados.length) await ProductoAplicado.bulkCreate(b.productosAplicados.map(detalleFila).map((p) => ({ ...p, ordenServicioId: o.id })), { transaction });
    }
  });
  res.json({ message: 'Orden de servicio actualizada', data: serializeOrden(await OrdenServicio.findByPk(o.id, { include })) });
});

// Planilla de evaluación post-tratamiento + satisfacción del cliente (para el tablero CUU06).
export const guardarEvaluacion = asyncHandler(async (req, res) => {
  const o = await OrdenServicio.findByPk(idParam(req));
  if (!o) throw notFound('Orden de servicio');
  const b = req.body || {};
  const fotos = Array.isArray(b.fotos) ? b.fotos.slice(0, 10).map((f, i) => imagen(typeof f === 'object' ? f?.url ?? f?.data : f, `fotos[${i}]`)) : undefined;
  const payload = {
    ordenServicioId: o.id,
    fechaEvaluacion: parseFecha(b.fechaEvaluacion, 'fechaEvaluacion') || new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10),
    estadoCereal: texto(b.estadoCereal, 'estadoCereal', 5) || 'A',
    lugarToma: texto(b.lugarToma, 'lugarToma', 150) || 'Superficie',
    resultado: unoDe(b.resultado || 'Sin insectos vivos', RESULTADOS_EVALUACION, 'resultado'),
    ppmPH3: numero(b.ppmPH3, 'ppmPH3', { min: 0 }),
    observaciones: texto(b.observaciones, 'observaciones', 10000) ?? null,
    recomendaciones: texto(b.recomendaciones, 'recomendaciones', 10000) ?? null,
    detalle: Array.isArray(b.detalle) ? JSON.stringify(b.detalle).slice(0, 2_000_000) : texto(b.detalle, 'detalle', 2_000_000) ?? null,
    fotos: fotos ? JSON.stringify(fotos.filter(Boolean)) : null,
    firmaCliente: imagen(b.firmaCliente, 'firmaCliente') ?? null,
    firmaTecnico: imagen(b.firmaTecnico, 'firmaTecnico') ?? null,
    satisfaccionCliente: numero(b.satisfaccionCliente, 'satisfaccionCliente', { entero: true, min: 1, max: 5 }),
    comentarioCliente: texto(b.comentarioCliente, 'comentarioCliente', 2000) ?? null,
  };
  await sequelize.transaction(async (transaction) => {
    const ev = await EvaluacionServicio.findOne({ where: { ordenServicioId: o.id }, transaction });
    if (ev) await ev.update(payload, { transaction });
    else await EvaluacionServicio.create(payload, { transaction });
    if (o.estado === 'Programada' || o.estado === 'En Ejecución') {
      await o.update({ estado: 'Completada', fechaRealizada: o.fechaRealizada || payload.fechaEvaluacion }, { transaction });
    }
  });
  res.json({ message: 'Evaluación guardada', data: serializeOrden(await OrdenServicio.findByPk(o.id, { include })) });
});

// Baja lógica: la orden deja de verse (y de contar en el tablero) pero se puede restaurar.
export const eliminar = asyncHandler(async (req, res) => {
  const o = await OrdenServicio.findByPk(idParam(req));
  if (!o) throw notFound('Orden de servicio');
  await o.destroy();
  res.json({ message: 'Orden de servicio dada de baja' });
});

export const restaurar = asyncHandler(async (req, res) => {
  const o = await OrdenServicio.findByPk(idParam(req), { paranoid: false });
  if (!o) throw notFound('Orden de servicio');
  await o.restore();
  res.json({ message: 'Orden restaurada', data: serializeOrden(o) });
});
