import { Op, fn, col, literal, QueryTypes } from 'sequelize';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
import {
  sequelize, Company, Opportunity, Activity, User, ProductLine, Objective, ServiceOrder, ServiceEvaluation, Task, Locality, Province,
} from '../models/index.js';
import { OPPORTUNITY_STATUSES } from '../models/commercial.model.js';
import { asyncHandler } from '../utils/http.js';
import { serializeOpportunity, includeOpportunity } from './opportunity.controller.js';
import { serializeActivity } from './activity.controller.js';
import { serializeCompany } from './company.controller.js';
import { serializeObjective } from './objective.controller.js';

// Tablero general de la administración (antes /dashboard sin autenticación).
export const general = asyncHandler(async (req, res) => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11, 1);
  twelveMonthsAgo.setUTCHours(3, 0, 0, 0);

  const [companies, opportunities, activities, sellers, productLines, objectives, monthlySales, byStatus, orders, satisfaction, pendingTasks] = await Promise.all([
    Company.findAll({ include: [{ model: Locality, as: 'locality', include: [{ model: Province, as: 'province' }] }], order: [['legalName', 'ASC']] }),
    Opportunity.findAll({ include: includeOpportunity, order: [['id', 'DESC']], limit: 1000 }),
    Activity.findAll({
      include: [
        { model: Opportunity, as: 'opportunity', attributes: ['id', 'title', 'status', 'companyId'], paranoid: false, include: [{ model: Company, as: 'company', attributes: ['id', 'legalName'], paranoid: false }] },
        { model: User, as: 'author', attributes: ['idUser', 'fullName'] },
      ],
      order: [['occurredAt', 'DESC']],
      limit: 500,
    }),
    User.findAll({ where: { role: 'vendedor' }, order: [['fullName', 'ASC']] }),
    ProductLine.findAll({ order: [['name', 'ASC']] }),
    Objective.findAll({
      where: { endDate: { [Op.gte]: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) } },
      include: [{ model: User, as: 'seller', attributes: ['idUser', 'fullName', 'role'] }, { model: Company, as: 'companies', attributes: ['id', 'legalName'], through: { attributes: [] } }],
    }),
    Activity.findAll({
      attributes: [[fn('DATE_FORMAT', literal("CONVERT_TZ(occurred_at, '+00:00', '-03:00')"), '%Y-%m'), 'month'], [fn('SUM', col('sale_amount')), 'total'], [fn('COUNT', col('id')), 'activities']],
      where: { occurredAt: { [Op.gte]: twelveMonthsAgo } },
      group: [literal('month')],
      order: [[literal('month'), 'ASC']],
      raw: true,
    }),
    Opportunity.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'quantity'], [fn('SUM', col('potential_volume')), 'volume']], group: ['status'], raw: true }),
    ServiceOrder.count({ where: { status: 'Completada', completedDate: { [Op.gte]: twelveMonthsAgo.toISOString().slice(0, 10) } } }),
    ServiceEvaluation.findOne({ attributes: [[fn('AVG', col('customer_satisfaction')), 'average'], [fn('COUNT', col('customer_satisfaction')), 'n']], raw: true }),
    Task.count({ where: { status: 'Pendiente' } }),
  ]);

  // Oportunidades que incluyen productos de cada línea (para el gráfico por línea).
  const byLine = await sequelize.query(
    `SELECT i.product_line_id AS productLine, COUNT(DISTINCT oi.opportunity_id) AS n
       FROM opportunity_items oi JOIN catalog_items i ON i.id = oi.item_id
      WHERE i.product_line_id IS NOT NULL GROUP BY i.product_line_id`,
    { type: QueryTypes.SELECT },
  );
  const oppsByLine = Object.fromEntries(byLine.map((r) => [r.productLine, r.n]));

  const funnel = OPPORTUNITY_STATUSES.map((status) => {
    const r = byStatus.find((x) => x.status === status);
    return { status, quantity: Number(r?.quantity || 0), volume: Number(r?.volume || 0) };
  });

  res.json({
    data: {
      kpis: {
        companies: companies.length,
        openOpportunities: funnel.filter((e) => ['Prospecto', 'Contactado', 'Cotizado'].includes(e.status)).reduce((a, e) => a + e.quantity, 0),
        completedOrders12m: orders,
        averageSatisfaction: satisfaction?.n ? Math.round(Number(satisfaction.average) * 10) / 10 : null,
        pendingTasks,
      },
      funnel,
      salesByMonth: monthlySales.map((v) => ({ month: v.month, total: Number(v.total || 0), activities: Number(v.activities) })),
    },
    // compatibilidad con la pantalla actual del tablero
    clients: companies.map(serializeCompany),
    opportunities: opportunities.map(serializeOpportunity),
    activities: activities.map(serializeActivity),
    sellers: sellers.map((u) => ({ idUser: u.idUser, fullName: u.fullName, email: u.email, accountStatus: u.accountStatus, role: 'vendedor' })),
    objectives: await Promise.all(objectives.map((o) => serializeObjective(o))),
    monthlySales: monthlySales.map((v) => ({ month: MONTHS[Number(v.month.slice(5, 7)) - 1], period: v.month, sales: Number(v.total || 0) })),
    productLines: productLines.map((l) => ({ id: l.id, productLine: l.name, lineName: l.name, interactions: Number(oppsByLine[l.id] || 0) })),
  });
});
