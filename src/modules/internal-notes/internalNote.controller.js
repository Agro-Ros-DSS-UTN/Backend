import { InternalNote, User } from '../../shared/models/index.js';
import { asyncHandler, badRequest, idParam, notFound } from '../../shared/utils/http.js';
import { text, oneOf } from '../../shared/utils/validation.js';

const include = [{ model: User, as: 'author', attributes: ['idUser', 'fullName'] }];
const serialize = (n) => {
  const j = n.toJSON();
  return { ...j, authorName: j.author?.fullName ?? null, idUser: j.userId };
};

// Notas internas de la administración (pedidos, despachos). Solo rol admin.
export const list = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = oneOf(String(req.query.status), ['abierta', 'resuelta'], 'status');
  const notes = await InternalNote.findAll({ where, include, order: [['createdAt', 'DESC']] });
  res.json({ data: notes.map(serialize) });
});

export const create = asyncHandler(async (req, res) => {
  const description = text(req.body?.description, 'description', 5000);
  if (!description) throw badRequest('La descripción es obligatoria', { description: 'required' });
  const category = oneOf(req.body?.category || 'general', ['pedido', 'despacho', 'general'], 'category');
  const n = await InternalNote.create({ description, category, userId: req.user.idUser });
  res.status(201).json({ message: 'Nota creada', data: serialize(await InternalNote.findByPk(n.id, { include })) });
});

export const update = asyncHandler(async (req, res) => {
  const n = await InternalNote.findByPk(idParam(req));
  if (!n) throw notFound('Nota');
  const changes = {};
  if (req.body?.description !== undefined) changes.description = text(req.body.description, 'description', 5000);
  if (req.body?.status !== undefined) changes.status = oneOf(req.body.status, ['abierta', 'resuelta'], 'status');
  if (req.body?.category !== undefined) changes.category = oneOf(req.body.category, ['pedido', 'despacho', 'general'], 'category');
  if (changes.description === null) throw badRequest('La descripción no puede quedar vacía');
  await n.update(changes);
  res.json({ message: 'Nota actualizada', data: serialize(await InternalNote.findByPk(n.id, { include })) });
});

export const remove = asyncHandler(async (req, res) => {
  const n = await InternalNote.findByPk(idParam(req));
  if (!n) throw notFound('Nota');
  await n.destroy();
  res.json({ message: 'Nota eliminada' });
});
