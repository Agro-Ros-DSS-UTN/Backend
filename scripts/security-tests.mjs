#!/usr/bin/env node
// Pruebas de seguridad y de reglas de negocio contra una API levantada con una
// base de PRUEBA (nunca contra producción: crea y modifica registros).
//   API_URL=http://localhost:3100 TEST_PASSWORD=... node scripts/security-tests.mjs
const API = process.env.API_URL || 'http://localhost:3100';
const PW = process.env.TEST_PASSWORD || 'clave-prueba-123';
const ADMIN = process.env.TEST_ADMIN || 'Admin';
const SELLER = process.env.TEST_SELLER || 'Vend';
const VEND2 = process.env.TEST_VEND2 || 'Agustin_agroros';
const INACTIVO = process.env.TEST_INACTIVE || 'Baja_agroros';

let ok = 0;
let fail = 0;
const results = [];
const check = (name, cond, details = '') => {
  if (cond) ok++; else fail++;
  results.push(`${cond ? '✔' : '✘'} ${name}${!cond && details ? `  → ${details}` : ''}`);
};

const call = async (method, path, { token, body, headers = {}, raw } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  return { status: res.status, data, headers: res.headers };
};
const login = async (idUser, password = PW) => call('POST', '/auth/login', { body: { idUser, password } });

// ── 1. Sin token ──
for (const p of ['/companies', '/contacts', '/users', '/opportunities', '/activities', '/tasks', '/roadmaps', '/objectives', '/promotions', '/service-orders', '/employees', '/dashboard', '/products', '/localities']) {
  const r = await call('GET', p);
  check(`GET ${p} sin token → 401`, r.status === 401, r.status);
}
check('POST /users sin token → 401', (await call('POST', '/users', { body: { idUser: 'x' } })).status === 401);
check('GET /dashboard (antes público) sin token → 401', (await call('GET', '/dashboard')).status === 401);

// ── 2. Login ──
const a = await login(ADMIN);
check('Login admin → 200 con token', a.status === 200 && a.data?.token, JSON.stringify(a.data));
const v = await login(SELLER);
check('Login vendedor → 200', v.status === 200 && v.data?.token);
const v2 = await login(VEND2);
const A = a.data?.token;
const V = v.data?.token;
const V2 = v2.data?.token;
check('La respuesta de login no incluye el hash', !JSON.stringify(a.data).includes('$2'));
const wrongPassword = await login(ADMIN, 'incorrecta-123');
const missing = await login('no_existe_xyz', 'incorrecta-123');
check('Contraseña incorrecta → 401', wrongPassword.status === 401);
check('Usuario inexistente → mismo 401 y mismo mensaje', missing.status === 401 && missing.data?.message === wrongPassword.data?.message);
const inactiveLogin = await login(INACTIVO);
check('Usuario inactivo → 403 sin token', inactiveLogin.status === 403 && !inactiveLogin.data?.token);

