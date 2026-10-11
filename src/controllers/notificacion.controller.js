import { Op } from 'sequelize';
import { Notificacion } from '../models/index.js';
import { asyncHandler, idParam, notFound } from '../utils/http.js';

// Alta interna (desde otros controladores). Nunca interrumpe la operación principal.
export const crearNotificacion = async (usuarioId, tipo, mensaje, entidad = null, entidadId = null) => {
  try {
    if (!usuarioId) return null;
    return await Notificacion.create({ usuarioId, tipo, mensaje: String(mensaje).slice(0, 255), entidad, entidadId: entidadId !== null ? String(entidadId) : null });
  } catch (e) {
    console.warn('[notificaciones] No se pudo registrar:', e.message);
    return null;
  }
};

// Cada usuario ve solo sus notificaciones.
export const listar = asyncHandler(async (req, res) => {
  const where = { usuarioId: req.user.idUser };
  if (req.query.noLeidas === '1') where.leida = false;
  const notificaciones = await Notificacion.findAll({ where, order: [['fechaHora', 'DESC']], limit: 100 });
  const noLeidas = await Notificacion.count({ where: { usuarioId: req.user.idUser, leida: false } });
  res.json({ data: notificaciones, noLeidas });
});

export const marcarLeida = asyncHandler(async (req, res) => {
  const n = await Notificacion.findOne({ where: { id: idParam(req), usuarioId: req.user.idUser } });
  if (!n) throw notFound('Notificación');
  await n.update({ leida: true });
  res.json({ message: 'Notificación leída', data: n });
});

export const marcarTodasLeidas = asyncHandler(async (req, res) => {
  const [n] = await Notificacion.update({ leida: true }, { where: { usuarioId: req.user.idUser, leida: false } });
  res.json({ message: `${n} notificaciones marcadas como leídas` });
});

export const limpiarLeidas = asyncHandler(async (req, res) => {
  const n = await Notificacion.destroy({ where: { usuarioId: req.user.idUser, leida: true, fechaHora: { [Op.lt]: new Date(Date.now() - 7 * 86400000) } } });
  res.json({ message: `${n} notificaciones antiguas eliminadas` });
});
