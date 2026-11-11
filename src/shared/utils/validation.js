import { badRequest } from './http.js';

// Validaciones chicas y explícitas (sin dependencias). Cada función lanza un
// 400 con un mensaje en español que la interfaz puede mostrar tal cual.

const ZONE_AR = '-03:00'; // Argentina no usa horario de verano desde 2009

// Fecha y hora: acepta ISO con zona ("2026-10-09T17:00:00.000Z") o sin zona
// ("2026-10-09T14:00"), que se interpreta como hora de Argentina. Así deja de
// pasar que una visita cargada a las 14:00 se muestre a las 11:00.
export const parseDateTime = (value, field = 'dateTime') => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(s);
  const withTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?/.test(s);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  let d;
  if (hasZone) d = new Date(s);
  else if (withTime) d = new Date(`${s.replace(' ', 'T')}${s.length === 16 ? ':00' : ''}${ZONE_AR}`);
  else if (dateOnly) d = new Date(`${s}T00:00:00${ZONE_AR}`);
  if (!d || Number.isNaN(d.getTime())) throw badRequest(`La fecha y hora (${field}) no es válida`, { [field]: 'invalidFormat' });
  return d;
};

export const parseDate = (value, field = 'date') => {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())) {
    throw badRequest(`La fecha (${field}) no es válida (formato AAAA-MM-DD)`, { [field]: 'invalidFormat' });
  }
  return s;
};

export const required = (obj, fields) => {
  const missing = fields.filter((c) => obj[c] === undefined || obj[c] === null || String(obj[c]).trim() === '');
  if (missing.length) throw badRequest(`Faltan campos obligatorios: ${missing.join(', ')}`, Object.fromEntries(missing.map((f) => [f, 'required'])));
};

export const oneOf = (value, options, field) => {
  if (value === undefined || value === null || value === '') return value;
  if (!options.includes(value)) throw badRequest(`${field} debe ser uno de: ${options.join(', ')}`, { [field]: 'notAllowed' });
  return value;
};

export const number = (value, field, { min, max, integer = false } = {}) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || (integer && !Number.isInteger(n)) || (min !== undefined && n < min) || (max !== undefined && n > max)) {
    throw badRequest(`${field} no es un número válido`, { [field]: 'invalidNumber' });
  }
  return n;
};

export const text = (value, field, max = 255) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = String(value).trim();
  if (s.length > max) throw badRequest(`${field} supera los ${max} caracteres`, { [field]: 'tooLong' });
  return s === '' ? null : s;
};

// Archivos embebidos como data URL: solo tipos permitidos y con tamaño máximo.
const ALLOWED_MIME = /^data:(image\/(png|jpe?g|webp|gif)|audio\/(webm|ogg|mpeg|mp4|wav|x-m4a)|application\/pdf)(;[^,]*)?;base64,/i;

export const dataUrl = (value, field, maxMb = 6) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const s = String(value);
  if (!ALLOWED_MIME.test(s)) throw badRequest(`${field}: formato de archivo no permitido (imágenes, audio o PDF)`, { [field]: 'typeNotAllowed' });
  const bytes = Math.ceil(((s.length - s.indexOf(',') - 1) * 3) / 4);
  if (bytes > maxMb * 1024 * 1024) throw badRequest(`${field}: el archivo supera ${maxMb} MB`, { [field]: 'tooLarge' });
  checkContent(s, field);
  return s;
};

// El tipo que declara el navegador se puede falsear: se mira también el contenido.
// Imágenes y PDF tienen que empezar con su firma real; un audio no puede ser texto
// (HTML, script). Un PDF con JavaScript adentro se rechaza.
const startsWith = (buf, sig, offset = 0) => sig.every((b, i) => buf[offset + i] === b);
const IMAGE_SIGNATURES = [
  (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]), // PNG
  (b) => startsWith(b, [0xff, 0xd8, 0xff]), // JPEG
  (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]), // GIF
  (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8), // WebP
];
const looksLikeText = (b) => {
  const head = b.subarray(0, 64).toString('latin1').trimStart().toLowerCase();
  return head.startsWith('<') || head.startsWith('{') || /^(<!doctype|<html|<svg|<script|<\?xml)/.test(head);
};

const checkContent = (s, field) => {
  const mime = s.slice(5, s.indexOf(';')).toLowerCase();
  const b64 = s.slice(s.indexOf(',') + 1);
  const head = Buffer.from(b64.slice(0, 64), 'base64');
  const reject = () => {
    throw badRequest(`${field}: el contenido del archivo no corresponde a su tipo`, { [field]: 'contentMismatch' });
  };
  if (mime.startsWith('image/')) {
    if (!IMAGE_SIGNATURES.some((ok) => ok(head))) reject();
  } else if (mime === 'application/pdf') {
    if (!startsWith(head, [0x25, 0x50, 0x44, 0x46])) reject(); // %PDF
    const body = Buffer.from(b64, 'base64').toString('latin1');
    if (/\/(JavaScript|JS)\b/.test(body)) {
      throw badRequest(`${field}: el PDF tiene código JavaScript y no se acepta`, { [field]: 'pdfScript' });
    }
  } else if (mime.startsWith('audio/')) {
    if (looksLikeText(head)) reject();
  }
};

export const urlHttp = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  try {
    const u = new URL(String(value));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    return u.toString();
  } catch {
    throw badRequest(`${field} debe ser un enlace http(s) válido`, { [field]: 'invalidUrl' });
  }
};

// CUIT argentino con dígito verificador.
export const isValidCuit = (cuit) => {
  const d = String(cuit || '').replace(/\D/g, '');
  if (d.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  let dv = 11 - (sum % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return dv === Number(d[10]);
};

export const formatCuit = (cuit) => {
  const d = String(cuit || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : String(cuit || '').trim();
};

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Fecha de hoy en Argentina (AAAA-MM-DD), sin depender de la zona horaria del servidor.
export const todayAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
