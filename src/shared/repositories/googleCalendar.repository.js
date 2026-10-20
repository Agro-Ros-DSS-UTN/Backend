/* eslint-disable */
import { google } from 'googleapis';

// Repository de Google Calendar: acceso a una API externa, igual que los repositories
// de cada entidad acceden a la base. Usa una Service Account (no OAuth por usuario):
// un único calendario compartido ("Tareas CRM Agroquímica Rosario" o el que
// se elija) donde se crea un evento por cada (tarea, usuario asignado), con
// el usuario invitado como "guest" por su email real — así también le llega
// a su Google Calendar personal si acepta la invitación, sin que cada
// vendedor/admin tenga que loguearse con Google individualmente.
//
// Requiere en el .env:
//   GOOGLE_CALENDAR_ID                   -> el calendario compartido (su "Calendar ID", visible en
//                                            Configuración del calendario > Integrar calendario)
//   GOOGLE_SERVICE_ACCOUNT_EMAIL         -> el client_email del JSON de la Service Account
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY   -> el private_key del JSON (con los \n escapados tal cual vienen)
//
// Pasos para obtenerlos (cuando se decida activarlo):
//   1. Google Cloud Console -> crear/usar un proyecto -> habilitar "Google Calendar API".
//   2. IAM & Admin -> Service Accounts -> crear una, generar una clave JSON.
//   3. En Google Calendar (con la cuenta que va a ser el calendario compartido del equipo),
//      crear/elegir un calendario -> Configuración y uso compartido -> "Compartir con
//      determinadas personas" -> agregar el email de la Service Account (termina en
//      ...iam.gserviceaccount.com) con permiso "Hacer cambios en los eventos".
//   4. Copiar el Calendar ID de ese calendario (si es el calendario principal de una cuenta,
//      es su email; si es uno secundario, Google le asigna uno propio terminado en
//      @group.calendar.google.com).
//   5. Cargar las 3 variables en el .env del backend (nunca en el repo).
//
// Mientras falten estas variables, todas las funciones de acá son no-ops seguros
// (no rompen la creación/edición de tareas, solo quedan sin evento de calendario).

const isConfigured = () =>
  Boolean(
    process.env.GOOGLE_CALENDAR_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );

let warnedOnce = false;
const warnNotConfigured = () => {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(
    '[googleCalendar] Google Calendar no está configurado (faltan GOOGLE_CALENDAR_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY en el .env) — se omiten los eventos de calendario.'
  );
};

const getCalendarClient = () => {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
};

// Arma fecha/hora ISO a partir de fechaVencimiento (DATEONLY) + horaVencimiento ('HH:MM'),
// con 1h de duración por defecto. Si no hay hora, usa un bloque de 09:00 a 10:00.
const buildEventTimes = (task) => {
  const date = task.dueDate;
  const time = task.dueTime || '09:00';
  const start = new Date(`${date}T${time}:00-03:00`); // hora de Argentina
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

// Crea un evento para un asignado puntual de la tarea. No lanza: devuelve
// { success, eventId? , reason? } para que el caller decida qué hacer.
export const createEventForAssignee = async (task, user) => {
  if (!isConfigured()) {
    warnNotConfigured();
    return { success: false, reason: 'not_configured' };
  }
  if (!task?.dueDate) {
    return { success: false, reason: 'task_without_due_date' };
  }
  try {
    const calendar = getCalendarClient();
    const { startISO, endISO } = buildEventTimes(task);
    const attendees = user?.email ? [{ email: user.email }] : [];

    const event = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      sendUpdates: attendees.length > 0 ? 'all' : 'none',
      requestBody: {
        summary: task.title || 'Tarea CRM Agroquímica Rosario',
        description: [task.description, task.notes].filter(Boolean).join('\n\n') || undefined,
        start: { dateTime: startISO, timeZone: 'America/Argentina/Buenos_Aires' },
        end: { dateTime: endISO, timeZone: 'America/Argentina/Buenos_Aires' },
        attendees,
      },
    });

    return { success: true, eventId: event.data.id };
  } catch (error) {
    console.error('[googleCalendar] Error creando evento de Calendar:', error.message);
    return { success: false, reason: 'google_api_error', error: error.message };
  }
};

export const deleteEvent = async (eventId) => {
  if (!isConfigured() || !eventId) return { success: false, reason: 'not_configured' };
  try {
    const calendar = getCalendarClient();
    await calendar.events.delete({ calendarId: process.env.GOOGLE_CALENDAR_ID, eventId });
    return { success: true };
  } catch (error) {
    console.error('[googleCalendar] Error eliminando evento de Calendar:', error.message);
    return { success: false, reason: 'google_api_error', error: error.message };
  }
};

export const isCalendarConfigured = isConfigured;
