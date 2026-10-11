#!/usr/bin/env node
// Pruebas de seguridad y de reglas de negocio contra una API levantada con una
// base de PRUEBA (nunca contra producción: crea y modifica registros).
//   API_URL=http://localhost:3100 TEST_PASSWORD=... node scripts/security-tests.mjs
const API = process.env.API_URL || 'http://localhost:3100';
const PW = process.env.TEST_PASSWORD || 'clave-prueba-123';
const ADMIN = process.env.TEST_ADMIN || 'Admin';
const VEND = process.env.TEST_VEND || 'Vend';
const VEND2 = process.env.TEST_VEND2 || 'Agustin_agroros';
const INACTIVO = process.env.TEST_INACTIVO || 'Baja_agroros';

let ok = 0;
let fail = 0;
const resultados = [];
const check = (nombre, cond, detalle = '') => {
  if (cond) ok++; else fail++;
  resultados.push(`${cond ? '✔' : '✘'} ${nombre}${!cond && detalle ? `  → ${detalle}` : ''}`);
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
for (const p of ['/empresas', '/contactos', '/usuarios', '/oportunidades', '/actividades', '/tareas', '/hojas-ruta', '/objetivos', '/promociones', '/ordenes-servicio', '/empleados', '/dashboard', '/productos', '/localidades', '/clientCompany', '/users', '/tasks', '/roadmaps', '/formulario-actividad']) {
  const r = await call('GET', p);
  check(`GET ${p} sin token → 401`, r.status === 401, r.status);
}
check('POST /usuarios sin token → 401', (await call('POST', '/usuarios', { body: { idUser: 'x' } })).status === 401);
check('GET /dashboard (antes público) sin token → 401', (await call('GET', '/dashboard')).status === 401);

// ── 2. Login ──
const a = await login(ADMIN);
check('Login admin → 200 con token', a.status === 200 && a.data?.token, JSON.stringify(a.data));
const v = await login(VEND);
check('Login vendedor → 200', v.status === 200 && v.data?.token);
const v2 = await login(VEND2);
const A = a.data?.token;
const V = v.data?.token;
const V2 = v2.data?.token;
check('La respuesta de login no incluye el hash', !JSON.stringify(a.data).includes('$2'));
const malo = await login(ADMIN, 'incorrecta-123');
const inexistente = await login('no_existe_xyz', 'incorrecta-123');
check('Contraseña incorrecta → 401', malo.status === 401);
check('Usuario inexistente → mismo 401 y mismo mensaje', inexistente.status === 401 && inexistente.data?.message === malo.data?.message);
const baja = await login(INACTIVO);
check('Usuario inactivo → 403 sin token', baja.status === 403 && !baja.data?.token);

// ── 3. Tokens manipulados ──
const [h, p] = A.split('.');
const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
const falsoAdmin = `${h}.${Buffer.from(JSON.stringify({ ...payload, sub: VEND })).toString('base64url')}.${A.split('.')[2]}`;
check('Token con payload alterado → 401', (await call('GET', '/usuarios', { token: falsoAdmin })).status === 401);
const sinFirma = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${p}.`;
check('Token alg=none → 401', (await call('GET', '/usuarios', { token: sinFirma })).status === 401);
check('Token basura → 401', (await call('GET', '/usuarios', { token: 'abc.def.ghi' })).status === 401);

// ── 4. Permisos por rol (vendedor) ──
const soloAdmin = [
  ['POST', '/usuarios', { idUser: 'hack', nombreApellido: 'x', password: 'abcdefg123', rol: 'administrador' }],
  ['DELETE', '/usuarios/Admin'],
  ['DELETE', '/empresas/1'],
  ['GET', '/ordenes-servicio'],
  ['GET', '/empleados'],
  ['GET', '/dashboard'],
  ['GET', '/notas-internas'],
  ['POST', '/objetivos', { usuarioId: VEND, tipoObjetivo: 'visitas', cantidadMeta: 1, fechaInicio: '2026-10-12' }],
  ['POST', '/promociones', { nombre: 'x', fechaInicio: '2026-10-01', fechaFin: '2026-10-30' }],
  ['POST', '/productos', { nombre: 'x' }],
  ['PUT', '/usuarios/Vend/zona', { localidadIds: [] }],
];
for (const [m, path, body] of soloAdmin) {
  const r = await call(m, path, { token: V, body });
  check(`Vendedor ${m} ${path} → 403 FORBIDDEN_ACTION`, r.status === 403 && r.data?.code === 'FORBIDDEN_ACTION', `${r.status} ${JSON.stringify(r.data)}`);
}
const usuariosV = await call('GET', '/usuarios', { token: V });
check('Vendedor ve lista mínima de usuarios (sin email ni estado)', usuariosV.status === 200 && usuariosV.data.data.every((u) => !u.email && u.estadoCuenta === undefined), JSON.stringify(usuariosV.data?.data?.[0]));
const autoAscenso = await call('PUT', `/usuarios/${VEND}`, { token: V, body: { rol: 'administrador', role: 'admin', estadoCuenta: 'Activo' } });
const yo = await call('GET', '/auth/me', { token: V });
check('Vendedor no puede cambiarse el rol', yo.data?.data?.rol === 'vendedor', `${autoAscenso.status} ${JSON.stringify(yo.data)}`);
check('Vendedor no puede editar a otro usuario → 403', (await call('PUT', `/usuarios/${ADMIN}`, { token: V, body: { nombreApellido: 'x' } })).status === 403);

// ── 5. Validación de entradas peligrosas ──
const empresas = (await call('GET', '/empresas', { token: A })).data.data;
const emp = empresas[0];
const hoja = await call('POST', '/hojas-ruta', { token: V, body: { fecha: '2026-10-15', nombre: 'Prueba', paradas: [{ nombreLugar: 'X', url: 'javascript:alert(1)' }] } });
check('Parada con url javascript: → 400', hoja.status === 400, hoja.status);
const hoja2 = await call('POST', '/hojas-ruta', { token: V, body: { fecha: '2026-10-15', nombre: 'Prueba', paradas: [{ nombreLugar: 'X', empresaId: emp.id, url: 'https://maps.google.com/?q=1' }] } });
check('Hoja de ruta propia con url https → 201', hoja2.status === 201, JSON.stringify(hoja2.data));
const adhoc = await call('POST', `/hojas-ruta/${hoja2.data?.data?.id}/paradas`, { token: V, body: { texto: '<img src=x onerror=alert(1)>', url: 'data:text/html,<script>alert(1)</script>' } });
check('Parada ad-hoc con url data: → 400', adhoc.status === 400);
check('Vendedor no puede asignar hoja de ruta a otro → 403', (await call('POST', '/hojas-ruta', { token: V, body: { fecha: '2026-10-15', usuarioId: VEND2 } })).status === 403);
check('Otro vendedor no ve la hoja de ruta ajena → 403', (await call('GET', `/hojas-ruta/${hoja2.data?.data?.id}`, { token: V2 })).status === 403);
check('Otro vendedor no puede pedir /roadmaps/user/<otro> → 403', (await call('GET', `/roadmaps/user/${VEND}`, { token: V2 })).status === 403);
const imgMala = await call('POST', '/productos', { token: A, body: { nombre: 'X', imagenUrl: 'javascript:alert(1)' } });
check('Producto con imagen javascript: → 400', imgMala.status === 400);
const adjMalo = await call('POST', '/actividades', { token: V, body: { empresaId: emp.id, descripcion: 'x', adjuntos: [{ contenido: 'data:text/html;base64,PHNjcmlwdD4=' }] } });
check('Adjunto text/html → 400', adjMalo.status === 400, JSON.stringify(adjMalo.data));
const cuitMalo = await call('POST', '/empresas', { token: V, body: { razonSocial: 'Test CUIT', cuit: '20-12345678-0' } });
check('Empresa nueva con CUIT inválido → 400', cuitMalo.status === 400);
const masivo = await call('PUT', `/empresas/${emp.id}`, { token: A, body: { id: 99999, fechaRegistro: '2000-01-01', fechaBaja: '2000-01-01' } });
check('Asignación masiva ignorada (id, fechas internas no cambian)', masivo.status === 200 && masivo.data.data.id === emp.id && !masivo.data.data.fechaBaja && !String(masivo.data.data.fechaRegistro).startsWith('2000'), JSON.stringify(masivo.data).slice(0, 200));
check('Responsable inexistente → 400', (await call('PUT', `/empresas/${emp.id}`, { token: A, body: { creadoPorId: 'hack' } })).status === 400);
const vendCambiaDueño = await call('PUT', `/empresas/${emp.id}`, { token: V, body: { creadoPorId: VEND } });
check('Vendedor no puede cambiar el responsable de una empresa', vendCambiaDueño.status === 403 || vendCambiaDueño.data?.data?.creadoPorId !== VEND || masivo.data.data.creadoPorId === VEND, JSON.stringify(vendCambiaDueño.data).slice(0, 150));
const sqlish = await call('GET', `/empresas?q=${encodeURIComponent("' OR 1=1 -- ")}`, { token: A });
check('Búsqueda con comillas no rompe ni filtra de más', sqlish.status === 200 && sqlish.data.data.length === 0, sqlish.status);
const grande = await call('POST', '/contactos', { token: A, raw: JSON.stringify({ nombreApellido: 'x', observaciones: 'a'.repeat(16 * 1024 * 1024) }), headers: { 'Content-Type': 'application/json' } });
check('Cuerpo > límite → 413', grande.status === 413, grande.status);
const jsonRoto = await call('POST', '/contactos', { token: A, raw: '{"a":', headers: { 'Content-Type': 'application/json' } });
check('JSON inválido → 400 sin stack', jsonRoto.status === 400 && !JSON.stringify(jsonRoto.data).includes('at '), JSON.stringify(jsonRoto.data));

// ── 6. CUU01 Registrar actividad ──
const ahora = new Date(Date.now() - 3600000).toISOString();
const uuid = crypto.randomUUID();
const act = await call('POST', '/actividades', { token: V, body: {
  tipoContacto: 'visita', fechaHora: ahora, descripcion: 'Visita de prueba', clientUuid: uuid,
  nuevaOportunidad: { empresaId: emp.id, titulo: 'Oportunidad creada en línea' },
  tarea: { titulo: 'Enviar cotización', fechaVencimiento: '2026-10-20', horaVencimiento: '10:00' },
  usuarioId: ADMIN, // debe ignorarse: el autor es quien está logueado
} });
check('CUU01: actividad con oportunidad nueva y tarea → 201', act.status === 201 && act.data.oportunidadCreada && act.data.tareaId, JSON.stringify(act.data).slice(0, 300));
check('CUU01: el autor es el usuario del token', act.data?.data?.usuarioId === VEND);
const rep = await call('POST', '/actividades', { token: V, body: { empresaId: emp.id, descripcion: 'reintento', clientUuid: uuid } });
check('CUU01: reenvío con el mismo clientUuid no duplica', rep.status === 200 && rep.data.duplicada && rep.data.data.id === act.data?.data?.id);
const futura = await call('POST', '/actividades', { token: V, body: { empresaId: emp.id, fechaHora: new Date(Date.now() + 86400000).toISOString() } });
check('CUU01: fecha futura → 400', futura.status === 400);
const sinOpp = await call('POST', '/actividades', { token: V, body: { descripcion: 'sin empresa' } });
check('CUU01: sin empresa ni oportunidad → 400', sinOpp.status === 400);
const ambas = await call('POST', '/actividades', { token: A, body: { ordenServicioId: 1, oportunidadId: act.data?.data?.oportunidadId } });
check('CUU01: oportunidad y orden a la vez → 400', ambas.status === 400);
const horaLocal = await call('POST', '/actividades', { token: V, body: { empresaId: emp.id, fechaHora: '2026-10-09T14:00' } });
check('Hora sin zona se toma como Argentina (14:00 → 17:00Z)', horaLocal.data?.data?.fechaHora?.startsWith('2026-10-09T17:00'), horaLocal.data?.data?.fechaHora);
check('Otro vendedor no ve la actividad ajena → 403', (await call('GET', `/actividades/${act.data?.data?.id}`, { token: V2 })).status === 403);
const listaV2 = await call('GET', '/actividades', { token: V2 });
check('Listado de actividades del vendedor: solo las propias', listaV2.data.data.every((x) => x.usuarioId === VEND2));
const opp = await call('GET', `/oportunidades/${act.data?.data?.oportunidadId}`, { token: V });
check('La oportunidad pasó a Contactado', opp.data?.data?.estado === 'Contactado', opp.data?.data?.estado);
check('Otro vendedor no ve la oportunidad ajena → 403', (await call('GET', `/oportunidades/${act.data?.data?.oportunidadId}`, { token: V2 })).status === 403);
check('Otro vendedor sí la ve para registrar actividad (paraActividad)', (await call('GET', `/oportunidades?empresaId=${emp.id}&paraActividad=1`, { token: V2 })).data.data.some((o) => o.id === act.data?.data?.oportunidadId));
check('Vendedor no puede reasignar la oportunidad → 403', (await call('PUT', `/oportunidades/${act.data?.data?.oportunidadId}`, { token: V, body: { usuarioId: VEND2 } })).status === 403);

// ── 7. Tareas ──
const tareaId = act.data?.tareaId;
check('Otro vendedor no puede finalizar una tarea ajena → 403', (await call('PATCH', `/tareas/${tareaId}/finalizar`, { token: V2 })).status === 403);
check('Finalizar por /estado también exige permiso → 403', (await call('PATCH', `/tasks/${tareaId}/status`, { token: V2, body: { estado: 'Finalizada' } })).status === 403);
check('El asignado finaliza su tarea → 200', (await call('PATCH', `/tareas/${tareaId}/finalizar`, { token: V })).status === 200);
check('Editar estado por PUT no está permitido → 400', (await call('PUT', `/tareas/${tareaId}`, { token: V, body: { estado: 'Pendiente' } })).status === 400);
const tareasV2 = await call('GET', '/tareas', { token: V2 });
check('Vendedor solo ve tareas asignadas o creadas por él', tareasV2.data.data.every((t) => t.asignadosIds.includes(VEND2) || t.creadoPorId === VEND2));

// ── 8. Objetivos (CUU02) ──
const obj = { usuarioId: VEND, tipoObjetivo: 'visitas', cantidadMeta: 10, fechaInicio: '2026-11-02', tipoPeriodo: 'semanal', empresaIds: [emp.id] };
const o1 = await call('POST', '/objetivos', { token: A, body: obj });
check('CUU02: objetivo creado → 201 con avance calculado', o1.status === 201 && typeof o1.data.data.avance === 'number', JSON.stringify(o1.data).slice(0, 300));
const o2 = await call('POST', '/objetivos', { token: A, body: obj });
check('CUU02: objetivo superpuesto → 409 con el existente', o2.status === 409 && o2.data.existente, JSON.stringify(o2.data));
check('CUU02: forzar → 201', (await call('POST', '/objetivos', { token: A, body: { ...obj, forzar: true } })).status === 201);
check('Objetivo de vendedor inactivo → 400', (await call('POST', '/objetivos', { token: A, body: { ...obj, usuarioId: INACTIVO, forzar: true } })).status === 400);

// ── 9. Notificaciones ──
const notifs = await call('GET', '/notificaciones', { token: V });
check('El vendedor recibió la notificación del objetivo', notifs.data?.data?.some((n) => n.tipo === 'objetivo'));
check('Las notificaciones son por usuario', (await call('GET', '/notificaciones', { token: V2 })).data.data.every((n) => n.usuarioId === VEND2));

// ── 10. Órdenes y técnicos ──
const noTecnico = await call('POST', '/ordenes-servicio', { token: A, body: { numeroOrden: `T-${Date.now()}`, empresaId: emp.id, tecnicoIds: [2] } });
check('Solo empleados con rol técnico en la orden → 400', noTecnico.status === 400, JSON.stringify(noTecnico.data));
const os = await call('POST', '/ordenes-servicio', { token: A, body: { numeroOrden: `T-${Date.now()}`, empresaId: emp.id, tecnicoIds: [1], fechaProgramada: '2026-10-01' } });
check('Orden con técnico válido → 201', os.status === 201, JSON.stringify(os.data).slice(0, 200));
const sup = (await call('GET', '/empleados?rol=tecnico,supervisor&activos=1', { token: A })).data?.data?.find((e) => e.rol === 'supervisor');
const osSup = sup && await call('POST', '/ordenes-servicio', { token: A, body: { numeroOrden: `S-${Date.now()}`, empresaId: emp.id, tecnicoIds: [sup.id] } });
check('Un supervisor también puede ejecutar la orden → 201', osSup?.status === 201, JSON.stringify(osSup?.data || 'sin supervisor activo').slice(0, 200));
const ev = await call('POST', `/ordenes-servicio/${os.data?.data?.id}/evaluacion`, { token: A, body: { resultado: 'Sin insectos vivos', satisfaccionCliente: 5, firmaCliente: 'javascript:alert(1)' } });
check('Firma que no es imagen → 400', ev.status === 400);
const ev2 = await call('POST', `/ordenes-servicio/${os.data?.data?.id}/evaluacion`, { token: A, body: { resultado: 'Sin insectos vivos', satisfaccionCliente: 5, fechaEvaluacion: '2026-10-01' } });
check('Evaluación con satisfacción → orden Completada', ev2.status === 200 && ev2.data.data.estado === 'Completada', JSON.stringify(ev2.data).slice(0, 200));
const tab = await call('GET', `/empresas/${emp.id}/tablero`, { token: V });
check('CUU06: tablero de la empresa (vendedor) → 200 con indicadores', tab.status === 200 && tab.data.data.ordenesRealizadas >= 1 && tab.data.data.satisfaccionPromedio === 5, JSON.stringify(tab.data).slice(0, 300));

// ── 11. Contactos por id y por DNI (ruta heredada) ──
const c = await call('POST', '/contactos', { token: V, body: { nombreApellido: 'Contacto Prueba', dni: '30111222', empresaId: emp.id, telefono: '341 555-0000' } });
check('Contacto creado con id numérico', c.status === 201 && Number.isInteger(c.data.data.id));
check('GET /clientes/:dni (v1) encuentra el contacto', (await call('GET', '/clientes/30111222', { token: V })).data?.data?.id === c.data.data.id);
check('Vendedor no puede dar de baja contactos → 403', (await call('DELETE', `/contactos/${c.data.data.id}`, { token: V })).status === 403);

// ── 11b. Contacto de la tarea (P-7) ──
const tc = await call('POST', '/tareas', { token: V, body: { titulo: 'Llamar al contacto', fechaVencimiento: '2026-10-25', contactoId: c.data.data.id } });
check('P-7: tarea con contactoId → 201 y toma la empresa del contacto', tc.status === 201 && tc.data.data.contactoId === c.data.data.id && tc.data.data.empresaId === emp.id && tc.data.data.contacto === 'Contacto Prueba', JSON.stringify(tc.data).slice(0, 300));
check('P-7: la tarea devuelve el teléfono del contacto', tc.data?.data?.contactoDetalle?.telefonos?.length === 1, JSON.stringify(tc.data?.data?.contactoDetalle));
const otraEmp = empresas.find((e) => e.id !== emp.id);
check('P-7: contacto de otra empresa → 400', (await call('POST', '/tareas', { token: V, body: { titulo: 'x', empresaId: otraEmp.id, contactoId: c.data.data.id } })).status === 400);
const tTexto = await call('POST', '/tareas', { token: V, body: { titulo: 'x', empresaId: emp.id, contacto: 'Persona No Cargada' } });
check('P-7: contacto escrito que no existe → queda en notas, sin vínculo', tTexto.status === 201 && !tTexto.data.data.contactoId && tTexto.data.data.notas.includes('Persona No Cargada'), JSON.stringify(tTexto.data).slice(0, 200));
const tCambio = await call('PUT', `/tareas/${tc.data?.data?.id}`, { token: V, body: { empresaId: otraEmp.id } });
check('P-7: al cambiar la empresa, se desvincula el contacto de la otra', tCambio.status === 200 && tCambio.data.data.contactoId === null, JSON.stringify(tCambio.data).slice(0, 200));

// ── 11c. Bajas: el vendedor solo da de baja lo que creó él (P-3) ──
const oppV = act.data?.data?.oportunidadId; // creada por V en el punto 6
check('P-3: otro vendedor no da de baja la oportunidad ajena → 403', (await call('DELETE', `/oportunidades/${oppV}`, { token: V2 })).status === 403);
const actV2 = await call('POST', '/actividades', { token: V2, body: { oportunidadId: oppV, descripcion: 'Visita de otro vendedor (P-4)' } });
check('P-4: otro vendedor registra actividad en una oportunidad ajena → 201', actV2.status === 201, JSON.stringify(actV2.data).slice(0, 200));
check('P-3: no se da de baja una oportunidad con actividades de otros → 403', (await call('DELETE', `/oportunidades/${oppV}`, { token: V })).status === 403);
check('P-3: otro vendedor no borra la actividad ajena → 403', (await call('DELETE', `/actividades/${act.data?.data?.id}`, { token: V2 })).status === 403);
const oppAdmin = await call('POST', '/oportunidades', { token: A, body: { titulo: 'Asignada por admin', empresaId: emp.id, usuarioId: VEND } });
check('P-3: el responsable no da de baja una oportunidad que cargó la administración → 403', oppAdmin.status === 201 && (await call('DELETE', `/oportunidades/${oppAdmin.data.data.id}`, { token: V })).status === 403);
const oppPropia = await call('POST', '/oportunidades', { token: V, body: { titulo: 'Propia', empresaId: emp.id } });
check('P-3: el vendedor da de baja la oportunidad que cargó → 200', oppPropia.data?.data?.creadoPorId === VEND && (await call('DELETE', `/oportunidades/${oppPropia.data.data.id}`, { token: V })).status === 200);
const tCompartida = await call('POST', '/tareas', { token: V, body: { titulo: 'Compartida', fechaVencimiento: '2026-10-25', asignadosIds: [VEND, VEND2] } });
check('P-3: el asignado no borra una tarea que no creó → 403', (await call('DELETE', `/tareas/${tCompartida.data?.data?.id}`, { token: V2 })).status === 403);
check('P-3: quien la creó sí → 200', (await call('DELETE', `/tareas/${tCompartida.data?.data?.id}`, { token: V })).status === 200);
check('P-3: la actividad propia se borra → 200', (await call('DELETE', `/actividades/${actV2.data?.data?.id}`, { token: V2 })).status === 200);

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
for (const path of ['/empresas', '/contactos', '/usuarios', '/oportunidades', '/actividades', '/tareas', '/hojas-ruta', '/objetivos', '/promociones', '/ordenes-servicio', '/empleados?rol=tecnico', '/dashboard', '/productos', '/servicios', '/lineas-producto', '/localidades?q=ros', '/provincias', '/notas-internas', '/notificaciones', '/cultivos', `/empresas/${emp.id}/arbol`]) {
  const r = await call('GET', path, { token: A });
  check(`Admin GET ${path} → 200`, r.status === 200, `${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
}

// ── 14. Cambio de contraseña invalida las sesiones anteriores ──
// P-6: regla estricta en el servidor (igual que en las pantallas).
for (const debil of ['123', 'clave-prueba-123', 'NuevaClave2026', 'nuevaclave-2026', 'NUEVA-CLAVE!!', 'Ab1!']) {
  check(`P-6: contraseña "${debil}" rechazada → 400`, (await call('POST', '/auth/cambiar-password', { token: V2, body: { passwordActual: PW, passwordNueva: debil } })).status === 400);
}
check('P-6: alta de usuario con contraseña sin símbolo → 400', (await call('POST', '/usuarios', { token: A, body: { idUser: 'prueba_pw', nombreApellido: 'Prueba', email: 'p@x.com', password: 'Clave12345', rol: 'vendedor' } })).status === 400);
const cambio = await call('POST', '/auth/cambiar-password', { token: V2, body: { passwordActual: PW, passwordNueva: 'NuevaClave2026!' } });
check('Cambio de contraseña → 200 con token nuevo', cambio.status === 200 && cambio.data?.token);
check('El token anterior queda inválido → 401', (await call('GET', '/auth/me', { token: V2 })).status === 401);
check('El token nuevo funciona', (await call('GET', '/auth/me', { token: cambio.data?.token })).status === 200);
check('Contraseña débil rechazada → 400', (await call('POST', '/auth/cambiar-password', { token: cambio.data?.token, body: { passwordActual: 'NuevaClave2026!', passwordNueva: '123' } })).status === 400);

// ── 14b. Duración de la sesión (P-5) ──
const exp = (t) => { const j = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()); return (j.exp - j.iat) / 3600; };
const corta = await login(ADMIN);
const larga = await call('POST', '/auth/login', { body: { idUser: ADMIN, password: PW, mantenerSesion: true } });
check('P-5: sesión normal de 8 h', exp(corta.data.token) === 8, exp(corta.data.token));
check('P-5: "Mantener la sesión" dura 3 días', exp(larga.data.token) === 72, exp(larga.data.token));

// ── 15. Límite de intentos de login (al final: bloquea al usuario 15 min) ──
let ultimo;
for (let i = 0; i < 6; i++) ultimo = await login(VEND2, 'incorrecta-123');
check('Sexto intento fallido seguido → 429', ultimo.status === 429, ultimo.status);
check('Bloqueado incluso con la contraseña correcta', (await login(VEND2)).status === 429);

console.log(resultados.join('\n'));
console.log(`\n${ok} OK, ${fail} con fallas`);
process.exit(fail ? 1 : 0);
