/* eslint-disable */
import { ServiceOrder, ServiceOrderProduct, ServiceEvaluation, sequelize } from '../models/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Una fila del "Detalle del servicio" de la planilla (instalación + producto y dosis).
const mapDetalleRow = (p, ordenServicioId) => ({
  ordenServicioId,
  tipoInstalacion: p.tipoInstalacion || null,
  numero: p.numero || null,
  capacidadTn: p.capacidadTn || null,
  grano: p.grano || null,
  cantidadTn: p.cantidadTn || null,
  estadoCereal: p.estadoCereal || null,
  estadoInstalaciones: p.estadoInstalaciones || null,
  estadoInfestacion: p.estadoInfestacion || null,
  producto: p.producto || null,
  principioActivo: p.principioActivo || null,
  dosis: p.dosis || null,
  lote: p.lote || null,
  tiempoCarencia: p.tiempoCarencia || null,
  cantidadTotal: p.cantidadTotal || null
});

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
    recomendaciones,
    firmaTecnico,
    firmaCliente,
    imagenOrdenOriginal,
    productosAplicados
  } = req.body;

  if (!numeroOrden || !clienteNombre) {
    return res.status(400).json({
      message: 'Faltan campos obligatorios (numeroOrden, clienteNombre)'
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
      observacionesOrden,
      recomendaciones: recomendaciones || null,
      firmaTecnico: firmaTecnico || null,
      firmaCliente: firmaCliente || null,
      imagenOrdenOriginal: imagenOrdenOriginal || null
    }, { transaction });

    if (Array.isArray(productosAplicados) && productosAplicados.length > 0) {
      const itemsToCreate = productosAplicados.map(p => mapDetalleRow(p, newOrder.id));
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
    recomendaciones,
    firmaTecnico,
    firmaCliente,
    imagenOrdenOriginal,
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
      observacionesOrden: observacionesOrden ?? order.observacionesOrden,
      recomendaciones: recomendaciones !== undefined ? recomendaciones : order.recomendaciones,
      firmaTecnico: firmaTecnico !== undefined ? firmaTecnico : order.firmaTecnico,
      firmaCliente: firmaCliente !== undefined ? firmaCliente : order.firmaCliente,
      imagenOrdenOriginal: imagenOrdenOriginal !== undefined ? imagenOrdenOriginal : order.imagenOrdenOriginal
    }, { transaction });

    if (Array.isArray(productosAplicados)) {
      // Reemplazar productos anteriores
      await ServiceOrderProduct.destroy({
        where: { ordenServicioId: order.id },
        transaction
      });

      if (productosAplicados.length > 0) {
        const itemsToCreate = productosAplicados.map(p => mapDetalleRow(p, order.id));
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
    fechaEvaluacion,
    estadoCereal,
    lugarToma,
    resultado,
    ppmPH3,
    observaciones,
    recomendaciones,
    detalle,
    fotos,
    firmaCliente,
    firmaTecnico
  } = req.body;

  let evaluation = await ServiceEvaluation.findOne({
    where: { ordenServicioId: order.id }
  });

  const payload = {
    ordenServicioId: order.id,
    fechaEvaluacion: fechaEvaluacion || new Date().toISOString().slice(0, 10),
    estadoCereal: estadoCereal || 'A',
    lugarToma: lugarToma || 'Superficie',
    resultado: resultado || 'Sin insectos vivos',
    ppmPH3: (ppmPH3 !== undefined && ppmPH3 !== null && ppmPH3 !== '') ? Number(ppmPH3) : null,
    observaciones: observaciones || null,
    recomendaciones: recomendaciones || null,
    detalle: Array.isArray(detalle) ? JSON.stringify(detalle) : (detalle || null),
    fotos: Array.isArray(fotos) ? JSON.stringify(fotos) : (fotos || null),
    firmaCliente: firmaCliente || null,
    firmaTecnico: firmaTecnico || null
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
