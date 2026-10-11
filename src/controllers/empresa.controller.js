import { Op, fn, col, literal } from 'sequelize';
import {
  sequelize, Empresa, Localidad, Provincia, Contacto, ContactoTelefono, Usuario, Cultivo, Oportunidad,
  OrdenServicio, EvaluacionServicio, ItemCatalogo, UsuarioLocalidad,
} from '../models/index.js';
import { NIVELES_EMPRESA } from '../models/empresa.model.js';
import { ESTADOS_ABIERTOS } from '../models/comercial.model.js';
import { eficaciaDe } from '../models/servicios.model.js';
import { isAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler, badRequest, forbidden, idParam, notFound, pick, toInt } from '../utils/http.js';
import { cuitValido, formatearCuit, numero, requerido, texto, unoDe } from '../utils/validacion.js';
import { resolverLocalidad, serializeLocalidad } from './territorio.controller.js';
import { serializeContacto } from './contacto.controller.js';

const includeBase = [
  { model: Localidad, as: 'localidad', include: [{ model: Provincia, as: 'provincia' }] },
  { model: Usuario, as: 'creadoPor', attributes: ['idUser', 'nombreApellido', 'rol'] },
];

export const serializeEmpresa = (e) => {
  if (!e) return null;
  const j = typeof e.toJSON === 'function' ? e.toJSON() : e;
  const loc = j.localidad ? serializeLocalidad(j.localidad) : null;
  const contactos = Array.isArray(j.contactos) ? j.contactos.map(serializeContacto) : undefined;
  return {
    id: j.id,
    razonSocial: j.razonSocial,
    nombreFantasia: j.nombreFantasia ?? null,
    descripcion: j.descripcion ?? null,
    cuit: j.cuit,
    direccion: j.direccion ?? null,
    tipoEmpresa: j.tipoEmpresa,
    superficieHa: j.superficieHa !== null && j.superficieHa !== undefined ? Number(j.superficieHa) : null,
    proveedorActual: j.proveedorActual ?? null,
    nivel: j.nivel,
    empresaPadreId: j.empresaPadreId ?? null,
    localidadId: j.localidadId ?? null,
    // "localidad" queda como texto (las pantallas lo muestran tal cual); el detalle aparte.
    localidad: loc?.nombre ?? null,
    localidadDetalle: loc ? { id: loc.id, nombre: loc.nombre, codigoPostal: loc.codigoPostal, provinciaId: loc.provinciaId, provincia: loc.provincia?.nombre ?? null } : null,
    provincia: loc?.provincia?.nombre ?? null,
    latitud: j.latitud !== null && j.latitud !== undefined ? Number(j.latitud) : null,
    longitud: j.longitud !== null && j.longitud !== undefined ? Number(j.longitud) : null,
    creadoPorId: j.creadoPorId ?? null,
    creadoPorNombre: j.creadoPor?.nombreApellido ?? null,
    creadoPorRole: j.creadoPor?.rol ?? null,
    fechaRegistro: j.fechaRegistro,
    fechaBaja: j.fechaBaja ?? null,
    cultivos: Array.isArray(j.cultivos) ? j.cultivos.map((c) => ({ id: c.id, nombre: c.nombre })) : undefined,
    contactos,
    oportunidadesAbiertas: j.oportunidadesAbiertas !== undefined ? Number(j.oportunidadesAbiertas) : undefined,
    // compatibilidad v1
    nombreEmpresa: j.razonSocial,
    descEmpresa: j.descripcion ?? null,
    direccionEmpresa: j.direccion ?? null,
    parentCompanyId: j.empresaPadreId ?? null,
    nivelEmpresa: j.nivel,
    Locality: loc ? { nomLocalidad: loc.nombre, codPostal: loc.codigoPostal, Province: loc.Province } : null,
    localityCodPostal: loc?.codigoPostal ?? null,
    Clients: contactos,
  };
};

