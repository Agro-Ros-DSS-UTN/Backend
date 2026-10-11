import { NotaInterna, Usuario } from '../models/index.js';
import { asyncHandler, badRequest, idParam, notFound } from '../utils/http.js';
import { texto, unoDe } from '../utils/validacion.js';

const include = [{ model: Usuario, as: 'autor', attributes: ['idUser', 'nombreApellido'] }];
const serialize = (n) => {
  const j = n.toJSON();
  return { ...j, autorNombre: j.autor?.nombreApellido ?? null, idUser: j.usuarioId };
};

// Notas internas de la administración (pedidos, despachos). Solo rol admin.
export const listar = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.estado) where.estado = unoDe(String(req.query.estado), ['abierta', 'resuelta'], 'estado');
  const notas = await NotaInterna.findAll({ where, include, order: [['fechaNota', 'DESC']] });
  res.json({ data: notas.map(serialize) });
});

export const crear = asyncHandler(async (req, res) => {
  const descripcion = texto(req.body?.descripcion, 'descripcion', 5000);
  if (!descripcion) throw badRequest('La descripción es obligatoria', { descripcion: 'obligatorio' });
  const categoria = unoDe(req.body?.categoria || 'general', ['pedido', 'despacho', 'general'], 'categoria');
  const n = await NotaInterna.create({ descripcion, categoria, usuarioId: req.user.idUser });
  res.status(201).json({ message: 'Nota creada', data: serialize(await NotaInterna.findByPk(n.id, { include })) });
});

export const actualizar = asyncHandler(async (req, res) => {
  const n = await NotaInterna.findByPk(idParam(req));
  if (!n) throw notFound('Nota');
  const cambios = {};
  if (req.body?.descripcion !== undefined) cambios.descripcion = texto(req.body.descripcion, 'descripcion', 5000);
  if (req.body?.estado !== undefined) cambios.estado = unoDe(req.body.estado, ['abierta', 'resuelta'], 'estado');
  if (req.body?.categoria !== undefined) cambios.categoria = unoDe(req.body.categoria, ['pedido', 'despacho', 'general'], 'categoria');
  if (cambios.descripcion === null) throw badRequest('La descripción no puede quedar vacía');
  await n.update(cambios);
  res.json({ message: 'Nota actualizada', data: serialize(await NotaInterna.findByPk(n.id, { include })) });
});

export const eliminar = asyncHandler(async (req, res) => {
  const n = await NotaInterna.findByPk(idParam(req));
  if (!n) throw notFound('Nota');
  await n.destroy();
  res.json({ message: 'Nota eliminada' });
});
