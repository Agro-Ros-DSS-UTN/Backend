import { asyncHandler } from '../../shared/utils/http.js';
import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as contactService from './contact.service.js';

export { serializeContact } from './contact.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await contactService.listContacts(req.query, { admin: isAdmin(req) });
  res.json({ data });
});

export const get = asyncHandler(async (req, res) => {
  const data = await contactService.getContact(req.params.id);
  res.json({ data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await contactService.createContact(req.body);
  res.status(201).json({ message: 'Contacto creado', data });
});

export const update = asyncHandler(async (req, res) => {
  const data = await contactService.updateContact(req.params.id, req.body);
  res.json({ message: 'Contacto actualizado', data });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await contactService.removeContact(req.params.id);
  res.json(result);
});

export const restore = asyncHandler(async (req, res) => {
  const data = await contactService.restoreContact(req.params.id);
  res.json({ message: 'Contacto restaurado', data });
});
