/* eslint-disable */
import Roadmap from '../models/roadmap.model.js';
import RoadmapStop from '../models/roadmapStop.model.js';
import Seller from '../models/seller.model.js';
import User from '../models/user.model.js';

export const createRoadmap = async (req, res) => {
  try {
    const {
      nombreZona,
      descripcion,
      fechaRuta,
      sellerId,
      creadoPorId,
      distanciaEstimadaKm,
      observaciones,
      estado,
      paradas
    } = req.body;

    if (!fechaRuta) {
      return res.status(400).json({ message: 'La fecha de la ruta es obligatoria' });
    }

    // Resolución robusta del ID de Vendedor
    let validSellerId = null;

    if (sellerId) {
      if (!isNaN(Number(sellerId))) {
        const sellerByPk = await Seller.findByPk(Number(sellerId));
        if (sellerByPk) validSellerId = sellerByPk.id;
      }

      if (!validSellerId) {
        const user = await User.findByPk(sellerId);
        if (user) {
          const [existingSeller] = await Seller.findOrCreate({
            where: { idUser: user.idUser },
            defaults: {
              zonaAsignada: nombreZona || 'Zona General',
              antiguedad: 1
            }
          });
          validSellerId = existingSeller.id;
        }
      }
    }

    // Fallback: si aún no se halló, tomar el primer vendedor o usuario disponible
    if (!validSellerId) {
      let firstSeller = await Seller.findOne();
      if (!firstSeller) {
        let firstUser = await User.findOne();
        if (firstUser) {
          const [createdSeller] = await Seller.findOrCreate({
            where: { idUser: firstUser.idUser },
            defaults: { zonaAsignada: 'Zona General', antiguedad: 1 }
          });
          firstSeller = createdSeller;
        }
      }
      if (firstSeller) validSellerId = firstSeller.id;
    }

    if (!validSellerId) {
      return res.status(400).json({ message: 'No se encontró ningún vendedor registrado en el sistema' });
    }

    const newRoadmap = await Roadmap.create({
      nombreZona: nombreZona || 'Zona de Recorrido General',
      descripcion: descripcion || `Hoja de ruta para ${nombreZona || 'recorrido'}`,
      fechaRuta,
      sellerId: validSellerId,
      creadoPorId: creadoPorId || null,
      distanciaEstimadaKm: Number(distanciaEstimadaKm) || 0,
      observaciones: observaciones || null,
      estado: estado || 'planificada'
    });

    if (Array.isArray(paradas) && paradas.length > 0) {
      const stopsData = paradas.map((stop, index) => {
        const validCompId = (stop.clientCompanyId && !isNaN(Number(stop.clientCompanyId))) ? Number(stop.clientCompanyId) : null;
        return {
          roadmapId: newRoadmap.id,
          orden: stop.orden || (index + 1),
          clientCompanyId: validCompId,
          nombreLugar: stop.nombreLugar || `Parada #${index + 1}`,
          direccion: stop.direccion || '',
          latitud: !isNaN(Number(stop.latitud)) ? Number(stop.latitud) : null,
          longitud: !isNaN(Number(stop.longitud)) ? Number(stop.longitud) : null,
          estadoParada: stop.estadoParada || 'pendiente',
          horaEstimada: stop.horaEstimada || null,
          notas: stop.notas || null
        };
      });

      await RoadmapStop.bulkCreate(stopsData);
    }

    const fullRoadmap = await Roadmap.findByPk(newRoadmap.id, {
      include: [{ model: RoadmapStop, as: 'paradas' }]
    });

    return res.status(201).json({ message: 'Hoja de ruta creada con éxito en la base de datos', data: fullRoadmap });
  } catch (error) {
    console.error('Error in createRoadmap:', error);
    return res.status(500).json({ message: 'Error al crear hoja de ruta en el servidor', error: error.message });
  }
};

// Resuelve el id real de `sellers` desde un id numérico o desde el idUser del vendedor.
const resolveSellerId = async (rawId) => {
  if (rawId === undefined || rawId === null || rawId === '') return null;
  if (!isNaN(Number(rawId))) {
    const byPk = await Seller.findByPk(Number(rawId));
    if (byPk) return byPk.id;
  }
  const byUser = await Seller.findOne({ where: { idUser: String(rawId) } });
  return byUser ? byUser.id : null;
};

export const getRoadmapsBySeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const resolvedId = await resolveSellerId(sellerId);

    // Sin vendedor resuelto => sin hojas de ruta (no devolvemos las de otro vendedor)
    if (!resolvedId) return res.json({ data: [] });

    const roadmaps = await Roadmap.findAll({
      where: { sellerId: resolvedId },
      include: [
        { model: RoadmapStop, as: 'paradas' },
        { model: Seller, include: [{ model: User, attributes: ['nombreApellido', 'direccionMail', 'role'] }] }
      ],
      order: [['fechaRuta', 'DESC']]
    });
    return res.json({ data: roadmaps });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener hojas de ruta', error: error.message });
  }
};

export const getAllRoadmaps = async (req, res) => {
  try {
    const roadmaps = await Roadmap.findAll({
      include: [
        { model: RoadmapStop, as: 'paradas' },
        { model: Seller, include: [{ model: User, attributes: ['nombreApellido', 'direccionMail', 'role'] }] }
      ],
      order: [['fechaRuta', 'DESC']]
    });
    return res.json({ data: roadmaps });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener hojas de ruta', error: error.message });
  }
};

export const getRoadmapById = async (req, res) => {
  try {
    const { id } = req.params;
    const roadmap = await Roadmap.findByPk(id, {
      include: [
        { model: RoadmapStop, as: 'paradas' },
        { model: Seller, include: [{ model: User, attributes: ['nombreApellido', 'direccionMail', 'role'] }] }
      ]
    });
    if (!roadmap) {
      return res.status(404).json({ message: 'Hoja de ruta no encontrada' });
    }
    return res.json({ data: roadmap });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener hoja de ruta', error: error.message });
  }
};

export const updateStopStatus = async (req, res) => {
  try {
    const { stopId } = req.params;
    const { estadoParada } = req.body;

    const stop = await RoadmapStop.findByPk(stopId);
    if (!stop) {
      return res.status(404).json({ message: 'Parada no encontrada' });
    }

    stop.estadoParada = estadoParada || stop.estadoParada;
    await stop.save();

    return res.json({ message: 'Estado de parada actualizado', data: stop });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar parada', error: error.message });
  }
};

export const deleteRoadmap = async (req, res) => {
  try {
    const { id } = req.params;
    const roadmap = await Roadmap.findByPk(id);
    if (!roadmap) {
      return res.status(404).json({ message: 'Hoja de ruta no encontrada' });
    }
    await roadmap.destroy();
    return res.json({ message: 'Hoja de ruta eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar hoja de ruta', error: error.message });
  }
};
