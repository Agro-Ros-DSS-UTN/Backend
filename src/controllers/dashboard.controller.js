import { Op, fn, col, literal, QueryTypes } from 'sequelize';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
import {
  sequelize, Empresa, Oportunidad, Actividad, Usuario, LineaProducto, Objetivo, OrdenServicio, EvaluacionServicio, Tarea, Localidad, Provincia,
} from '../models/index.js';
import { ESTADOS_OPORTUNIDAD } from '../models/comercial.model.js';
import { asyncHandler } from '../utils/http.js';
import { serializeOportunidad, includeOportunidad } from './oportunidad.controller.js';
import { serializeActividad } from './actividad.controller.js';
import { serializeEmpresa } from './empresa.controller.js';
import { serializeObjetivo } from './objetivo.controller.js';

// Tablero general de la administración (antes /dashboard sin autenticación).
export const general = asyncHandler(async (req, res) => {
  const hace12 = new Date();
  hace12.setUTCMonth(hace12.getUTCMonth() - 11, 1);
  hace12.setUTCHours(3, 0, 0, 0);

  const [empresas, oportunidades, actividades, vendedores, lineas, objetivos, ventasMes, porEstado, ordenes, satisfaccion, tareasPendientes] = await Promise.all([
    Empresa.findAll({ include: [{ model: Localidad, as: 'localidad', include: [{ model: Provincia, as: 'provincia' }] }], order: [['razonSocial', 'ASC']] }),
    Oportunidad.findAll({ include: includeOportunidad, order: [['id', 'DESC']], limit: 1000 }),
    Actividad.findAll({
      include: [
        { model: Oportunidad, as: 'oportunidad', attributes: ['id', 'titulo', 'estado', 'empresaId'], paranoid: false, include: [{ model: Empresa, as: 'empresa', attributes: ['id', 'razonSocial'], paranoid: false }] },
        { model: Usuario, as: 'autor', attributes: ['idUser', 'nombreApellido'] },
      ],
      order: [['fechaHora', 'DESC']],
      limit: 500,
    }),
    Usuario.findAll({ where: { rol: 'vendedor' }, order: [['nombreApellido', 'ASC']] }),
    LineaProducto.findAll({ order: [['nombre', 'ASC']] }),
    Objetivo.findAll({
      where: { fechaFin: { [Op.gte]: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) } },
      include: [{ model: Usuario, as: 'vendedor', attributes: ['idUser', 'nombreApellido', 'rol'] }, { model: Empresa, as: 'empresas', attributes: ['id', 'razonSocial'], through: { attributes: [] } }],
    }),
    Actividad.findAll({
      attributes: [[fn('DATE_FORMAT', literal("CONVERT_TZ(fecha_hora, '+00:00', '-03:00')"), '%Y-%m'), 'mes'], [fn('SUM', col('monto_venta')), 'total'], [fn('COUNT', col('id')), 'actividades']],
      where: { fechaHora: { [Op.gte]: hace12 } },
      group: [literal('mes')],
      order: [[literal('mes'), 'ASC']],
      raw: true,
    }),
    Oportunidad.findAll({ attributes: ['estado', [fn('COUNT', col('id')), 'cantidad'], [fn('SUM', col('volumen_potencial')), 'volumen']], group: ['estado'], raw: true }),
    OrdenServicio.count({ where: { estado: 'Completada', fechaRealizada: { [Op.gte]: hace12.toISOString().slice(0, 10) } } }),
    EvaluacionServicio.findOne({ attributes: [[fn('AVG', col('satisfaccion_cliente')), 'promedio'], [fn('COUNT', col('satisfaccion_cliente')), 'n']], raw: true }),
    Tarea.count({ where: { estado: 'Pendiente' } }),
  ]);

  // Oportunidades que incluyen productos de cada línea (para el gráfico por línea).
  const porLinea = await sequelize.query(
    `SELECT i.linea_id AS linea, COUNT(DISTINCT oi.oportunidad_id) AS n
       FROM oportunidad_items oi JOIN items_catalogo i ON i.id = oi.item_id
      WHERE i.linea_id IS NOT NULL GROUP BY i.linea_id`,
    { type: QueryTypes.SELECT },
  );
  const oppsPorLinea = Object.fromEntries(porLinea.map((r) => [r.linea, r.n]));

  const embudo = ESTADOS_OPORTUNIDAD.map((estado) => {
    const r = porEstado.find((x) => x.estado === estado);
    return { estado, cantidad: Number(r?.cantidad || 0), volumen: Number(r?.volumen || 0) };
  });

  res.json({
    data: {
      kpis: {
        empresas: empresas.length,
        oportunidadesAbiertas: embudo.filter((e) => ['Prospecto', 'Contactado', 'Cotizado'].includes(e.estado)).reduce((a, e) => a + e.cantidad, 0),
        ordenesRealizadas12m: ordenes,
        satisfaccionPromedio: satisfaccion?.n ? Math.round(Number(satisfaccion.promedio) * 10) / 10 : null,
        tareasPendientes,
      },
      embudo,
      ventasPorMes: ventasMes.map((v) => ({ mes: v.mes, total: Number(v.total || 0), actividades: Number(v.actividades) })),
    },
    // compatibilidad con la pantalla actual del tablero
    clients: empresas.map(serializeEmpresa),
    opportunities: oportunidades.map(serializeOportunidad),
    activities: actividades.map(serializeActividad),
    sellers: vendedores.map((u) => ({ idUser: u.idUser, nombreApellido: u.nombreApellido, email: u.email, estadoCuenta: u.estadoCuenta, role: 'vendedor' })),
    objectives: await Promise.all(objetivos.map((o) => serializeObjetivo(o))),
    monthlySales: ventasMes.map((v) => ({ mes: MESES[Number(v.mes.slice(5, 7)) - 1], periodo: v.mes, ventas: Number(v.total || 0) })),
    productLines: lineas.map((l) => ({ id: l.id, linea: l.nombre, nombreLinea: l.nombre, interacciones: Number(oppsPorLinea[l.id] || 0) })),
  });
});
