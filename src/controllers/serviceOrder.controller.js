/* eslint-disable */
import { ServiceOrder, ServiceOrderProduct, ServiceEvaluation, sequelize } from '../models/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

/**
 * Obtener todas las órdenes de servicio con sus productos y evaluación
 */
export const getAllServiceOrders = asyncHandler(async (req, res) => {
  const orders = await ServiceOrder.findAll({
    include: [
      { association: 'productosAplicados' },
      { association: 'evaluacion' }
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']]
  });

  return res.status(200).json({
    message: 'Órdenes de servicio obtenidas exitosamente',
    data: orders
  });
});

/**
 * Obtener orden de servicio por ID
 */
export const getServiceOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await ServiceOrder.findByPk(id, {
    include: [
      { association: 'productosAplicados' },
      { association: 'evaluacion' }
    ]
  });

  if (!order) {
    return res.status(404).json({
      message: 'Orden de servicio no encontrada'
    });
  }

  return res.status(200).json({
    message: 'Orden de servicio obtenida exitosamente',
    data: order
  });
});

/**
 * Crear nueva orden de servicio
 */
export const createServiceOrder = asyncHandler(async (req, res) => {
  const {
    numeroOrden,
    fecha,
    clienteId,
    clienteNombre,
    centroId,
    centroNombre,
    plantaId,
    plantaNombre,
    silo,
    direccion,
    localidad,
    provincia,
    tipoTrabajo,
    estado,
    tecnicoAplicador,
    observacionesOrden,
    productosAplicados
  } = req.body;

  if (!numeroOrden || !clienteNombre || !plantaNombre) {
    return res.status(400).json({
      message: 'Faltan campos obligatorios (numeroOrden, clienteNombre, plantaNombre)'
    });
  }

  const transaction = await sequelize.transaction();

  try {
    const newOrder = await ServiceOrder.create({
      numeroOrden,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      clienteId: clienteId ? String(clienteId) : null,
      clienteNombre,
      centroId: centroId ? String(centroId) : null,
      centroNombre,
      plantaId: plantaId ? String(plantaId) : null,
      plantaNombre,
      silo: silo || null,
      direccion,
      localidad,
      provincia,
      tipoTrabajo: tipoTrabajo || 'Fumigación de Silo',
      estado: estado || 'Programada',
      tecnicoAplicador,
      observacionesOrden
    }, { transaction });

    if (Array.isArray(productosAplicados) && productosAplicados.length > 0) {
      const itemsToCreate = productosAplicados.map(p => ({
        ordenServicioId: newOrder.id,
        producto: p.producto || 'Producto Fitosanitario',
        principioActivo: p.principioActivo || null,
        dosis: p.dosis || null,
        lote: p.lote || null,
        tiempoCarencia: p.tiempoCarencia || null,
        cantidadTotal: p.cantidadTotal || null
      }));

      await ServiceOrderProduct.bulkCreate(itemsToCreate, { transaction });
    }

    await transaction.commit();

    const createdOrder = await ServiceOrder.findByPk(newOrder.id, {
      include: [
        { association: 'productosAplicados' },
        { association: 'evaluacion' }
      ]
    });

    return res.status(201).json({
      message: 'Orden de servicio creada exitosamente',
      data: createdOrder
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Actualizar orden de servicio
 */
export const updateServiceOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await ServiceOrder.findByPk(id);

  if (!order) {
    return res.status(404).json({
      message: 'Orden de servicio no encontrada'
    });
  }

  const {
    numeroOrden,
    fecha,
    clienteId,
    clienteNombre,
    centroId,
    centroNombre,
    plantaId,
    plantaNombre,
    silo,
    direccion,
    localidad,
    provincia,
    tipoTrabajo,
    estado,
    tecnicoAplicador,
    observacionesOrden,
    productosAplicados
  } = req.body;

  const transaction = await sequelize.transaction();

  try {
    await order.update({
      numeroOrden: numeroOrden ?? order.numeroOrden,
      fecha: fecha ?? order.fecha,
      clienteId: clienteId !== undefined ? String(clienteId) : order.clienteId,
      clienteNombre: clienteNombre ?? order.clienteNombre,
      centroId: centroId !== undefined ? String(centroId) : order.centroId,
      centroNombre: centroNombre ?? order.centroNombre,
      plantaId: plantaId !== undefined ? String(plantaId) : order.plantaId,
      plantaNombre: plantaNombre ?? order.plantaNombre,
      silo: silo !== undefined ? silo : order.silo,
      direccion: direccion ?? order.direccion,
      localidad: localidad ?? order.localidad,
      provincia: provincia ?? order.provincia,
      tipoTrabajo: tipoTrabajo ?? order.tipoTrabajo,
      estado: estado ?? order.estado,
      tecnicoAplicador: tecnicoAplicador ?? order.tecnicoAplicador,
      observacionesOrden: observacionesOrden ?? order.observacionesOrden
    }, { transaction });

    if (Array.isArray(productosAplicados)) {
      // Reemplazar productos anteriores
      await ServiceOrderProduct.destroy({
        where: { ordenServicioId: order.id },
        transaction
      });

      if (productosAplicados.length > 0) {
        const itemsToCreate = productosAplicados.map(p => ({
          ordenServicioId: order.id,
          producto: p.producto || 'Producto Fitosanitario',
          principioActivo: p.principioActivo || null,
          dosis: p.dosis || null,
          lote: p.lote || null,
          tiempoCarencia: p.tiempoCarencia || null,
          cantidadTotal: p.cantidadTotal || null
        }));

        await ServiceOrderProduct.bulkCreate(itemsToCreate, { transaction });
      }
    }

    await transaction.commit();

    const updatedOrder = await ServiceOrder.findByPk(order.id, {
      include: [
        { association: 'productosAplicados' },
        { association: 'evaluacion' }
      ]
    });

    return res.status(200).json({
      message: 'Orden de servicio actualizada exitosamente',
      data: updatedOrder
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Registrar o actualizar Evaluación de Servicio
 */
export const saveServiceEvaluation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await ServiceOrder.findByPk(id);

  if (!order) {
    return res.status(404).json({
      message: 'Orden de servicio no encontrada'
    });
  }

  const {
    calificacion,
    conformidad,
    cumplimientoEPP,
    puntualidad,
    limpiezaArea,
    observacionesTecnicas,
    responsableReceptor,
    dniReceptor,
    cargoReceptor
  } = req.body;

  let evaluation = await ServiceEvaluation.findOne({
    where: { ordenServicioId: order.id }
  });

  const payload = {
    ordenServicioId: order.id,
    calificacion: calificacion ?? 5,
    conformidad: conformidad || 'Conforme',
    cumplimientoEPP: cumplimientoEPP !== undefined ? Boolean(cumplimientoEPP) : true,
    puntualidad: puntualidad !== undefined ? Boolean(puntualidad) : true,
    limpiezaArea: limpiezaArea !== undefined ? Boolean(limpiezaArea) : true,
    observacionesTecnicas: observacionesTecnicas || '',
    responsableReceptor: responsableReceptor || 'Receptor en Planta',
    dniReceptor: dniReceptor || '',
    cargoReceptor: cargoReceptor || 'Encargado',
    fechaEvaluacion: new Date()
  };

  if (evaluation) {
    await evaluation.update(payload);
  } else {
    evaluation = await ServiceEvaluation.create(payload);
  }

  // Si la orden estaba programada o en ejecución, se actualiza a Completada
  if (order.estado === 'Programada' || order.estado === 'En Ejecución') {
    await order.update({ estado: 'Completada' });
  }

  const updatedOrder = await ServiceOrder.findByPk(order.id, {
    include: [
      { association: 'productosAplicados' },
      { association: 'evaluacion' }
    ]
  });

  return res.status(200).json({
    message: 'Evaluación de servicio guardada exitosamente',
    data: updatedOrder
  });
});

/**
 * Eliminar orden de servicio (cascada automática)
 */
export const deleteServiceOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await ServiceOrder.findByPk(id);

  if (!order) {
    return res.status(404).json({
      message: 'Orden de servicio no encontrada'
    });
  }

  await order.destroy();

  return res.status(200).json({
    message: 'Orden de servicio eliminada exitosamente'
  });
});
