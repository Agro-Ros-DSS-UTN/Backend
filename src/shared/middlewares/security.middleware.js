import { env } from '../config/env.js';

// Cabeceras de seguridad para una API JSON (equivalente mínimo a helmet).
export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (env.isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};

// Middleware helper para respuestas que pueden cachearse en el navegador/cliente
export const cacheFor = (seconds) => (req, res, next) => {
  res.setHeader('Cache-Control', `private, max-age=${seconds}`);
  next();
};

// Middleware para rutas que NO deben cachearse bajo ninguna circunstancia
export const noCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
};

// Limitador de pedidos en memoria (ventana deslizante por clave).
// Suficiente para una sola instancia del backend; si se escalara a varias,
// habría que moverlo a un almacenamiento compartido.
export const rateLimit = ({ windowMs, max, key = (req) => req.ip, message, skipSuccessful = false }) => {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of hits) {
      const fresh = arr.filter((t) => now - t < windowMs);
      if (fresh.length) hits.set(k, fresh);
      else hits.delete(k);
    }
  }, Math.min(windowMs, 60000)).unref();

  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      const retry = Math.ceil((windowMs - (now - arr[0])) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ message: message || 'Demasiados intentos. Esperá un momento y volvé a probar.', code: 'RATE_LIMIT', retryAfter: retry });
    }
    arr.push(now);
    hits.set(k, arr);
    if (skipSuccessful) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          const cur = hits.get(k);
          if (cur) cur.pop();
        }
      });
    }
    next();
  };
};

// Login: 5 intentos fallidos por usuario cada 15 min y 30 por IP.
export const loginLimiterByUser = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  key: (req) => `u:${String(req.body?.idUser || req.body?.id || '').toLowerCase()}`,
  message: 'Demasiados intentos fallidos para este usuario. Probá de nuevo en 15 minutos.',
  skipSuccessful: true,
});
export const loginLimiterByIp = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, skipSuccessful: true });

// Límite general de la API por IP.
export const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 });
