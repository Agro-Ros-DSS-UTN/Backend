import { Objective, User, ClientCompany } from '../models/index.js';

const objectiveInclude = [
  { model: User, as: 'vendedor', attributes: ['idUser', 'nombreApellido', 'role', 'direccionMail'] },
  ClientCompany
];

// Devuelve el id_user si corresponde a un usuario existente, o null.
const resolveUserId = async (rawId) => {
  if (rawId === undefined || rawId === null || rawId === '') return null;
  const user = await User.findByPk(String(rawId));
  return user ? user.idUser : null;
};

export const getAllObjectives = async (req, res, next) => {
  try {
    const objectives = await Objective.findAll({
      include: objectiveInclude,
      order: [['id', 'DESC']]
    });
    res.json(objectives);
  } catch (error) {
    next(error);
  }
};

// GET /objectives/seller/:sellerId — el parámetro es el id_user del vendedor.
export const getObjectivesBySeller = async (req, res, next) => {
  try {
    const idUser = await resolveUserId(req.params.sellerId);
    if (!idUser) return res.json([]);

    const objectives = await Objective.findAll({
      where: { idUser },
      include: objectiveInclude,
      order: [['id', 'DESC']]
    });
    res.json(objectives);
  } catch (error) {
    next(error);
  }
};

export const createObjective = async (req, res, next) => {
  try {
    const { descripcion, tipoObjetivo, periodoSemana, cantidadMeta, idUser, sellerId, clientCompanyId } = req.body;

    const targetUserId = await resolveUserId(idUser ?? sellerId);
    if (!targetUserId) {
      return res.status(400).json({ message: 'Elegí un usuario existente para asignar el objetivo' });
    }

    const newObj = await Objective.create({
      descripcion: descripcion || 'Objetivo Semanal Comercial',
      tipoObjetivo: tipoObjetivo || 'Ventas',
      periodoSemana: Number(periodoSemana) || 1,
      cantidadMeta: Number(cantidadMeta) || 100,
      idUser: targetUserId,
      clientCompanyId: (clientCompanyId && !isNaN(Number(clientCompanyId))) ? Number(clientCompanyId) : null
    });

    const fullObj = await Objective.findByPk(newObj.id, { include: objectiveInclude });
    res.status(201).json(fullObj);
  } catch (error) {
    next(error);
  }
};

export const updateObjective = async (req, res, next) => {
  try {
    const { id } = req.params;
    const obj = await Objective.findByPk(id);
    if (!obj) {
      return res.status(404).json({ message: 'Objetivo no encontrado' });
    }

    const patch = { ...req.body };
    delete patch.sellerId;
    if (req.body.idUser !== undefined || req.body.sellerId !== undefined) {
      patch.idUser = await resolveUserId(req.body.idUser ?? req.body.sellerId);
    }

    await obj.update(patch);
    const updated = await Objective.findByPk(id, { include: objectiveInclude });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const deleteObjective = async (req, res, next) => {
  try {
    const { id } = req.params;
    const obj = await Objective.findByPk(id);
    if (!obj) {
      return res.status(404).json({ message: 'Objetivo no encontrado' });
    }
    await obj.destroy();
    res.json({ message: 'Objetivo eliminado correctamente' });
  } catch (error) {
    next(error);
  }
};
