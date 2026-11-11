// Pruebas automáticas del API contra una base de prueba (ver test/setup-db.mjs).
// Levantan el servidor real y prueban permisos, sesión y validaciones clave.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 3990 + Math.floor(Math.random() * 9);
const B = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'Prueba#2026';
let server;

const api = async (method, path, body, token) => {
  const r = await fetch(B + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, data };
};
const login = async (idUser, rememberMe = false) => (await api('POST', '/auth/login', { idUser, password: PASSWORD, rememberMe })).data?.token;
const payload = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url'));
const dataOf = (r) => r.data?.data ?? r.data;
const enc = (mime, buf) => `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;

let A; let V1; let V2;

before(async () => {
  server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('El servidor no arrancó')), 20000);
    server.stdout.on('data', (d) => { if (String(d).includes('puerto')) { clearTimeout(t); resolve(); } });
    server.stderr.on('data', (d) => process.stderr.write(d));
    server.on('exit', (code) => reject(new Error(`El servidor terminó con código ${code}`)));
  });
  [A, V1, V2] = [await login('admin1'), await login('vend1'), await login('vend2', true)];
});
after(() => server?.kill());

test('los listados principales responden 200 (vendedor y admin)', async () => {
  for (const p of ['/activities', '/companies', '/contacts', '/tasks', '/opportunities', '/notifications/summary', '/catalog', '/users', '/roadmaps', '/objectives', '/promotions']) {
    assert.equal((await api('GET', p, null, V1)).status, 200, `vendedor GET ${p}`);
  }
  for (const p of ['/activities', '/dashboard', '/service-orders', '/employees', '/internal-notes']) {
    assert.equal((await api('GET', p, null, A)).status, 200, `admin GET ${p}`);
  }
});

test('sin sesión no hay acceso; las rutas de admin están cerradas al vendedor', async () => {
  assert.equal((await api('GET', '/companies')).status, 401);
  for (const p of ['/dashboard', '/service-orders', '/employees', '/internal-notes']) {
    assert.equal((await api('GET', p, null, V1)).status, 403, `vendedor GET ${p}`);
  }
});

test('un vendedor no usa oportunidades de otro vendedor', async () => {
  const o = dataOf(await api('POST', '/opportunities', { title: 'Opp de vend1', companyId: 2 }, V1));
  assert.equal((await api('GET', `/opportunities/${o.id}`, null, V2)).status, 403);
  const r = await api('POST', '/activities', { type: 'Llamada', description: 'x', opportunityId: o.id, opportunityStatus: 'Perdida', noFollowUp: true }, V2);
  assert.equal(r.status, 403);
  assert.equal((await api('POST', '/activities', { type: 'Llamada', description: 'y', opportunityId: o.id, noFollowUp: true }, V1)).status, 201);
});

test('al crear una empresa solo se asocian contactos sin empresa', async () => {
  const r = await api('POST', '/companies', { legalName: 'Empresa con robo', cuit: '20-12345678-6', existingContactId: 1 }, V2);
  assert.equal(r.status, 400);
  const free = dataOf(await api('POST', '/contacts', { fullName: 'Contacto suelto' }, V2));
  assert.equal((await api('POST', '/companies', { legalName: 'Empresa ok', cuit: '20-12345678-6', existingContactId: free.id }, V2)).status, 201);
});

test('el vendedor no carga contactos en empresas fuera de su zona', async () => {
  assert.equal((await api('POST', '/contacts', { fullName: 'X', companyId: 1 }, V2)).status, 403);
  assert.equal((await api('POST', '/contacts', { fullName: 'Y', companyId: 1 }, A)).status, 201);
});

test('el costo del catálogo solo lo ve la administración', async () => {
  const item = dataOf(await api('POST', '/catalog', { type: 'producto', name: 'Producto prueba', referencePrice: 100, unitCost: 60 }, A));
  const adminView = dataOf(await api('GET', `/catalog/${item.id}`, null, A));
  const sellerView = dataOf(await api('GET', `/catalog/${item.id}`, null, V1));
  assert.equal(adminView.unitCost, 60);
  assert.equal(sellerView.unitCost, undefined);
  assert.equal(sellerView.referencePrice, 100);
});

test('los archivos se validan por su contenido', async () => {
  const fake = enc('image/png', Buffer.from('<html><script>alert(1)</script></html>'));
  assert.equal((await api('PUT', '/users/vend1/image', { profileImage: fake }, V1)).status, 400);
  const png = enc('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal((await api('PUT', '/users/vend1/image', { profileImage: png }, V1)).status, 200);
});

test('la búsqueda escapa los comodines', async () => {
  const r = await api('GET', '/search?q=%25%25', null, V1);
  assert.equal(r.status, 200);
  assert.equal(dataOf(r).companies.length, 0);
});

test('la sesión se renueva con la misma duración y se cierra en todos los dispositivos', async () => {
  const longRefresh = (await api('POST', '/auth/refresh', null, V2)).data.token;
  assert.equal(payload(longRefresh).exp - payload(longRefresh).iat, 3 * 86400);
  const shortRefresh = (await api('POST', '/auth/refresh', null, A)).data.token;
  assert.equal(payload(shortRefresh).exp - payload(shortRefresh).iat, 8 * 3600);
  assert.equal((await api('POST', '/auth/logout-all', {}, longRefresh)).status, 200);
  assert.equal((await api('GET', '/auth/me', null, V2)).status, 401);
  assert.equal((await api('GET', '/auth/me', null, longRefresh)).status, 401);
});

test('el límite de intentos no se esquiva con espacios', async () => {
  const codes = [];
  for (let i = 1; i <= 6; i++) codes.push((await api('POST', '/auth/login', { idUser: `${' '.repeat(i)}vend1`, password: 'mala' })).status);
  assert.ok(codes.includes(429), `códigos: ${codes.join(' ')}`);
});
