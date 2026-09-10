import { Objective, Seller, User, ClientCompany } from '../models/index.js';

const objectiveInclude = [
  {
    model: Seller,
    include: [{ model: User, attributes: ['idUser', 'nombreApellido', 'role', 'direccionMail'] }]
  },
  ClientCompany
];

/**
 * Resuelve el id real de la tabla `sellers` a partir de:
 *  - un id numérico de seller, o
 *  - un idUser (documento del usuario vendedor).
 * Con { create: true } da de alta la fila Seller si el usuario existe.
 * Devuelve null si no se puede resolver.
 */
const resolveSellerId = async (rawId, { create = false } = {}) => {
  if (rawId === undefined || rawId === null || rawId === '') return null;

  if (!isNaN(Number(rawId))) {
    const byPk = await Seller.findByPk(Number(rawId));
    if (byPk) return byPk.id;
  }

  const byUser = await Seller.findOne({ where: { idUser: String(rawId) } });
  if (byUser) return byUser.id;

  if (create) {
    const user = await User.findByPk(String(rawId));
    if (user) {
      const [seller] = await Seller.findOrCreate({
        where: { idUser: user.idUser },
        defaults: { zonaAsignada: 'Zona General', antiguedad: 1 }
      });
      return seller.id;
    }
  }

  return null;
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

export const getObjectivesBySeller = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const resolvedId = await resolveSellerId(sellerId);

    // Sin vendedor resuelto => sin objetivos (no devolvemos los de otro vendedor)
    if (!resolvedId) return res.json([]);

    const objectives = await Objective.findAll({
      where: { sellerId: resolvedId },
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
    const {
      descripcion,
      tipoObjetivo,
      periodoSemana,
      cantidadMeta,
      sellerId,
      clientCompanyId
    } = req.body;

    let targetSellerId = await resolveSellerId(sellerId, { create: true });
    if (!targetSellerId) {
      const firstSeller = await Seller.findOne();
      if (firstSeller) targetSellerId = firstSeller.id;
    }

    if (!targetSellerId) {
      return res.status(400).json({ message: 'No se encontró ningún vendedor registrado para asignar el objetivo' });
    }

    const newObj = await Objective.create({
      descripcion: descripcion || 'Objetivo Semanal Comercial',
      tipoObjetivo: tipoObjetivo || 'Ventas',
      periodoSemana: Number(periodoSemana) || 1,
      cantidadMeta: Number(cantidadMeta) || 100,
      sellerId: targetSellerId,
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
    await obj.update(req.body);
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