const datosEmpresa = (body, { cuitActual } = {}) => {
  const b = {
    ...body,
    razonSocial: body.razonSocial ?? body.nombreEmpresa,
    descripcion: body.descripcion ?? body.descEmpresa,
    direccion: body.direccion ?? body.direccionEmpresa,
    nivel: body.nivel ?? body.nivelEmpresa,
    empresaPadreId: body.empresaPadreId !== undefined ? body.empresaPadreId : body.parentCompanyId,
  };
  const d = pick(b, ['razonSocial', 'nombreFantasia', 'descripcion', 'cuit', 'direccion', 'tipoEmpresa', 'superficieHa', 'proveedorActual', 'nivel', 'empresaPadreId', 'latitud', 'longitud']);
  if (d.razonSocial !== undefined) d.razonSocial = texto(d.razonSocial, 'razonSocial', 150);
  if (d.nombreFantasia !== undefined) d.nombreFantasia = texto(d.nombreFantasia, 'nombreFantasia', 150);
  if (d.descripcion !== undefined) d.descripcion = texto(d.descripcion, 'descripcion', 5000);
  if (d.direccion !== undefined) d.direccion = texto(d.direccion, 'direccion', 150);
  if (d.tipoEmpresa !== undefined) d.tipoEmpresa = texto(d.tipoEmpresa, 'tipoEmpresa', 50);
  if (d.proveedorActual !== undefined) d.proveedorActual = texto(d.proveedorActual, 'proveedorActual', 150);
  if (d.superficieHa !== undefined) d.superficieHa = numero(d.superficieHa, 'superficieHa', { min: 0 });
  if (d.latitud !== undefined) d.latitud = numero(d.latitud, 'latitud', { min: -90, max: 90 });
  if (d.longitud !== undefined) d.longitud = numero(d.longitud, 'longitud', { min: -180, max: 180 });
  if (d.nivel !== undefined) d.nivel = unoDe(d.nivel, NIVELES_EMPRESA, 'nivel');
  if (d.empresaPadreId !== undefined) d.empresaPadreId = d.empresaPadreId ? toInt(d.empresaPadreId) : null;
  const soloDigitos = (v) => String(v || '').replace(/\D/g, '');
  if (d.cuit !== undefined && cuitActual !== undefined && soloDigitos(d.cuit) === soloDigitos(cuitActual)) {
    delete d.cuit; // sin cambios: no se revalidan CUIT cargados antes de la v2
  } else if (d.cuit !== undefined) {
    if (!cuitValido(d.cuit)) throw badRequest('El CUIT no es válido (revisá el dígito verificador)', { cuit: 'inválido' });
    d.cuit = formatearCuit(d.cuit);
  }
  return d;
};

// Admin, quien la registró, o un vendedor que tiene la localidad en su zona.
const puedeEditar = async (req, empresa) => {
  if (isAdmin(req) || empresa.creadoPorId === req.user.idUser) return true;
  if (!empresa.localidadId) return false;
  return Boolean(await UsuarioLocalidad.findOne({ where: { usuarioId: req.user.idUser, localidadId: empresa.localidadId } }));
};

// La administración puede indicar quién es el responsable del registro.
const creadorElegido = async (req, id, transaction) => {
  if (!isAdmin(req) || !id) return null;
  const u = await Usuario.findByPk(String(id), { transaction });
  if (!u) throw badRequest('El usuario responsable indicado no existe', { creadoPorId: 'inexistente' });
  return u.idUser;
};

const idsDeLaRama = async (raizId) => {
  const ids = [raizId];
  let frontera = [raizId];
  for (let nivel = 0; nivel < 4 && frontera.length; nivel++) {
    const hijos = await Empresa.findAll({ where: { empresaPadreId: { [Op.in]: frontera } }, attributes: ['id'] });
    frontera = hijos.map((h) => h.id).filter((id) => !ids.includes(id));
    ids.push(...frontera);
  }
  return ids;
};

export const listar = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.tipoEmpresa) where.tipoEmpresa = String(req.query.tipoEmpresa);
  if (req.query.localidadId) where.localidadId = String(req.query.localidadId);
  const q = String(req.query.q || '').trim();
  if (q) where[Op.or] = [{ razonSocial: { [Op.like]: `%${q}%` } }, { nombreFantasia: { [Op.like]: `%${q}%` } }, { cuit: { [Op.like]: `%${q}%` } }];
  if (req.query.miZona === '1' || req.query.miZona === 'true') {
    const zona = await UsuarioLocalidad.findAll({ where: { usuarioId: req.user.idUser }, attributes: ['localidadId'] });
    if (zona.length) where.localidadId = { [Op.in]: zona.map((z) => z.localidadId) };
  }
  const conBajas = isAdmin(req) && req.query.incluirBajas === '1';
  const empresas = await Empresa.findAll({
    where,
    paranoid: !conBajas,
    include: [
      ...includeBase,
      { model: Contacto, as: 'contactos', required: false, include: [{ model: ContactoTelefono, as: 'telefonos' }] },
    ],
    attributes: {
      include: [[literal(`(SELECT COUNT(*) FROM oportunidades o WHERE o.empresa_id = Empresa.id AND o.fecha_baja IS NULL AND o.estado IN (${ESTADOS_ABIERTOS.map((e) => `'${e}'`).join(',')}))`), 'oportunidadesAbiertas']],
    },
    order: [['razonSocial', 'ASC']],
  });
  res.json({ data: empresas.map(serializeEmpresa) });
});

