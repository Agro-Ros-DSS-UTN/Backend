import { OPPORTUNITY_STATUSES } from '../commercial/opportunity.entity.js';
import * as dashboardRepository from './dashboard.repository.js';
import { serializeOpportunity } from '../commercial/opportunity.service.js';
import { serializeActivity } from '../planning/activity.service.js';
import { serializeCompany } from '../company/company.service.js';
import { serializeObjective } from '../planning/objective.service.js';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Tablero general de la administración.
export const getGeneralDashboard = async () => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 11, 1);
  twelveMonthsAgo.setUTCHours(3, 0, 0, 0);

  const {
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
  } = await dashboardRepository.fetchDashboardData(twelveMonthsAgo);

  const oppsByLine = Object.fromEntries(byLine.map((r) => [r.productLine, r.n]));

  const funnel = OPPORTUNITY_STATUSES.map((status) => {
    const r = byStatus.find((x) => x.status === status);
    return { status, quantity: Number(r?.quantity || 0), volume: Number(r?.volume || 0) };
  });

  return {
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
  };
};
