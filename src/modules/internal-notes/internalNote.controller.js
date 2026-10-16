import { asyncHandler, idParam } from '../../shared/utils/http.js';
import * as internalNoteService from './internalNote.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await internalNoteService.listInternalNotes(req.query);
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await internalNoteService.createInternalNote(req.body, {
    currentUserId: req.user.idUser,
  });
  res.status(201).json({ message: 'Nota creada', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await internalNoteService.updateInternalNote(idParam(req), req.body);
  res.json({ message: 'Nota actualizada', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await internalNoteService.removeInternalNote(idParam(req));
  res.json(result);
});
