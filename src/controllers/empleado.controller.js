import { Empleado, OrdenEmpleado } from '../models/index.js';
import { ROLES_EMPLEADO } from '../models/servicios.model.js';
import { asyncHandler, badRequest, idParam, notFound } from '../utils/http.js';
import { dataUrl, parseFecha, requerido, texto, unoDe } from '../utils/validacion.js';

const ROL_DESDE_PUESTO = (puesto = '') => {
  const p = String(puesto).toLowerCase();
  if (p.includes('técnic') || p.includes('tecnic') || p.includes('aplicador') || p.includes('fumig')) return 'tecnico';
  if (p.includes('chofer') || p.includes('conductor')) return 'chofer';
  if (p.includes('admin')) return 'administrativo';
  return 'ayudante';
};

const datos = (b) => {
  const d = {};
  const set = (k, v) => { if (v !== undefined) d[k] = v; };
  set('nombreApellido', texto(b.nombreApellido, 'nombreApellido', 150));
  set('dni', texto(b.dni, 'dni', 30));
  set('matricula', texto(b.matricula, 'matricula', 50));
  set('rol', b.rol !== undefined ? unoDe(b.rol, ROLES_EMPLEADO, 'rol') : undefined);
  set('puesto', texto(b.puesto, 'puesto', 100));
  set('telefono', texto(b.telefono, 'telefono', 50));
  set('email', texto(b.email, 'email', 150));
  set('empresa', texto(b.empresa, 'empresa', 150));
  set('fechaIngreso', b.fechaIngreso !== undefined ? parseFecha(b.fechaIngreso, 'fechaIngreso') : undefined);
  set('activo', b.activo !== undefined ? Boolean(b.activo) : undefined);
  set('observaciones', texto(b.observaciones, 'observaciones', 5000));
  if (b.profileImage !== undefined) {
    d.profileImage = b.profileImage ? dataUrl(b.profileImage, 'profileImage', 3) : null;
    if (d.profileImage && !d.profileImage.startsWith('data:image/')) throw badRequest('La foto debe ser una imagen', { profileImage: 'tipo no permitido' });
  }
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw badRequest('El email no es válido', { email: 'formato' });
  return d;
};

// ?rol=tecnico&activos=1 → selector de técnicos de la orden de servicio.
export const listar = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.rol) where.rol = unoDe(String(req.query.rol), ROLES_EMPLEADO, 'rol');
  if (req.query.activos === '1') where.activo = true;
  const empleados = await Empleado.findAll({ where, order: [['nombreApellido', 'ASC']] });
  res.json({ data: empleados });
});

export const obtener = asyncHandler(async (req, res) => {
  const e = await Empleado.findByPk(idParam(req));
  if (!e) throw notFound('Empleado');
  res.json({ data: e });
});

export const crear = asyncHandler(async (req, res) => {
  const d = datos(req.body || {});
  requerido(d, ['nombreApellido']);
  const e = await Empleado.create({ ...d, rol: d.rol || ROL_DESDE_PUESTO(d.puesto) });
  res.status(201).json({ message: 'Empleado creado', data: e });
});

export const actualizar = asyncHandler(async (req, res) => {
  const e = await Empleado.findByPk(idParam(req));
  if (!e) throw notFound('Empleado');
  const d = datos(req.body || {});
  if (d.nombreApellido === null) throw badRequest('El nombre no puede quedar vacío');
  await e.update(d);
  res.json({ message: 'Empleado actualizado', data: e });
});

// Si figura en órdenes de servicio se desactiva en lugar de borrarse.
export const eliminar = asyncHandler(async (req, res) => {
  const e = await Empleado.findByPk(idParam(req));
  if (!e) throw notFound('Empleado');
  if (await OrdenEmpleado.count({ where: { empleadoId: e.id } })) {
    await e.update({ activo: false });
    return res.json({ message: 'El empleado figura en órdenes de servicio: se desactivó en lugar de eliminarse.', data: e });
  }
  await e.destroy();
  res.json({ message: 'Empleado eliminado' });
});
