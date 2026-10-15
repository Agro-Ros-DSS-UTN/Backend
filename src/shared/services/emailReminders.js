/* eslint-disable */
import nodemailer from 'nodemailer';
import { escapeHtml as h } from '../utils/validation.js';

// Envío de recordatorios por email 48hs/24hs antes del vencimiento de una
// tarea. Usa SMTP estándar (funciona con Gmail + "Contraseña de aplicación",
// Google Workspace, SendGrid, o cualquier proveedor que exponga un relay
// SMTP) para no atar el proyecto a un proveedor puntual.
//
// Requiere en el .env:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE ('true'|'false'), SMTP_USER, SMTP_PASS
//   SMTP_FROM   -> remitente que verán los destinatarios, ej. "CRM Agroquímica Rosario <no-reply@agroquimicarosario.com>"
//
// Mientras falten estas variables, send() es un no-op seguro (no rompe la
// creación/edición de tareas ni el barrido de recordatorios).

const isConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let warnedOnce = false;
const warnNotConfigured = () => {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(
    '[emailReminders] SMTP no está configurado (faltan SMTP_HOST / SMTP_USER / SMTP_PASS en el .env) — se omiten los recordatorios por mail.'
  );
};

let cachedTransporter = null;
const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cachedTransporter;
};

const buildSubject = (task, hoursBefore) =>
  `Recordatorio: "${String(task.title || 'Tarea').replace(/[\r\n]+/g, ' ').slice(0, 120)}" vence en ${hoursBefore}hs`;

// Todo texto cargado por usuarios se escapa antes de ir al HTML del mail.
const buildHtml = (task, user, hoursBefore) => `
  <div style="font-family: Arial, sans-serif; color: #0f172a;">
    <p>Hola ${h(user?.fullName)},</p>
    <p>Te recordamos que la tarea <strong>"${h(task.title || 'Tarea sin título')}"</strong> vence en <strong>${hoursBefore} horas</strong> (${h(task.dueDate)} ${h(task.dueTime)}hs).</p>
    ${task.company?.legalName ? `<p><strong>Empresa/Cliente:</strong> ${h(task.company.legalName)}</p>` : ''}
    ${task.notes ? `<p><strong>Notas:</strong> ${h(task.notes)}</p>` : ''}
    <p style="color:#64748b; font-size: 12px;">CRM Agroquímica Rosario</p>
  </div>
`;

// No lanza: devuelve { success, reason? } para que el caller decida qué hacer.
export const sendTaskReminderEmail = async (task, user, hoursBefore) => {
  if (!isConfigured()) {
    warnNotConfigured();
    return { success: false, reason: 'not_configured' };
  }
  if (!user?.email) {
    return { success: false, reason: 'user_without_email' };
  }
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: buildSubject(task, hoursBefore),
      html: buildHtml(task, user, hoursBefore),
    });
    return { success: true };
  } catch (error) {
    console.error('[emailReminders] Error enviando recordatorio por mail:', error.message);
    return { success: false, reason: 'smtp_error', error: error.message };
  }
};

export const isEmailConfigured = isConfigured;