// ── 3. Tokens manipulados ──
const [h, p] = A.split('.');
const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
const fakeAdmin = `${h}.${Buffer.from(JSON.stringify({ ...payload, sub: SELLER })).toString('base64url')}.${A.split('.')[2]}`;
check('Token con payload alterado → 401', (await call('GET', '/users', { token: fakeAdmin })).status === 401);
const withoutSignature = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${p}.`;
check('Token alg=none → 401', (await call('GET', '/users', { token: withoutSignature })).status === 401);
check('Token basura → 401', (await call('GET', '/users', { token: 'abc.def.ghi' })).status === 401);

// ── 4. Permisos por rol (vendedor) ──
const adminOnly = [
  ['POST', '/users', { idUser: 'hack', fullName: 'x', password: 'abcdefg123', role: 'administrador' }],
  ['DELETE', '/users/Admin'],
  ['DELETE', '/companies/1'],
  ['GET', '/service-orders'],
  ['GET', '/employees'],
  ['GET', '/dashboard'],
  ['GET', '/internal-notes'],
  ['POST', '/objectives', { userId: SELLER, objectiveType: 'visitas', targetAmount: 1, startDate: '2026-10-12' }],
  ['POST', '/promotions', { name: 'x', startDate: '2026-10-01', endDate: '2026-10-30' }],
  ['POST', '/products', { name: 'x' }],
  ['PUT', '/users/Vend/zone', { localityIds: [] }],
];
for (const [m, path, body] of adminOnly) {
  const r = await call(m, path, { token: V, body });
  check(`Vendedor ${m} ${path} → 403 FORBIDDEN_ACTION`, r.status === 403 && r.data?.code === 'FORBIDDEN_ACTION', `${r.status} ${JSON.stringify(r.data)}`);
}
const usersV = await call('GET', '/users', { token: V });
check('Vendedor ve lista mínima de usuarios (sin email ni estado)', usersV.status === 200 && usersV.data.data.every((u) => !u.email && u.accountStatus === undefined), JSON.stringify(usersV.data?.data?.[0]));
const autoPromote = await call('PUT', `/users/${SELLER}`, { token: V, body: { role: 'administrador', accountStatus: 'Activo' } });
const me = await call('GET', '/auth/me', { token: V });
check('Vendedor no puede cambiarse el rol', me.data?.data?.role === 'vendedor', `${autoPromote.status} ${JSON.stringify(me.data)}`);
check('Vendedor no puede editar a otro usuario → 403', (await call('PUT', `/users/${ADMIN}`, { token: V, body: { fullName: 'x' } })).status === 403);

// ── 5. Validación de entradas peligrosas ──
const companies = (await call('GET', '/companies', { token: A })).data.data;
const company = companies[0];
const roadmap = await call('POST', '/roadmaps', { token: V, body: { date: '2026-10-15', name: 'Prueba', stops: [{ placeName: 'X', url: 'javascript:alert(1)' }] } });
check('Parada con url javascript: → 400', roadmap.status === 400, roadmap.status);
const roadmap2 = await call('POST', '/roadmaps', { token: V, body: { date: '2026-10-15', name: 'Prueba', stops: [{ placeName: 'X', companyId: company.id, url: 'https://maps.google.com/?q=1' }] } });
check('Hoja de ruta propia con url https → 201', roadmap2.status === 201, JSON.stringify(roadmap2.data));
const adhoc = await call('POST', `/roadmaps/${roadmap2.data?.data?.id}/stops`, { token: V, body: { text: '<img src=x onerror=alert(1)>', url: 'data:text/html,<script>alert(1)</script>' } });
check('Parada ad-hoc con url data: → 400', adhoc.status === 400);
check('Vendedor no puede asignar hoja de ruta a otro → 403', (await call('POST', '/roadmaps', { token: V, body: { date: '2026-10-15', userId: VEND2 } })).status === 403);
check('Otro vendedor no ve la hoja de ruta ajena → 403', (await call('GET', `/roadmaps/${roadmap2.data?.data?.id}`, { token: V2 })).status === 403);
check('Otro vendedor no puede pedir /roadmaps?userId=<otro> → 403', (await call('GET', `/roadmaps?userId=${SELLER}`, { token: V2 })).status === 403);
const badImage = await call('POST', '/products', { token: A, body: { name: 'X', imageUrl: 'javascript:alert(1)' } });
check('Producto con imagen javascript: → 400', badImage.status === 400);
const badAttachment = await call('POST', '/activities', { token: V, body: { companyId: company.id, description: 'x', attachments: [{ content: 'data:text/html;base64,PHNjcmlwdD4=' }] } });
check('Adjunto text/html → 400', badAttachment.status === 400, JSON.stringify(badAttachment.data));
const badCuit = await call('POST', '/companies', { token: V, body: { legalName: 'Test CUIT', cuit: '20-12345678-0' } });
check('Empresa nueva con CUIT inválido → 400', badCuit.status === 400);
const bulk = await call('PUT', `/companies/${company.id}`, { token: A, body: { id: 99999, createdAt: '2000-01-01', deletedAt: '2000-01-01' } });
check('Asignación masiva ignorada (id, fechas internas no cambian)', bulk.status === 200 && bulk.data.data.id === company.id && !bulk.data.data.deletedAt && !String(bulk.data.data.createdAt).startsWith('2000'), JSON.stringify(bulk.data).slice(0, 200));
check('Responsable inexistente → 400', (await call('PUT', `/companies/${company.id}`, { token: A, body: { createdById: 'hack' } })).status === 400);
const sellerChangesOwner = await call('PUT', `/companies/${company.id}`, { token: V, body: { createdById: SELLER } });
check('Vendedor no puede cambiar el responsable de una empresa', sellerChangesOwner.status === 403 || sellerChangesOwner.data?.data?.createdById !== SELLER || bulk.data.data.createdById === SELLER, JSON.stringify(sellerChangesOwner.data).slice(0, 150));
const sqlish = await call('GET', `/companies?q=${encodeURIComponent("' OR 1=1 -- ")}`, { token: A });
check('Búsqueda con comillas no rompe ni filtra de más', sqlish.status === 200 && sqlish.data.data.length === 0, sqlish.status);
const large = await call('POST', '/contacts', { token: A, raw: JSON.stringify({ fullName: 'x', notes: 'a'.repeat(16 * 1024 * 1024) }), headers: { 'Content-Type': 'application/json' } });
check('Cuerpo > límite → 413', large.status === 413, large.status);
const brokenJson = await call('POST', '/contacts', { token: A, raw: '{"a":', headers: { 'Content-Type': 'application/json' } });
check('JSON inválido → 400 sin stack', brokenJson.status === 400 && !JSON.stringify(brokenJson.data).includes('at '), JSON.stringify(brokenJson.data));

// ── 6. CUU01 Registrar actividad ──
const now = new Date(Date.now() - 3600000).toISOString();
const uuid = crypto.randomUUID();
const act = await call('POST', '/activities', { token: V, body: {
  contactType: 'visita', occurredAt: now, description: 'Visita de prueba', clientUuid: uuid,
  newOpportunity: { companyId: company.id, title: 'Oportunidad creada en línea' },
  task: { title: 'Enviar cotización', dueDate: '2026-10-20', dueTime: '10:00' },
  userId: ADMIN, // debe ignorarse: el autor es quien está logueado
} });
check('CUU01: actividad con oportunidad nueva y tarea → 201', act.status === 201 && act.data.createdOpportunity && act.data.taskId, JSON.stringify(act.data).slice(0, 300));
check('CUU01: el autor es el usuario del token', act.data?.data?.userId === SELLER);
const rep = await call('POST', '/activities', { token: V, body: { companyId: company.id, description: 'retry', clientUuid: uuid } });
check('CUU01: reenvío con el mismo clientUuid no duplica', rep.status === 200 && rep.data.duplicate && rep.data.data.id === act.data?.data?.id);
const future = await call('POST', '/activities', { token: V, body: { companyId: company.id, occurredAt: new Date(Date.now() + 86400000).toISOString() } });
check('CUU01: fecha futura → 400', future.status === 400);
const noOpp = await call('POST', '/activities', { token: V, body: { description: 'sin empresa' } });
check('CUU01: sin empresa ni oportunidad → 400', noOpp.status === 400);
const both = await call('POST', '/activities', { token: A, body: { serviceOrderId: 1, opportunityId: act.data?.data?.opportunityId } });
check('CUU01: oportunidad y orden a la vez → 400', both.status === 400);
const localTime = await call('POST', '/activities', { token: V, body: { companyId: company.id, occurredAt: '2026-10-09T14:00' } });
check('Hora sin zona se toma como Argentina (14:00 → 17:00Z)', localTime.data?.data?.occurredAt?.startsWith('2026-10-09T17:00'), localTime.data?.data?.occurredAt);
check('Otro vendedor no ve la actividad ajena → 403', (await call('GET', `/activities/${act.data?.data?.id}`, { token: V2 })).status === 403);
const listV2 = await call('GET', '/activities', { token: V2 });
check('Listado de actividades del vendedor: solo las propias', listV2.data.data.every((x) => x.userId === VEND2));
const opp = await call('GET', `/opportunities/${act.data?.data?.opportunityId}`, { token: V });
check('La oportunidad pasó a Contactado', opp.data?.data?.status === 'Contactado', opp.data?.data?.status);
check('Otro vendedor no ve la oportunidad ajena → 403', (await call('GET', `/opportunities/${act.data?.data?.opportunityId}`, { token: V2 })).status === 403);
check('Otro vendedor sí la ve para registrar actividad (forActivity)', (await call('GET', `/opportunities?companyId=${company.id}&forActivity=1`, { token: V2 })).data.data.some((o) => o.id === act.data?.data?.opportunityId));
check('Vendedor no puede reasignar la oportunidad → 403', (await call('PUT', `/opportunities/${act.data?.data?.opportunityId}`, { token: V, body: { userId: VEND2 } })).status === 403);

// ── 7. Tareas ──
const taskId = act.data?.taskId;
check('Otro vendedor no puede finalizar una tarea ajena → 403', (await call('PATCH', `/tasks/${taskId}/complete`, { token: V2 })).status === 403);
check('Finalizar por /status también exige permiso → 403', (await call('PATCH', `/tasks/${taskId}/status`, { token: V2, body: { status: 'Finalizada' } })).status === 403);
check('El asignado finaliza su tarea → 200', (await call('PATCH', `/tasks/${taskId}/complete`, { token: V })).status === 200);
check('Editar estado por PUT no está permitido → 400', (await call('PUT', `/tasks/${taskId}`, { token: V, body: { status: 'Pendiente' } })).status === 400);
const tasksV2 = await call('GET', '/tasks', { token: V2 });
check('Vendedor solo ve tareas asignadas o creadas por él', tasksV2.data.data.every((t) => t.assigneeIds.includes(VEND2) || t.createdById === VEND2));

// ── 8. Objetivos (CUU02) ──
const obj = { userId: SELLER, objectiveType: 'visitas', targetAmount: 10, startDate: '2026-11-02', periodType: 'semanal', companyIds: [company.id] };
const o1 = await call('POST', '/objectives', { token: A, body: obj });
check('CUU02: objetivo creado → 201 con avance calculado', o1.status === 201 && typeof o1.data.data.progress === 'number', JSON.stringify(o1.data).slice(0, 300));
const o2 = await call('POST', '/objectives', { token: A, body: obj });
check('CUU02: objetivo superpuesto → 409 con el existente', o2.status === 409 && o2.data.existing, JSON.stringify(o2.data));
check('CUU02: forzar → 201', (await call('POST', '/objectives', { token: A, body: { ...obj, force: true } })).status === 201);
check('Objetivo de vendedor inactivo → 400', (await call('POST', '/objectives', { token: A, body: { ...obj, userId: INACTIVO, force: true } })).status === 400);

// ── 9. Notificaciones ──
const notifs = await call('GET', '/notifications', { token: V });
check('El vendedor recibió la notificación del objetivo', notifs.data?.data?.some((n) => n.type === 'objetivo'));
check('Las notificaciones son por usuario', (await call('GET', '/notifications', { token: V2 })).data.data.every((n) => n.userId === VEND2));

// ── 10. Órdenes y técnicos ──
const noTechnician = await call('POST', '/service-orders', { token: A, body: { orderNumber: `T-${Date.now()}`, companyId: company.id, technicianIds: [2] } });
check('Solo empleados con rol técnico en la orden → 400', noTechnician.status === 400, JSON.stringify(noTechnician.data));
const os = await call('POST', '/service-orders', { token: A, body: { orderNumber: `T-${Date.now()}`, companyId: company.id, technicianIds: [1], scheduledDate: '2026-10-01' } });
check('Orden con técnico válido → 201', os.status === 201, JSON.stringify(os.data).slice(0, 200));
const sup = (await call('GET', '/employees?role=tecnico,supervisor&active=1', { token: A })).data?.data?.find((e) => e.role === 'supervisor');
const osSup = sup && await call('POST', '/service-orders', { token: A, body: { orderNumber: `S-${Date.now()}`, companyId: company.id, technicianIds: [sup.id] } });
check('Un supervisor también puede ejecutar la orden → 201', osSup?.status === 201, JSON.stringify(osSup?.data || 'sin supervisor activo').slice(0, 200));
const ev = await call('POST', `/service-orders/${os.data?.data?.id}/evaluation`, { token: A, body: { result: 'Sin insectos vivos', customerSatisfaction: 5, customerSignature: 'javascript:alert(1)' } });
check('Firma que no es imagen → 400', ev.status === 400);
const ev2 = await call('POST', `/service-orders/${os.data?.data?.id}/evaluation`, { token: A, body: { result: 'Sin insectos vivos', customerSatisfaction: 5, evaluationDate: '2026-10-01' } });
check('Evaluación con satisfacción → orden Completada', ev2.status === 200 && ev2.data.data.status === 'Completada', JSON.stringify(ev2.data).slice(0, 200));
const tab = await call('GET', `/companies/${company.id}/dashboard`, { token: V });
check('CUU06: tablero de la empresa (vendedor) → 200 con indicadores', tab.status === 200 && tab.data.data.completedOrders >= 1 && tab.data.data.averageSatisfaction === 5, JSON.stringify(tab.data).slice(0, 300));

// ── 11. Contactos por id y por DNI ──
const c = await call('POST', '/contacts', { token: V, body: { fullName: 'Contacto Prueba', nationalId: '30111222', companyId: company.id, phone: '341 555-0000' } });
check('Contacto creado con id numérico', c.status === 201 && Number.isInteger(c.data.data.id));
check('GET /contacts/:dni encuentra el contacto', (await call('GET', '/contacts/30111222', { token: V })).data?.data?.id === c.data.data.id);
check('Vendedor no puede dar de baja contactos → 403', (await call('DELETE', `/contacts/${c.data.data.id}`, { token: V })).status === 403);

// ── 11b. Contacto de la tarea (P-7) ──
const tc = await call('POST', '/tasks', { token: V, body: { title: 'Llamar al contacto', dueDate: '2026-10-25', contactId: c.data.data.id } });
check('P-7: tarea con contactId → 201 y toma la empresa del contacto', tc.status === 201 && tc.data.data.contactId === c.data.data.id && tc.data.data.companyId === company.id && tc.data.data.contact === 'Contacto Prueba', JSON.stringify(tc.data).slice(0, 300));
check('P-7: la tarea devuelve el teléfono del contacto', tc.data?.data?.contactDetails?.phones?.length === 1, JSON.stringify(tc.data?.data?.contactDetails));
const otherCompany = companies.find((e) => e.id !== company.id);
check('P-7: contacto de otra empresa → 400', (await call('POST', '/tasks', { token: V, body: { title: 'x', companyId: otherCompany.id, contactId: c.data.data.id } })).status === 400);
const tText = await call('POST', '/tasks', { token: V, body: { title: 'x', companyId: company.id, contact: 'Persona No Cargada' } });
check('P-7: contacto escrito que no existe → queda en notas, sin vínculo', tText.status === 201 && !tText.data.data.contactId && tText.data.data.notes.includes('Persona No Cargada'), JSON.stringify(tText.data).slice(0, 200));
const tChange = await call('PUT', `/tasks/${tc.data?.data?.id}`, { token: V, body: { companyId: otherCompany.id } });
check('P-7: al cambiar la empresa, se desvincula el contacto de la otra', tChange.status === 200 && tChange.data.data.contactId === null, JSON.stringify(tChange.data).slice(0, 200));

// ── 11c. Bajas: el vendedor solo da de baja lo que creó él (P-3) ──
const oppV = act.data?.data?.opportunityId; // creada por V en el punto 6
check('P-3: otro vendedor no da de baja la oportunidad ajena → 403', (await call('DELETE', `/opportunities/${oppV}`, { token: V2 })).status === 403);
const actV2 = await call('POST', '/activities', { token: V2, body: { opportunityId: oppV, description: 'Visita de otro vendedor (P-4)' } });
check('P-4: otro vendedor registra actividad en una oportunidad ajena → 201', actV2.status === 201, JSON.stringify(actV2.data).slice(0, 200));
check('P-3: no se da de baja una oportunidad con actividades de otros → 403', (await call('DELETE', `/opportunities/${oppV}`, { token: V })).status === 403);
check('P-3: otro vendedor no borra la actividad ajena → 403', (await call('DELETE', `/activities/${act.data?.data?.id}`, { token: V2 })).status === 403);
const oppAdmin = await call('POST', '/opportunities', { token: A, body: { title: 'Asignada por admin', companyId: company.id, userId: SELLER } });
check('P-3: el responsable no da de baja una oportunidad que cargó la administración → 403', oppAdmin.status === 201 && (await call('DELETE', `/opportunities/${oppAdmin.data.data.id}`, { token: V })).status === 403);
const ownOpp = await call('POST', '/opportunities', { token: V, body: { title: 'Propia', companyId: company.id } });
check('P-3: el vendedor da de baja la oportunidad que cargó → 200', ownOpp.data?.data?.createdById === SELLER && (await call('DELETE', `/opportunities/${ownOpp.data.data.id}`, { token: V })).status === 200);
const tShared = await call('POST', '/tasks', { token: V, body: { title: 'Compartida', dueDate: '2026-10-25', assigneeIds: [SELLER, VEND2] } });
check('P-3: el asignado no borra una tarea que no creó → 403', (await call('DELETE', `/tasks/${tShared.data?.data?.id}`, { token: V2 })).status === 403);
check('P-3: quien la creó sí → 200', (await call('DELETE', `/tasks/${tShared.data?.data?.id}`, { token: V })).status === 200);
check('P-3: la actividad propia se borra → 200', (await call('DELETE', `/activities/${actV2.data?.data?.id}`, { token: V2 })).status === 200);

// ── 12. Cabeceras y CORS ──
const hd = await call('GET', '/api/health', { headers: { Origin: 'https://sitio-malicioso.example' } });
check('CORS no habilita orígenes desconocidos', !hd.headers.get('access-control-allow-origin'));
const hdOk = await call('GET', '/api/health', { headers: { Origin: 'http://localhost:5173' } });
check('CORS habilita el frontend configurado', hdOk.headers.get('access-control-allow-origin') === 'http://localhost:5173');
check('Cabecera X-Content-Type-Options', hd.headers.get('x-content-type-options') === 'nosniff');
check('Sin X-Powered-By', !hd.headers.get('x-powered-by'));
const e404 = await call('GET', '/no-existe', { token: A });
check('Ruta inexistente → 404 JSON', e404.status === 404 && e404.data?.code === 'NOT_FOUND');

// ── 13. Listados de la administración (humo) ──
for (const path of ['/companies', '/contacts', '/users', '/opportunities', '/activities', '/tasks', '/roadmaps', '/objectives', '/promotions', '/service-orders', '/employees?role=tecnico', '/dashboard', '/products', '/services', '/product-lines', '/localities?q=ros', '/provinces', '/internal-notes', '/notifications', '/crops', `/companies/${company.id}/tree`]) {
  const r = await call('GET', path, { token: A });
  check(`Admin GET ${path} → 200`, r.status === 200, `${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
}