export const obtener = asyncHandler(async (req, res) => {
  const id = idParam(req);
  const e = await Empresa.findByPk(id, {
    paranoid: !isAdmin(req),
    include: [
      ...includeBase,
      { model: Contacto, as: 'contactos', include: [{ model: ContactoTelefono, as: 'telefonos' }] },
      { model: Cultivo, as: 'cultivos', through: { attributes: [] } },
    ],
  });
  if (!e) throw notFound('Empresa');
  res.json({ data: serializeEmpresa(e) });
});

// Jerarquía completa (madre → regiones → subsedes) a partir de cualquier nodo.
export const arbol = asyncHandler(async (req, res) => {
  let actual = await Empresa.findByPk(idParam(req));
  if (!actual) throw notFound('Empresa');
  for (let i = 0; i < 5 && actual.empresaPadreId; i++) {
    const padre = await Empresa.findByPk(actual.empresaPadreId);
    if (!padre) break;
    actual = padre;
  }
  const inc = [...includeBase, { model: Contacto, as: 'contactos', include: [{ model: ContactoTelefono, as: 'telefonos' }] }];
  const madre = await Empresa.findByPk(actual.id, { include: inc });
  const regiones = await Empresa.findAll({ where: { empresaPadreId: madre.id }, include: inc, order: [['razonSocial', 'ASC']] });
  const subsedes = regiones.length
    ? await Empresa.findAll({ where: { empresaPadreId: { [Op.in]: regiones.map((r) => r.id) } }, include: inc, order: [['razonSocial', 'ASC']] })
    : [];
  res.json({
    data: {
      ...serializeEmpresa(madre),
      regiones: regiones.map((r) => ({ ...serializeEmpresa(r), subsedes: subsedes.filter((s) => s.empresaPadreId === r.id).map(serializeEmpresa) })),
    },
  });
});

export const crear = asyncHandler(async (req, res) => {
  // Una regional o subsede con el mismo CUIT que su empresa principal no se revalida.
  const padreId = toInt(req.body?.empresaPadreId ?? req.body?.parentCompanyId);
  const padre = padreId ? await Empresa.findByPk(padreId) : null;
  const d = datosEmpresa(req.body || {}, { cuitActual: padre?.cuit });
  requerido(d, ['razonSocial', 'cuit']);
  const result = await sequelize.transaction(async (transaction) => {
    const localidadId = await resolverLocalidad({
      localidadId: req.body.localidadId,
      localidad: req.body.localidad,
      codigoPostal: req.body.codigoPostal ?? req.body.localityCodPostal,
    }, { transaction });
    if (d.empresaPadreId && !(await Empresa.findByPk(d.empresaPadreId, { transaction }))) throw badRequest('La empresa principal no existe');
    const creadoPorId = await creadorElegido(req, req.body.creadoPorId, transaction);
    const empresa = await Empresa.create({
      ...d,
      tipoEmpresa: d.tipoEmpresa || 'Productor',
      nivel: d.nivel || (d.empresaPadreId ? 'subsede' : 'independiente'),
      localidadId: localidadId ?? null,
      creadoPorId: creadoPorId || req.user.idUser,
    }, { transaction });

    if (Array.isArray(req.body.cultivoIds)) await empresa.setCultivos(req.body.cultivoIds.map(Number).filter(Boolean), { transaction });

    // Alta opcional de un contacto en el mismo paso (compatibilidad con el formulario actual).
    let contacto = null;
    const nuevo = req.body.contacto || req.body.newContact;
    const existenteId = req.body.contactoExistenteId;
    if (existenteId) {
      contacto = await Contacto.findByPk(Number(existenteId), { transaction });
      if (contacto) await contacto.update({ empresaId: empresa.id }, { transaction });
    } else if (nuevo && (nuevo.nombreApellido || nuevo.nombre)) {
      const nombre = texto(nuevo.nombreApellido || `${nuevo.nombre || ''} ${nuevo.apellido || ''}`, 'nombreApellido', 150);
      contacto = await Contacto.create({
        nombreApellido: nombre,
        dni: texto(nuevo.dni ?? nuevo.numDoc, 'dni', 20),
        cargo: texto(nuevo.cargo ?? nuevo.tipoClient ?? nuevo.puesto, 'cargo', 50),
        email: texto(nuevo.email ?? nuevo.direccionMail, 'email', 150),
        observaciones: texto(nuevo.observaciones ?? nuevo.nota, 'observaciones', 5000),
        esPrincipal: true,
        empresaId: empresa.id,
      }, { transaction });
      const tel = texto(nuevo.telefono, 'telefono', 30);
      if (tel) await ContactoTelefono.create({ contactoId: contacto.id, numero: tel }, { transaction });
    }
    return { empresa, contacto };
  });
  const full = await Empresa.findByPk(result.empresa.id, { include: [...includeBase, { model: Contacto, as: 'contactos' }] });
  res.status(201).json({ message: 'Empresa registrada', data: serializeEmpresa(full), contact: result.contacto ? serializeContacto(result.contacto) : null });
});

