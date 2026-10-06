/* eslint-disable */
import { Roadmap, RoadmapStop, User } from '../models/index.js';

const asignadoInclude = { model: User, as: 'asignado', attributes: ['idUser', 'nombreApellido', 'direccionMail', 'role'] };

export const createRoadmap = async (req, res) => {
  try {
    const {
      nombreZona,
      descripcion,
      fechaRuta,
      horaRuta,
      fechaFinPropuesta,
      horaFinPropuesta,
      sellerId,
      idUserAsignado,
      creadoPorId,
      distanciaEstimadaKm,
      observaciones,
      estado,
      paradas
    } = req.body;

    if (!fechaRuta) {
      return res.status(400).json({ message: 'La fecha de la ruta es obligatoria' });
    }

    // La persona asignada puede ser cualquier usuario (admin o vendedor).
    const rawAssignee = idUserAsignado || sellerId;
    const resolvedUser = rawAssignee ? await User.findByPk(String(rawAssignee)) : null;

    if (!resolvedUser) {
      return res.status(400).json({ message: 'No se encontró el usuario asignado para esta hoja de ruta' });
    }

    const newRoadmap = await Roadmap.create({
      nombreZona: nombreZona || 'Zona de Recorrido General',
      descripcion: descripcion || `Hoja de ruta para ${nombreZona || 'recorrido'}`,
      fechaRuta,
      horaRuta: horaRuta || null,
      fechaFinPropuesta: fechaFinPropuesta || null,
      horaFinPropuesta: horaFinPropuesta || null,
      idUserAsignado: resolvedUser.idUser,
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
          notas: stop.notas || null,
          url: stop.url || null,
          origen: 'planificada'
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

// Hojas de ruta asignadas a un usuario puntual (admin o vendedor).
export const getRoadmapsByUser = async (req, res) => {
  try {
    const idUser = req.params.idUser ?? req.params.sellerId;
    const roadmaps = await Roadmap.findAll({
      where: { idUserAsignado: String(idUser) },
      include: [{ model: RoadmapStop, as: 'paradas' }, asignadoInclude],
      order: [['fechaRuta', 'DESC']]
    });
    return res.json({ data: roadmaps });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener hojas de ruta del usuario', error: error.message });
  }
};

// Ruta histórica /roadmaps/seller/:sellerId — el parámetro ahora es el id_user.
export const getRoadmapsBySeller = getRoadmapsByUser;

export const getAllRoadmaps = async (req, res) => {
  try {
    const roadmaps = await Roadmap.findAll({
      include: [
        { model: RoadmapStop, as: 'paradas' },
        asignadoInclude
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
        asignadoInclude
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

// ── Ciclo de vida: Iniciar / Finalizar hoja de ruta ──

export const startRoadmap = async (req, res) => {
  try {
    const { id } = req.params;
    const roadmap = await Roadmap.findByPk(id);
    if (!roadmap) {
      return res.status(404).json({ message: 'Hoja de ruta no encontrada' });
    }
    if (roadmap.estado === 'finalizada') {
      return res.status(400).json({ message: 'Esta hoja de ruta ya fue finalizada' });
    }
    await roadmap.update({ estado: 'en_curso', fechaHoraInicioReal: new Date() });
    return res.json({ message: 'Hoja de ruta iniciada', data: roadmap });
  } catch (error) {
    return res.status(500).json({ message: 'Error al iniciar hoja de ruta', error: error.message });
  }
};

export const endRoadmap = async (req, res) => {
  try {
    const { id } = req.params;
    const roadmap = await Roadmap.findByPk(id);
    if (!roadmap) {
      return res.status(404).json({ message: 'Hoja de ruta no encontrada' });
    }
    if (roadmap.estado === 'finalizada') {
      return res.status(400).json({ message: 'Esta hoja de ruta ya fue finalizada' });
    }
    await roadmap.update({ estado: 'finalizada', fechaHoraFinReal: new Date() });
    return res.json({ message: 'Hoja de ruta finalizada', data: roadmap });
  } catch (error) {
    return res.status(500).json({ message: 'Error al finalizar hoja de ruta', error: error.message });
  }
};

// Parada agregada sobre la marcha (no estaba planificada): texto libre +
// URL opcional (ej. estación de servicio, ubicación de un pueblo, etc).
export const addAdHocStop = async (req, res) => {
  try {
    const { id } = req.params;
    const { texto, url } = req.body;

    if (!texto || !texto.trim()) {
      return res.status(400).json({ message: 'Ingresá una descripción para la parada' });
    }

    const roadmap = await Roadmap.findByPk(id);
    if (!roadmap) {
      return res.status(404).json({ message: 'Hoja de ruta no encontrada' });
    }

    const maxOrden = await RoadmapStop.max('orden', { where: { roadmapId: id } });
    const now = new Date();
    const horaEstimada = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const stop = await RoadmapStop.create({
      roadmapId: id,
      orden: (maxOrden || 0) + 1,
      nombreLugar: texto.trim(),
      notas: texto.trim(),
      url: url || null,
      estadoParada: 'completada',
      horaEstimada,
      origen: 'agregada_en_ruta'
    });

    return res.status(201).json({ message: 'Parada agregada', data: stop });
  } catch (error) {
    return res.status(500).json({ message: 'Error al agregar parada', error: error.message });
  }
};

const resolveAssignedUser = async (roadmap) =>
  roadmap.idUserAsignado ? User.findByPk(roadmap.idUserAsignado) : null;

// Permisos de borrado:
//  - Vendedor: solo sus propias hojas de ruta.
//  - Admin: las de cualquier vendedor, o las propias — NUNCA las de otro admin.
export const deleteRoadmap = async (req, res) => {
  try {
    const { id } = req.params;
    const roadmap = await Roadmap.findByPk(id);
    if (!roadmap) {
      return res.status(404).json({ message: 'Hoja de ruta no encontrada' });
    }

    const requester = req.user;
    if (!requester) {
      return res.status(401).json({ message: 'No se proporcionó un token de autenticación' });
    }

    const assignedUser = await resolveAssignedUser(roadmap);
    const requesterRole = (requester.role || '').toLowerCase();
    const assignedRole = (assignedUser?.role || '').toLowerCase();
    const isOwnRoadmap = assignedUser && String(assignedUser.idUser) === String(requester.idUser);

    let allowed = false;
    if (requesterRole === 'vendedor') {
      allowed = isOwnRoadmap;
    } else if (requesterRole === 'admin') {
      allowed = isOwnRoadmap || assignedRole === 'vendedor';
    }

    if (!allowed) {
      return res.status(403).json({ message: 'No tenés permisos para eliminar esta hoja de ruta' });
    }

    await roadmap.destroy();
    return res.json({ message: 'Hoja de ruta eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar hoja de ruta', error: error.message });
  }
};