// ── 14. Cambio de contraseña invalida las sesiones anteriores ──
// P-6: regla estricta en el servidor (igual que en las pantallas).
for (const weak of ['123', 'clave-prueba-123', 'NuevaClave2026', 'nuevaclave-2026', 'NUEVA-CLAVE!!', 'Ab1!']) {
  check(`P-6: contraseña "${weak}" rechazada → 400`, (await call('POST', '/auth/change-password', { token: V2, body: { currentPassword: PW, newPassword: weak } })).status === 400);
}
check('P-6: alta de usuario con contraseña sin símbolo → 400', (await call('POST', '/users', { token: A, body: { idUser: 'prueba_pw', fullName: 'Prueba', email: 'p@x.com', password: 'Clave12345', role: 'vendedor' } })).status === 400);
const change = await call('POST', '/auth/change-password', { token: V2, body: { currentPassword: PW, newPassword: 'NuevaClave2026!' } });
check('Cambio de contraseña → 200 con token nuevo', change.status === 200 && change.data?.token);
check('El token anterior queda inválido → 401', (await call('GET', '/auth/me', { token: V2 })).status === 401);
check('El token nuevo funciona', (await call('GET', '/auth/me', { token: change.data?.token })).status === 200);
check('Contraseña débil rechazada → 400', (await call('POST', '/auth/change-password', { token: change.data?.token, body: { currentPassword: 'NuevaClave2026!', newPassword: '123' } })).status === 400);

// ── 14b. Duración de la sesión (P-5) ──
const exp = (t) => { const j = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()); return (j.exp - j.iat) / 3600; };
const short = await login(ADMIN);
const long = await call('POST', '/auth/login', { body: { idUser: ADMIN, password: PW, rememberMe: true } });
check('P-5: sesión normal de 8 h', exp(short.data.token) === 8, exp(short.data.token));
check('P-5: "Mantener la sesión" dura 3 días', exp(long.data.token) === 72, exp(long.data.token));

// ── 15. Límite de intentos de login (al final: bloquea al usuario 15 min) ──
let last;
for (let i = 0; i < 6; i++) last = await login(VEND2, 'incorrecta-123');
check('Sexto intento fallido seguido → 429', last.status === 429, last.status);
check('Bloqueado incluso con la contraseña correcta', (await login(VEND2)).status === 429);

console.log(results.join('\n'));
console.log(`\n${ok} OK, ${fail} con fallas`);
process.exit(fail ? 1 : 0);
