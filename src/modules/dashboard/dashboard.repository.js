import { Op, fn, col, literal, QueryTypes } from 'sequelize';
import {
  sequelize, Company, Opportunity, Activity, User, ProductLine, Objective, ServiceOrder, ServiceEvaluation, Task, Locality, Province,
} from '../../shared/models/index.js';
import { includeOpportunity } from '../opportunity/opportunity.repository.js';

export const fetchDashboardData = async (twelveMonthsAgo) => {
  const [
    companies,
    opportunities,
    activities,
    sellers,
    productLines,
    objectives,
    monthlySales,
    byStatus,
    orders,
    satisfaction,
    pendingTasks,
    byLine,
  ] = await Promise.all([
    Company.findAll({
      attributes: ['id', 'legalName', 'tradeName', 'companyType', 'level', 'localityId', 'createdById', 'parentCompanyId'],
      include: [{ model: Locality, as: 'locality', attributes: ['id', 'name'] }],
      order: [['legalName', 'ASC']],
    }),
    Opportunity.findAll({ include: includeOpportunity, order: [['id', 'DESC']], limit: 200 }),
    Activity.findAll({
      include: [
        {
          model: Opportunity,
          as: 'opportunity',
          attributes: ['id', 'title', 'status', 'companyId'],
          paranoid: false,
          include: [{ model: Company, as: 'company', attributes: ['id', 'legalName'], paranoid: false }],
        },
        { model: User, as: 'author', attributes: ['idUser', 'fullName'] },
      ],
      order: [['occurredAt', 'DESC']],
      limit: 100,
    }),
    User.findAll({ where: { role: 'vendedor' }, order: [['fullName', 'ASC']] }),
    ProductLine.findAll({ order: [['name', 'ASC']] }),
    Objective.findAll({
      where: { endDate: { [Op.gte]: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) } },
      include: [
        { model: User, as: 'seller', attributes: ['idUser', 'fullName', 'role'] },
        { model: Company, as: 'companies', attributes: ['id', 'legalName'], through: { attributes: [] } },
      ],
    }),
    Activity.findAll({
      attributes: [
        [fn('DATE_FORMAT', literal("CONVERT_TZ(occurred_at, '+00:00', '-03:00')"), '%Y-%m'), 'month'],
        [fn('SUM', col('sale_amount')), 'total'],
        [fn('COUNT', col('id')), 'activities'],
      ],
      where: { occurredAt: { [Op.gte]: twelveMonthsAgo } },
      group: [literal('month')],
      order: [[literal('month'), 'ASC']],
      raw: true,
    }),
    Opportunity.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'quantity'], [fn('SUM', col('potential_volume')), 'volume']],
      group: ['status'],
      raw: true,
    }),
    ServiceOrder.count({
      where: { status: 'Completada', completedDate: { [Op.gte]: twelveMonthsAgo.toISOString().slice(0, 10) } },
    }),
    ServiceEvaluation.findOne({
      attributes: [[fn('AVG', col('customer_satisfaction')), 'average'], [fn('COUNT', col('customer_satisfaction')), 'n']],
      raw: true,
    }),
    Task.count({ where: { status: 'Pendiente' } }),
    sequelize.query(
      `SELECT i.product_line_id AS productLine, COUNT(DISTINCT oi.opportunity_id) AS n
         FROM opportunity_items oi JOIN catalog_items i ON i.id = oi.item_id
        WHERE i.product_line_id IS NOT NULL GROUP BY i.product_line_id`,
      { type: QueryTypes.SELECT }
    ),
  ]);

  return {
    companies,
    opportunities,
    activities,
    sellers,
    productLines,
    objectives,
    monthlySales,
    byStatus,
    orders,
    satisfaction,
    pendingTasks,
    byLine,
  };
};
