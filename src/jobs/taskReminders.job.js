/* eslint-disable */
import { TaskAssignee, Task, User } from '../models/index.js';
import { sendTaskReminderEmail } from '../services/emailReminders.js';

// Combina fechaVencimiento (DATEONLY) + horaVencimiento ('HH:MM') en un Date.
// Si no hay hora cargada, asume el final del día (23:59) para no disparar
// recordatorios de más apenas se crea la tarea.
const taskDeadline = (task) => {
  if (!task?.fechaVencimiento) return null;
  const hora = task.horaVencimiento || '23:59';
  const d = new Date(`${task.fechaVencimiento}T${hora}:00`);
  return isNaN(d) ? null : d;
};

const NOT_ACTIVE_STATES = ['finalizada', 'completada', 'cancelada'];

// Recorre cada (tarea, usuario asignado) pendiente y manda el recordatorio
// de 48hs y/o 24hs antes del vencimiento si todavía no se mandó. Pensado
// para correr periódicamente (ver server.js, node-cron). Nunca lanza: cada
// error de un envío puntual se loguea y se sigue con el resto.
export const runTaskReminderSweep = async () => {
  const pending = await TaskAssignee.findAll({
    where: {
      recordatorio48hEnviado: false,
      // Sequelize no soporta OR directo en `where` simple con dos columnas booleanas
      // distintas de forma legible acá — se filtra 48h siempre y 24h aparte abajo
    },
    include: [{ model: Task }, { model: User }],
  });

  const alsoFor24h = await TaskAssignee.findAll({
    where: { recordatorio24hEnviado: false },
    include: [{ model: Task }, { model: User }],
  });

  const byId = new Map();
  [...pending, ...alsoFor24h].forEach((row) => byId.set(row.id, row));

  const now = new Date();
  let sent48 = 0;
  let sent24 = 0;

  for (const row of byId.values()) {
    const task = row.Task;
    if (!task) continue;
    if (NOT_ACTIVE_STATES.includes(String(task.estado || '').toLowerCase())) continue;

    const deadline = taskDeadline(task);
    if (!deadline) continue;
    const hoursUntil = (deadline.getTime() - now.getTime()) / 3600000;
    if (hoursUntil < 0) continue; // ya venció, no tiene sentido recordar

    if (!row.recordatorio48hEnviado && hoursUntil <= 48) {
      const result = await sendTaskReminderEmail(task, row.User, 48);
      if (result.success) {
        row.recordatorio48hEnviado = true;
        await row.save();
        sent48 += 1;
      }
    }

    if (!row.recordatorio24hEnviado && hoursUntil <= 24) {
      const result = await sendTaskReminderEmail(task, row.User, 24);
      if (result.success) {
        row.recordatorio24hEnviado = true;
        await row.save();
        sent24 += 1;
      }
    }
  }

  if (sent48 > 0 || sent24 > 0) {
    console.log(`[taskReminders] Recordatorios enviados — 48h: ${sent48}, 24h: ${sent24}`);
  }

  return { sent48, sent24, checked: byId.size };
};
