import { badRequest } from './http.js';

// Validaciones chicas y explícitas (sin dependencias). Cada función lanza un
// 400 con un mensaje en español que la interfaz puede mostrar tal cual.

const ZONA_AR = '-03:00'; // Argentina no usa horario de verano desde 2009

// Fecha y hora: acepta ISO con zona ("2026-10-09T17:00:00.000Z") o sin zona
// ("2026-10-09T14:00"), que se interpreta como hora de Argentina. Así deja de
// pasar que una visita cargada a las 14:00 se muestre a las 11:00.
export const parseFechaHora = (value, campo = 'fecha y hora') => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  const tieneZona = /(Z|[+-]\d{2}:?\d{2})$/.test(s);
  const conHora = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?/.test(s);
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(s);
  let d;
  if (tieneZona) d = new Date(s);
  else if (conHora) d = new Date(`${s.replace(' ', 'T')}${s.length === 16 ? ':00' : ''}${ZONA_AR}`);
  else if (soloFecha) d = new Date(`${s}T00:00:00${ZONA_AR}`);
  if (!d || Number.isNaN(d.getTime())) throw badRequest(`La ${campo} no es válida`, { [campo]: 'formato inválido' });
  return d;
};

export const parseFecha = (value, campo = 'fecha') => {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())) {
    throw badRequest(`La ${campo} no es válida (formato AAAA-MM-DD)`, { [campo]: 'formato inválido' });
  }
  return s;
};

export const requerido = (obj, campos) => {
  const faltan = campos.filter((c) => obj[c] === undefined || obj[c] === null || String(obj[c]).trim() === '');
  if (faltan.length) throw badRequest(`Faltan campos obligatorios: ${faltan.join(', ')}`, Object.fromEntries(faltan.map((f) => [f, 'obligatorio'])));
};

export const unoDe = (value, opciones, campo) => {
  if (value === undefined || value === null || value === '') return value;
  if (!opciones.includes(value)) throw badRequest(`${campo} debe ser uno de: ${opciones.join(', ')}`, { [campo]: 'valor no permitido' });
  return value;
};

export const numero = (value, campo, { min, max, entero = false } = {}) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || (entero && !Number.isInteger(n)) || (min !== undefined && n < min) || (max !== undefined && n > max)) {
    throw badRequest(`${campo} no es un número válido`, { [campo]: 'número inválido' });
  }
  return n;
};

export const texto = (value, campo, max = 255) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = String(value).trim();
  if (s.length > max) throw badRequest(`${campo} supera los ${max} caracteres`, { [campo]: 'demasiado largo' });
  return s === '' ? null : s;
};

// Archivos embebidos como data URL: solo tipos permitidos y con tamaño máximo.
const MIME_PERMITIDOS = /^data:(image\/(png|jpe?g|webp|gif)|audio\/(webm|ogg|mpeg|mp4|wav|x-m4a)|application\/pdf)(;[^,]*)?;base64,/i;

export const dataUrl = (value, campo, maxMb = 6) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const s = String(value);
  if (!MIME_PERMITIDOS.test(s)) throw badRequest(`${campo}: formato de archivo no permitido (imágenes, audio o PDF)`, { [campo]: 'tipo no permitido' });
  const bytes = Math.ceil(((s.length - s.indexOf(',') - 1) * 3) / 4);
  if (bytes > maxMb * 1024 * 1024) throw badRequest(`${campo}: el archivo supera ${maxMb} MB`, { [campo]: 'demasiado grande' });
  return s;
};

export const urlHttp = (value, campo) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  try {
    const u = new URL(String(value));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    return u.toString();
  } catch {
    throw badRequest(`${campo} debe ser un enlace http(s) válido`, { [campo]: 'enlace inválido' });
  }
};

// CUIT argentino con dígito verificador.
export const cuitValido = (cuit) => {
  const d = String(cuit || '').replace(/\D/g, '');
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return dv === Number(d[10]);
};

export const formatearCuit = (cuit) => {
  const d = String(cuit || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : String(cuit || '').trim();
};

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