export const actualizar = asyncHandler(async (req, res) => {
  const id = idParam(req);
  const empresa = await Empresa.findByPk(id);
  if (!empresa) throw notFound('Empresa');
  if (!(await puedeEditar(req, empresa))) throw forbidden('Solo la administración, quien registró la empresa o el vendedor de la zona pueden editarla');
  const d = datosEmpresa(req.body || {}, { cuitActual: empresa.cuit });
  if (d.empresaPadreId === id) throw badRequest('Una empresa no puede ser su propia empresa principal');
  if (d.empresaPadreId && (await idsDeLaRama(id)).includes(d.empresaPadreId)) throw badRequest('La empresa principal no puede ser una de sus propias sucursales');
  await sequelize.transaction(async (transaction) => {
    const localidadId = await resolverLocalidad({
      localidadId: req.body.localidadId,
      localidad: req.body.localidad,
      codigoPostal: req.body.codigoPostal ?? req.body.localityCodPostal,
    }, { transaction });
    if (localidadId !== undefined) d.localidadId = localidadId;
    if (isAdmin(req) && req.body.creadoPorId !== undefined) d.creadoPorId = (await creadorElegido(req, req.body.creadoPorId, transaction)) || null;
    await empresa.update(d, { transaction });
    if (Array.isArray(req.body.cultivoIds)) await empresa.setCultivos(req.body.cultivoIds.map(Number).filter(Boolean), { transaction });
  });
  const full = await Empresa.findByPk(id, { include: [...includeBase, { model: Contacto, as: 'contactos' }] });
  res.json({ message: 'Empresa actualizada', data: serializeEmpresa(full) });
});

// Baja lógica (solo administración). El historial queda intacto.
export const eliminar = asyncHandler(async (req, res) => {
  const empresa = await Empresa.findByPk(idParam(req));
  if (!empresa) throw notFound('Empresa');
  await empresa.destroy();
  res.json({ message: 'Empresa dada de baja. Se puede restaurar desde Empresas → Ver bajas.' });
});

export const restaurar = asyncHandler(async (req, res) => {
  const empresa = await Empresa.findByPk(idParam(req), { paranoid: false });
  if (!empresa) throw notFound('Empresa');
  await empresa.restore();
  res.json({ message: 'Empresa restaurada', data: serializeEmpresa(empresa) });
});

