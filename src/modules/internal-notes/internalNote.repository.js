import { InternalNote, User } from '../../shared/models/index.js';

const includeAuthor = [{ model: User, as: 'author', attributes: ['idUser', 'fullName'] }];

export const findAll = ({ status }) => {
  const where = {};
  if (status) where.status = status;
  return InternalNote.findAll({
    where,
    include: includeAuthor,
    order: [['createdAt', 'DESC']],
  });
};

export const findById = (id) =>
  InternalNote.findByPk(id);

export const findByIdWithAuthor = (id) =>
  InternalNote.findByPk(id, { include: includeAuthor });

export const create = (data) =>
  InternalNote.create(data);

export const update = (note, data) =>
  note.update(data);

export const destroy = (note) =>
  note.destroy();
