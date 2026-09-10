/* eslint-disable */
import Opportunity from '../models/opportunity.model.js';
import ClientCompany from '../models/clientCompany.model.js';
import Objective from '../models/objective.model.js';
import Seller from '../models/seller.model.js';
import User from '../models/user.model.js';
import activityForm from '../models/activityForm.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Resuelve el id real de `sellers` (id numérico o idUser del vendedor). null si no existe,
// para no violar la FK oportunidades.seller_id -> sellers.id
const resolveSellerId = async (rawId) => {
  if (rawId === undefined || rawId === null || rawId === '') return null;
  try {
    if (!isNaN(Number(rawId))) {
      const byPk = await Seller.findByPk(Number(rawId));
      if (byPk) return byPk.id;
    }
    const byUser = await Seller.findOne({ where: { idUser: String(rawId) } });
    return byUser ? byUser.id : null;
  } catch (_) {
    return null;
  }
};

const listInclude = [
  { model: ClientCompany, attributes: ['id', 'nombreEmpresa', 'descEmpresa', 'localityCodPostal'] },
  {
    model: Seller,
    attributes: ['id'],
    include: [{ model: User, attributes: ['idUser', 'nombreApellido'] }]
  }
];

// Creación de una Oportunidad / Negocio
export const createOpportunity = asyncHandler(async (req, res) => {
  const {
    nombreNegocio,
    pipeline,
    etapaComercial,
    estado,
    prioridad,
    tipoNegocio,
    propietario,
    contactoNombre,
    potencialidadCliente,
    volumenPotencial,
    volumenFacturado,
    fechaInicio,
    fechaCierre,
    clientCompanyId,
    sellerId
  } = req.body;

  let validCompanyId = null;
  if (clientCompanyId && !isNaN(Number(clientCompanyId))) {
    const company = await ClientCompany.findByPk(Number(clientCompanyId));
    if (company) validCompanyId = company.id;
  }

  const newOpportunity = await Opportunity.create({
    nombreNegocio: nombreNegocio || 'Negocio sin nombre',
    pipeline: pipeline || 'Pipeline de ventas',
    etapaComercial: etapaComercial || 'cita_programada',
    estado: estado || 'Lead',
    prioridad: prioridad || 'Media',
    tipoNegocio: tipoNegocio || 'Cliente nuevo',
    propietario: propietario || null,
    contactoNombre: contactoNombre || null,
    potencialidadCliente: potencialidadCliente || 'Media',
    volumenPotencial: volumenPotencial ? Number(volumenPotencial) : 0,
    volumenFacturado: volumenFacturado ? Number(volumenFacturado) : 0,
    fechaInicio: fechaInicio || new Date(),
    fechaCierre: fechaCierre || null,
    fechaUltimaActualizacion: new Date(),
    clientCompanyId: validCompanyId,
    sellerId: await resolveSellerId(sellerId)
  });

  const fullOpp = await Opportunity.findByPk(newOpportunity.id, { include: listInclude });

  return res.status(201).json({
    message: 'Oportunidad creada exitosamente',
    data: fullOpp
  });
});

// Obtener todas las oportunidades
export const getAllOpportunities = asyncHandler(async (req, res) => {
  const { estado } = req.query;
  const whereClause = {};
  if (estado) whereClause.estado = estado;

  const opportunities = await Opportunity.findAll({
    where: whereClause,
    include: listInclude,
    order: [['id', 'DESC']],
    limit: 500
  });

  return res.status(200).json({
    message: 'Oportunidades obtenidas exitosamente',
    count: opportunities.length,
    data: opportunities
  });
});

// Obtener una oportunidad por su ID (con Eager Loading)
export const getOpportunityById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const opportunity = await Opportunity.findByPk(id, {
    include: [
      { model: ClientCompany },
      { model: Objective, through: { attributes: [] } },
      { model: Seller, include: [{ model: User }] },
      { model: activityForm }
    ]
  });

  if (!opportunity) {
    return res.status(404).json({ message: 'Oportunidad no encontrada' });
  }

  return res.status(200).json({
    message: 'Oportunidad obtenida con éxito',
    data: opportunity
  });
});

// Actualizar una oportunidad por su ID
export const updateOpportunityById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const opportunity = await Opportunity.findByPk(id);

  if (!opportunity) {
    return res.status(404).json({ message: 'Oportunidad no encontrada' });
  }

  const b = req.body || {};
  const patch = { fechaUltimaActualizacion: new Date() };

  [
    'nombreNegocio', 'pipeline', 'etapaComercial', 'estado', 'prioridad',
    'tipoNegocio', 'propietario', 'contactoNombre', 'potencialidadCliente', 'fechaCierre'
  ].forEach((k) => {
    if (b[k] !== undefined) patch[k] = b[k];
  });

  if (b.volumenPotencial !== undefined) patch.volumenPotencial = Number(b.volumenPotencial) || 0;
  if (b.volumenFacturado !== undefined) patch.volumenFacturado = Number(b.volumenFacturado) || 0;

  if (b.clientCompanyId !== undefined) {
    let validCompanyId = null;
    if (b.clientCompanyId && !isNaN(Number(b.clientCompanyId))) {
      const company = await ClientCompany.findByPk(Number(b.clientCompanyId));
      if (company) validCompanyId = company.id;
    }
    patch.clientCompanyId = validCompanyId;
  }

  if (b.sellerId !== undefined) {
    patch.sellerId = await resolveSellerId(b.sellerId);
  }

  await opportunity.update(patch);
  const fullOpp = await Opportunity.findByPk(opportunity.id, { include: listInclude });

  return res.status(200).json({
    message: 'Oportunidad actualizada exitosamente',
    data: fullOpp
  });
});

// Eliminar una oportunidad por su ID
export const deleteOpportunityById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const opportunity = await Opportunity.findByPk(id);

  if (!opportunity) {
    return res.status(404).json({ message: 'Oportunidad no encontrada' });
  }

  await opportunity.destroy();

  return res.status(200).json({ message: 'Oportunidad eliminada exitosamente' });
});
