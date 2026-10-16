import { INTERNAL_NOTE_CATEGORIES, INTERNAL_NOTE_STATUSES } from './internalNote.entity.js';
import * as internalNoteRepository from './internalNote.repository.js';
import { badRequest, notFound } from '../../shared/utils/http.js';
import { text, oneOf } from '../../shared/utils/validation.js';

export const serializeInternalNote = (n) => {
  if (!n) return null;
  const j = typeof n.toJSON === 'function' ? n.toJSON() : n;
  return { ...j, authorName: j.author?.fullName ?? null, idUser: j.userId };
};

// Notas internas de la administración (pedidos, despachos). Solo rol admin.
export const listInternalNotes = async (query = {}) => {
  const status = query.status ? oneOf(String(query.status), INTERNAL_NOTE_STATUSES, 'status') : undefined;
  const notes = await internalNoteRepository.findAll({ status });
  return notes.map(serializeInternalNote);
};

export const createInternalNote = async (body = {}, { currentUserId }) => {
  const description = text(body?.description, 'description', 5000);
  if (!description) throw badRequest('La descripción es obligatoria', { description: 'required' });
  const category = oneOf(body?.category || 'general', INTERNAL_NOTE_CATEGORIES, 'category');
  const n = await internalNoteRepository.create({ description, category, userId: currentUserId });
  const full = await internalNoteRepository.findByIdWithAuthor(n.id);
  return serializeInternalNote(full);
};

export const updateInternalNote = async (id, body = {}) => {
  const n = await internalNoteRepository.findById(id);
  if (!n) throw notFound('Nota');
  const changes = {};
  if (body?.description !== undefined) changes.description = text(body.description, 'description', 5000);
  if (body?.status !== undefined) changes.status = oneOf(body.status, INTERNAL_NOTE_STATUSES, 'status');
  if (body?.category !== undefined) changes.category = oneOf(body.category, INTERNAL_NOTE_CATEGORIES, 'category');
  if (changes.description === null) throw badRequest('La descripción no puede quedar vacía');
  await internalNoteRepository.update(n, changes);
  const full = await internalNoteRepository.findByIdWithAuthor(n.id);
  return serializeInternalNote(full);
};

export const removeInternalNote = async (id) => {
  const n = await internalNoteRepository.findById(id);
  if (!n) throw notFound('Nota');
  await internalNoteRepository.destroy(n);
  return { message: 'Nota eliminada' };
};