// CUU06: tablero de servicios de la empresa para mostrarle al cliente.
// Incluye las sucursales de la empresa. Si no tiene órdenes, devuelve los
// indicadores generales de la provincia sin datos que identifiquen a otros clientes.
export const tablero = asyncHandler(async (req, res) => {
  const id = idParam(req);
  const empresa = await Empresa.findByPk(id, { include: [{ model: Localidad, as: 'localidad' }] });
  if (!empresa) throw notFound('Empresa');
  const meses = [6, 12, 24].includes(Number(req.query.meses)) ? Number(req.query.meses) : 12;
  const desde = new Date();
  desde.setUTCMonth(desde.getUTCMonth() - meses + 1, 1);
  const desdeStr = desde.toISOString().slice(0, 10);

  const servicioWhere = req.query.tipoServicio ? { tipoServicio: String(req.query.tipoServicio) } : undefined;
  const calcular = async (empresaIds) => {
    const ordenes = await OrdenServicio.findAll({
      where: { ...(empresaIds ? { empresaId: { [Op.in]: empresaIds } } : {}), fechaProgramada: { [Op.gte]: desdeStr } },
      include: [
        { model: EvaluacionServicio, as: 'evaluacion', attributes: ['resultado', 'satisfaccionCliente', 'fechaEvaluacion'] },
        { model: ItemCatalogo, as: 'servicio', attributes: ['id', 'nombre', 'tipoServicio'], ...(servicioWhere ? { where: servicioWhere, required: true } : { required: false }) },
      ],
      attributes: ['id', 'numeroOrden', 'fechaProgramada', 'fechaRealizada', 'estado', 'tipoTrabajo', 'empresaId'],
      order: [['fechaProgramada', 'ASC']],
    });
    const realizadas = ordenes.filter((o) => o.estado === 'Completada');
    const enFecha = realizadas.filter((o) => o.fechaRealizada && o.fechaRealizada <= o.fechaProgramada);
    const sat = realizadas.map((o) => o.evaluacion?.satisfaccionCliente).filter((n) => n);
    const porMes = [];
    for (let i = 0; i < meses; i++) {
      const d = new Date(desde);
      d.setUTCMonth(desde.getUTCMonth() + i);
      const clave = d.toISOString().slice(0, 7);
      porMes.push({ mes: clave, realizadas: realizadas.filter((o) => String(o.fechaRealizada || o.fechaProgramada).startsWith(clave)).length });
    }
    const resultados = { eficaz: 0, parcial: 0, ineficaz: 0, sinEvaluar: 0 };
    for (const o of realizadas) {
      const ef = eficaciaDe(o.evaluacion?.resultado);
      resultados[ef || 'sinEvaluar']++;
    }
    const porServicio = {};
    for (const o of realizadas) {
      const nombre = o.servicio?.nombre || o.tipoTrabajo || 'Otro';
      porServicio[nombre] = (porServicio[nombre] || 0) + 1;
    }
    return {
      ordenesRealizadas: realizadas.length,
      ordenesProgramadas: ordenes.filter((o) => o.estado === 'Programada' || o.estado === 'En Ejecución').length,
      cumplimiento: realizadas.length ? Math.round((enFecha.length / realizadas.length) * 1000) / 10 : null,
      satisfaccionPromedio: sat.length ? Math.round((sat.reduce((a, b) => a + b, 0) / sat.length) * 10) / 10 : null,
      evaluaciones: sat.length,
      resultados,
      porMes,
      serviciosMasContratados: Object.entries(porServicio).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nombre, cantidad]) => ({ nombre, cantidad })),
      ordenes,
    };
  };

  const ids = await idsDeLaRama(id);
  const propios = await calcular(ids);
  let alcance = 'empresa';
  let datos = propios;
  if (propios.ordenesRealizadas === 0) {
    // Prospecto: indicadores generales de la provincia (o de toda la empresa si no hay localidad).
    const provinciaId = empresa.localidad?.provinciaId;
    let zonaIds = null;
    if (provinciaId) {
      const enProvincia = await Empresa.findAll({ include: [{ model: Localidad, as: 'localidad', where: { provinciaId }, attributes: [] }], attributes: ['id'] });
      zonaIds = enProvincia.map((e) => e.id);
    }
    datos = await calcular(zonaIds);
    alcance = provinciaId ? 'provincia' : 'general';
  }
  const { ordenes, ...indicadores } = datos;
  res.json({
    data: {
      empresa: { id: empresa.id, razonSocial: empresa.razonSocial },
      alcance,
      meses,
      actualizadoAl: new Date().toISOString(),
      ...indicadores,
      // El detalle de órdenes solo se muestra cuando son de la propia empresa.
      ultimasOrdenes: alcance === 'empresa'
        ? ordenes.filter((o) => o.estado === 'Completada').slice(-5).reverse().map((o) => ({
            numeroOrden: o.numeroOrden, fecha: o.fechaRealizada || o.fechaProgramada, servicio: o.servicio?.nombre || o.tipoTrabajo,
            resultado: o.evaluacion?.resultado || null, satisfaccion: o.evaluacion?.satisfaccionCliente || null,
          }))
        : [],
    },
  });
});

export const listarCultivos = asyncHandler(async (req, res) => {
  res.json({ data: await Cultivo.findAll({ order: [['nombre', 'ASC']] }) });
});

export const crearCultivo = asyncHandler(async (req, res) => {
  const nombre = texto(req.body?.nombre, 'nombre', 100);
  requerido({ nombre }, ['nombre']);
  const c = await Cultivo.create({ nombre, mesesNecesidad: texto(req.body?.mesesNecesidad, 'mesesNecesidad', 40) });
  res.status(201).json({ message: 'Cultivo creado', data: c });
});
