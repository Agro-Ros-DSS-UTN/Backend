import { Op } from 'sequelize';
import { TareaAsignado, Tarea, Usuario, Empresa } from '../models/index.js';
import { sendTaskReminderEmail } from '../services/emailReminders.js';

// fechaVencimiento (DATEONLY) + horaVencimiento ('HH:MM') en hora de Argentina.
// Sin hora: fin del día, para no avisar de más apenas se crea la tarea.
const vencimiento = (tarea) => {
  if (!tarea?.fechaVencimiento) return null;
  const hora = /^\d{2}:\d{2}$/.test(tarea.horaVencimiento || '') ? tarea.horaVencimiento : '23:59';
  const d = new Date(`${tarea.fechaVencimiento}T${hora}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Recordatorio 48 h y 24 h antes del vencimiento a cada asignado. Nunca lanza.
export const runTaskReminderSweep = async () => {
  const filas = await TareaAsignado.findAll({
    where: { [Op.or]: [{ recordatorio48hEnviado: false }, { recordatorio24hEnviado: false }] },
    include: [
      { model: Tarea, as: 'tarea', where: { estado: 'Pendiente' }, include: [{ model: Empresa, as: 'empresa', attributes: ['razonSocial'] }] },
      { model: Usuario, as: 'usuario', attributes: ['idUser', 'nombreApellido', 'email'] },
    ],
  });

  const ahora = Date.now();
  let sent48 = 0;
  let sent24 = 0;
  for (const fila of filas) {
    const v = vencimiento(fila.tarea);
    if (!v) continue;
    const horas = (v.getTime() - ahora) / 3600000;
    if (horas < 0) continue;
    if (!fila.recordatorio48hEnviado && horas <= 48) {
      if ((await sendTaskReminderEmail(fila.tarea, fila.usuario, 48)).success) {
        fila.recordatorio48hEnviado = true;
        await fila.save();
        sent48++;
      }
    }
    if (!fila.recordatorio24hEnviado && horas <= 24) {
      if ((await sendTaskReminderEmail(fila.tarea, fila.usuario, 24)).success) {
        fila.recordatorio24hEnviado = true;
        await fila.save();
        sent24++;
      }
    }
  }
  if (sent48 || sent24) console.log(`[taskReminders] Recordatorios enviados — 48h: ${sent48}, 24h: ${sent24}`);
  return { sent48, sent24, checked: filas.length };
};
