// Rutas de la API v2. Cada recurso tiene su ruta canónica en español y, mientras
// queden pantallas sin migrar, los alias heredados de la v1 (en inglés).
// La autenticación se aplica globalmente (authenticateAll en server.js); acá se
// agregan los permisos por rol. Las reglas de propiedad (un vendedor solo ve lo
// suyo) están en cada controlador.
import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth.middleware.js';
import { loginLimiterPorIp, loginLimiterPorUsuario } from '../middlewares/security.middleware.js';
import * as usuarios from '../controllers/usuario.controller.js';
import * as territorio from '../controllers/territorio.controller.js';
import * as empresas from '../controllers/empresa.controller.js';
import * as contactos from '../controllers/contacto.controller.js';
import * as catalogo from '../controllers/catalogo.controller.js';
import * as oportunidades from '../controllers/oportunidad.controller.js';
import * as actividades from '../controllers/actividad.controller.js';
import * as tareas from '../controllers/tarea.controller.js';
import * as hojas from '../controllers/hojaRuta.controller.js';
import * as objetivos from '../controllers/objetivo.controller.js';
import * as promociones from '../controllers/promocion.controller.js';
import * as notas from '../controllers/notaInterna.controller.js';
import * as notificaciones from '../controllers/notificacion.controller.js';
import * as empleados from '../controllers/empleado.controller.js';
import * as ordenes from '../controllers/ordenServicio.controller.js';
import * as dashboard from '../controllers/dashboard.controller.js';

const router = Router();
const admin = requireAdmin;

// Registra el mismo handler en varias rutas (canónica + alias v1).
const on = (method, paths, ...handlers) => {
  for (const p of [].concat(paths)) router[method](p, ...handlers);
};

// ── Autenticación y usuarios ──
on('post', ['/auth/login', '/users/login'], loginLimiterPorIp, loginLimiterPorUsuario, usuarios.login);
on('get', '/auth/me', usuarios.me);
on('post', '/auth/cambiar-password', usuarios.cambiarPassword);

on('get', ['/usuarios', '/users'], usuarios.listar);
on('post', ['/usuarios', '/users'], admin, usuarios.crear);
on('get', ['/usuarios/:idUser', '/users/:idUser'], usuarios.obtener);
on('put', ['/usuarios/:idUser', '/users/:idUser'], usuarios.actualizar); // propio o admin (controlador)
on('delete', ['/usuarios/:idUser', '/users/:idUser'], admin, usuarios.eliminar);
on('get', ['/usuarios/:idUser/imagen', '/users/:idUser/profile-image'], usuarios.obtenerImagen);
on('put', ['/usuarios/:idUser/imagen', '/users/:idUser/profile-image'], usuarios.actualizarImagen);
on('get', '/usuarios/:idUser/zona', usuarios.obtenerZona);
on('put', '/usuarios/:idUser/zona', admin, usuarios.actualizarZona);

// ── Territorio ──
on('get', '/provincias', territorio.listarProvincias);
on('get', '/localidades', territorio.listarLocalidades);
on('get', '/localidades/:id', territorio.obtenerLocalidad);
on('post', '/localidades', admin, territorio.crearLocalidad);
on('put', '/localidades/:id', admin, territorio.actualizarLocalidad);
on('delete', '/localidades/:id', admin, territorio.eliminarLocalidad);

// ── Empresas y contactos ──
on('get', ['/empresas', '/clientCompany'], empresas.listar);
on('post', ['/empresas', '/clientCompany'], empresas.crear);
on('get', ['/empresas/:id/arbol', '/clientCompany/:id/tree'], empresas.arbol);
on('get', '/empresas/:id/tablero', empresas.tablero);
on('post', '/empresas/:id/restaurar', admin, empresas.restaurar);
on('get', ['/empresas/:id', '/clientCompany/:id'], empresas.obtener);
on('put', ['/empresas/:id', '/clientCompany/:id'], empresas.actualizar);
on('delete', ['/empresas/:id', '/clientCompany/:id'], admin, empresas.eliminar);
on('get', '/cultivos', empresas.listarCultivos);
on('post', '/cultivos', admin, empresas.crearCultivo);

on('get', ['/contactos', '/clientes'], contactos.listar);
on('post', ['/contactos', '/clientes'], contactos.crear);
on('post', '/contactos/:id/restaurar', admin, contactos.restaurar);
on('get', ['/contactos/:id', '/clientes/:id'], contactos.obtener);
on('put', ['/contactos/:id', '/clientes/:id'], contactos.actualizar);
on('delete', ['/contactos/:id', '/clientes/:id'], admin, contactos.eliminar);

// ── Catálogo ──
on('get', ['/lineas-producto', '/lineaProds'], catalogo.listarLineas);
on('get', ['/lineas-producto/:id', '/lineaProds/:id'], catalogo.obtenerLinea);
on('post', ['/lineas-producto', '/lineaProds'], admin, catalogo.crearLinea);
on('put', ['/lineas-producto/:id', '/lineaProds/:id'], admin, catalogo.actualizarLinea);
on('delete', ['/lineas-producto/:id', '/lineaProds/:id'], admin, catalogo.eliminarLinea);
on('get', '/catalogo', catalogo.listarItems);
on('get', '/productos', catalogo.listarItems); // la pantalla de productos muestra ambos tipos
on('get', '/servicios', catalogo.listarServicios);
on('get', ['/catalogo/:id', '/productos/:id', '/servicios/:id'], catalogo.obtenerItem);
on('post', ['/catalogo', '/productos'], admin, catalogo.crearItem);
on('post', '/servicios', admin, catalogo.crearServicio);
on('put', ['/catalogo/:id', '/productos/:id', '/servicios/:id'], admin, catalogo.actualizarItem);
on('delete', ['/catalogo/:id', '/productos/:id', '/servicios/:id'], admin, catalogo.eliminarItem);

