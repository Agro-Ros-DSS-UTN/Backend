import { Promotion } from '../models/index.js';

export const getAllPromotions = async (req, res, next) => {
  try {
    const promotions = await Promotion.findAll({ order: [['id', 'DESC']] });
    res.json(promotions);
  } catch (error) {
    next(error);
  }
};

export const createPromotion = async (req, res, next) => {
  try {
    const { nombre, descripcion, fechaInicio, fechaFin, condiciones } = req.body;
    const newPromo = await Promotion.create({
      nombre: nombre || 'Promoción Campaña',
      descripcion: descripcion || '',
      fechaInicio: fechaInicio || new Date(),
      fechaFin: fechaFin || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      condiciones: condiciones || 'Aplica para clientes registrados'
    });
    res.status(201).json(newPromo);
  } catch (error) {
    next(error);
  }
};

export const updatePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const promo = await Promotion.findByPk(id);
    if (!promo) {
      return res.status(404).json({ message: 'Promoción no encontrada' });
    }
    await promo.update(req.body);
    res.json(promo);
  } catch (error) {
    next(error);
  }
};

export const deletePromotion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const promo = await Promotion.findByPk(id);
    if (!promo) {
      return res.status(404).json({ message: 'Promoción no encontrada' });
    }
    await promo.destroy();
    res.json({ message: 'Promoción eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};
