import { Objective, Seller, User, ClientCompany } from '../models/index.js';

export const getAllObjectives = async (req, res, next) => {
  try {
    const objectives = await Objective.findAll({
      include: [
        {
          model: Seller,
          include: [{ model: User, attributes: ['idUser', 'nombreApellido', 'role', 'email'] }]
        },
        ClientCompany
      ],
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
    let seller = await Seller.findOne({ where: { idUser: sellerId } });
    const sId = seller ? seller.id : (isNaN(Number(sellerId)) ? 1 : Number(sellerId));

    const objectives = await Objective.findAll({
      where: { sellerId: sId },
      include: [
        {
          model: Seller,
          include: [{ model: User, attributes: ['idUser', 'nombreApellido', 'role', 'email'] }]
        },
        ClientCompany
      ],
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
      progresoActual,
      estado,
      sellerId,
      clientCompanyId
    } = req.body;

    let targetSellerId = sellerId;
    if (sellerId) {
      const seller = await Seller.findOne({ where: { idUser: sellerId } });
      if (seller) {
        targetSellerId = seller.id;
      } else if (!isNaN(Number(sellerId))) {
        targetSellerId = Number(sellerId);
      }
    }
    
    if (!targetSellerId) {
      const firstSeller = await Seller.findOne();
      if (firstSeller) targetSellerId = firstSeller.id;
    }

    const newObj = await Objective.create({
      descripcion: descripcion || 'Objetivo Semanal Comercial',
      tipoObjetivo: tipoObjetivo || 'Ventas',
      periodoSemana: Number(periodoSemana) || 1,
      cantidadMeta: Number(cantidadMeta) || 100,
      progresoActual: Number(progresoActual) || 0,
      estado: estado || 'en_proceso',
      sellerId: targetSellerId,
      clientCompanyId: (clientCompanyId && !isNaN(Number(clientCompanyId))) ? Number(clientCompanyId) : null
    });

    const fullObj = await Objective.findByPk(newObj.id, {
      include: [
        {
          model: Seller,
          include: [{ model: User, attributes: ['idUser', 'nombreApellido', 'role', 'email'] }]
        },
        ClientCompany
      ]
    });

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
    const updated = await Objective.findByPk(id, {
      include: [
        {
          model: Seller,
          include: [{ model: User, attributes: ['idUser', 'nombreApellido', 'role', 'email'] }]
        },
        ClientCompany
      ]
    });
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