// ── Gestión comercial ──
on('get', ['/oportunidades', '/opportunities'], oportunidades.listar);
on('post', ['/oportunidades', '/opportunities'], oportunidades.crear);
on('post', '/oportunidades/:id/restaurar', admin, oportunidades.restaurar);
on('get', ['/oportunidades/:id', '/opportunities/:id'], oportunidades.obtener);
on('put', ['/oportunidades/:id', '/opportunities/:id'], oportunidades.actualizar);
on('delete', ['/oportunidades/:id', '/opportunities/:id'], oportunidades.eliminar);

on('get', ['/actividades', '/formulario-actividad', '/formularios-actividad', '/activities'], actividades.listar);
on('post', ['/actividades', '/formulario-actividad', '/formularios-actividad', '/activities'], actividades.crear);
on('get', ['/actividades/:id', '/formulario-actividad/:id', '/formularios-actividad/:id'], actividades.obtener);
on('put', ['/actividades/:id', '/formulario-actividad/:id', '/formularios-actividad/:id'], actividades.actualizar);
on('delete', ['/actividades/:id', '/formulario-actividad/:id', '/formularios-actividad/:id'], actividades.eliminar);
on('get', '/adjuntos/:id', actividades.obtenerAdjunto);

on('get', ['/tareas', '/tasks'], tareas.listar);
on('post', ['/tareas', '/tasks'], tareas.crear);
on('get', ['/tareas/:id', '/tasks/:id'], tareas.obtener);
on('put', ['/tareas/:id', '/tasks/:id'], tareas.actualizar);
on('patch', ['/tareas/:id/finalizar', '/tasks/:id/finalizar'], tareas.finalizar);
on('patch', ['/tareas/:id/estado', '/tasks/:id/status'], tareas.cambiarEstado);
on('delete', ['/tareas/:id', '/tasks/:id'], tareas.eliminar);

// ── Planificación ──
on('get', ['/hojas-ruta', '/roadmaps'], hojas.listar);
on('get', ['/roadmaps/user/:idUser', '/roadmaps/seller/:sellerId'], hojas.listar);
on('post', ['/hojas-ruta', '/roadmaps'], hojas.crear);
on('patch', ['/paradas/:id', '/roadmaps/stops/:stopId/status'], hojas.actualizarParada);
on('get', ['/hojas-ruta/:id', '/roadmaps/:id'], hojas.obtener);
on('put', '/hojas-ruta/:id', hojas.actualizar);
on('put', ['/hojas-ruta/:id/iniciar', '/roadmaps/:id/start'], hojas.iniciar);
on('put', ['/hojas-ruta/:id/finalizar', '/roadmaps/:id/end'], hojas.finalizar);
on('post', ['/hojas-ruta/:id/paradas', '/roadmaps/:id/stops'], hojas.agregarParada);
on('delete', ['/hojas-ruta/:id', '/roadmaps/:id'], hojas.eliminar);

on('get', ['/objetivos', '/objectives'], objetivos.listar);
on('get', '/objectives/seller/:sellerId', objetivos.listar);
on('get', '/objetivos/:id', objetivos.obtener);
on('post', ['/objetivos', '/objectives'], admin, objetivos.crear);
on('put', ['/objetivos/:id', '/objectives/:id'], admin, objetivos.actualizar);
on('patch', ['/objetivos/:id', '/objectives/:id'], admin, objetivos.actualizar);
on('delete', ['/objetivos/:id', '/objectives/:id'], admin, objetivos.eliminar);

on('get', ['/promociones', '/promotions'], promociones.listar);
on('get', '/promociones/:id', promociones.obtener);
on('post', ['/promociones', '/promotions'], admin, promociones.crear);
on('put', ['/promociones/:id', '/promotions/:id'], admin, promociones.actualizar);
on('delete', ['/promociones/:id', '/promotions/:id'], admin, promociones.eliminar);

on('get', ['/notas-internas', '/internal-notes'], admin, notas.listar);
on('post', ['/notas-internas', '/internal-notes'], admin, notas.crear);
on('put', '/notas-internas/:id', admin, notas.actualizar);
on('delete', '/notas-internas/:id', admin, notas.eliminar);

on('get', '/notificaciones', notificaciones.listar);
on('patch', '/notificaciones/leidas', notificaciones.marcarTodasLeidas);
on('patch', '/notificaciones/:id/leida', notificaciones.marcarLeida);
on('delete', '/notificaciones/leidas', notificaciones.limpiarLeidas);

// ── Servicios de control de plagas (administración) ──
on('get', '/empleados', admin, empleados.listar);
on('get', '/empleados/:id', admin, empleados.obtener);
on('post', '/empleados', admin, empleados.crear);
on('put', '/empleados/:id', admin, empleados.actualizar);
on('delete', '/empleados/:id', admin, empleados.eliminar);

on('get', '/ordenes-servicio', admin, ordenes.listar);
on('get', '/ordenes-servicio/:id', admin, ordenes.obtener);
on('post', '/ordenes-servicio', admin, ordenes.crear);
on('put', '/ordenes-servicio/:id', admin, ordenes.actualizar);
on('post', '/ordenes-servicio/:id/evaluacion', admin, ordenes.guardarEvaluacion);
on('post', '/ordenes-servicio/:id/restaurar', admin, ordenes.restaurar);
on('delete', '/ordenes-servicio/:id', admin, ordenes.eliminar);

// ── Tablero general ──
on('get', ['/dashboard', '/tablero'], admin, dashboard.general);

export default router;
