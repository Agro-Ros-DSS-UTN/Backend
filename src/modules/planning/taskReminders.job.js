import { Op } from 'sequelize';
import { TaskAssignee, Task, User, Company } from '../../shared/models/index.js';
import { sendTaskReminderEmail } from '../../shared/services/emailReminders.js';

// dueDate (DATEONLY) + dueTime ('HH:MM') en hora de Argentina.
// Sin hora: fin del día, para no avisar de más apenas se crea la tarea.
const due = (task) => {
  if (!task?.dueDate) return null;
  const time = /^\d{2}:\d{2}$/.test(task.dueTime || '') ? task.dueTime : '23:59';
  const d = new Date(`${task.dueDate}T${time}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Recordatorio 48 h y 24 h antes del vencimiento a cada asignado. Nunca lanza.
export const runTaskReminderSweep = async () => {
  const rows = await TaskAssignee.findAll({
    where: { [Op.or]: [{ reminder48hSent: false }, { reminder24hSent: false }] },
    include: [
      { model: Task, as: 'task', where: { status: 'Pendiente' }, include: [{ model: Company, as: 'company', attributes: ['legalName'] }] },
      { model: User, as: 'user', attributes: ['idUser', 'fullName', 'email'] },
    ],
  });

  const now = Date.now();
  let sent48 = 0;
  let sent24 = 0;
  for (const row of rows) {
    const v = due(row.task);
    if (!v) continue;
    const hours = (v.getTime() - now) / 3600000;
    if (hours < 0) continue;
    if (!row.reminder48hSent && hours <= 48) {
      if ((await sendTaskReminderEmail(row.task, row.user, 48)).success) {
        row.reminder48hSent = true;
        await row.save();
        sent48++;
      }
    }
    if (!row.reminder24hSent && hours <= 24) {
      if ((await sendTaskReminderEmail(row.task, row.user, 24)).success) {
        row.reminder24hSent = true;
        await row.save();
        sent24++;
      }
    }
  }
  if (sent48 || sent24) console.log(`[taskReminders] Recordatorios enviados — 48h: ${sent48}, 24h: ${sent24}`);
  return { sent48, sent24, checked: rows.length };
};
