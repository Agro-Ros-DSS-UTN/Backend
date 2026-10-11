import { Op } from 'sequelize';
import { LineaProducto, ItemCatalogo, OrdenServicio, ProductoAplicado } from '../models/index.js';
import { CATEGORIAS_LINEA, TIPOS_SERVICIO } from '../models/catalogo.model.js';
import { asyncHandler, badRequest, conflict, idParam, notFound, pick } from '../utils/http.js';
import { dataUrl, numero, requerido, texto, unoDe, urlHttp } from '../utils/validacion.js';

const SERVICIO_V1 = 'Servicio Agronómico';

// ── Líneas de producto ──
const categoriaDe = (nombre = '') => {
  const n = nombre.toLowerCase();
  if (n.includes('fumig') || n.includes('fosf')) return 'fumigante';
  if (n.includes('roden') || n.includes('cebo')) return 'rodenticida';
  if (n.includes('insect')) return 'insecticida';
  if (n.includes('fertil') || n.includes('foliar')) return 'fertilizante';
  return 'otro';
};

export const serializeLinea = (l) => {
  const j = typeof l.toJSON === 'function' ? l.toJSON() : l;
  return { ...j, nombreLinea: j.nombre, cantidadItems: j.cantidadItems !== undefined ? Number(j.cantidadItems) : undefined };
};

export const listarLineas = asyncHandler(async (req, res) => {
  const lineas = await LineaProducto.findAll({ order: [['nombre', 'ASC']] });
  res.json({ data: lineas.map(serializeLinea) });
});

export const obtenerLinea = asyncHandler(async (req, res) => {
  const l = await LineaProducto.findByPk(idParam(req), { include: [{ model: ItemCatalogo, as: 'items' }] });
  if (!l) throw notFound('Línea de producto');
  res.json({ data: serializeLinea(l) });
});

const datosLinea = (b) => {
  const d = pick({ ...b, nombre: b.nombre ?? b.nombreLinea ?? b.descripcion }, ['nombre', 'codigo', 'categoria']);
  if (d.nombre !== undefined) d.nombre = texto(d.nombre, 'nombre', 100);
  if (d.codigo !== undefined) d.codigo = texto(d.codigo, 'codigo', 30);
  if (d.categoria !== undefined) d.categoria = unoDe(d.categoria, CATEGORIAS_LINEA, 'categoria');
  return d;
};

export const crearLinea = asyncHandler(async (req, res) => {
  const d = datosLinea(req.body || {});
  requerido(d, ['nombre']);
  const l = await LineaProducto.create({ ...d, categoria: d.categoria || categoriaDe(d.nombre) });
  res.status(201).json({ message: 'Línea creada', data: serializeLinea(l) });
});

export const actualizarLinea = asyncHandler(async (req, res) => {
  const l = await LineaProducto.findByPk(idParam(req));
  if (!l) throw notFound('Línea de producto');
  await l.update(datosLinea(req.body || {}));
  res.json({ message: 'Línea actualizada', data: serializeLinea(l) });
});

export const eliminarLinea = asyncHandler(async (req, res) => {
  const l = await LineaProducto.findByPk(idParam(req));
  if (!l) throw notFound('Línea de producto');
  const usados = await ItemCatalogo.count({ where: { lineaId: l.id } });
  if (usados) throw conflict(`No se puede eliminar: ${usados} productos pertenecen a esta línea.`);
  await l.destroy();
  res.json({ message: 'Línea eliminada' });
});

// ── Ítems del catálogo (productos y servicios) ──
export const serializeItem = (i) => {
  if (!i) return null;
  const j = typeof i.toJSON === 'function' ? i.toJSON() : i;
  const precio = j.precioReferencia !== null && j.precioReferencia !== undefined ? Number(j.precioReferencia) : null;
  return {
    id: j.id,
    tipo: j.tipo,
    nombre: j.nombre,
    codigo: j.codigo ?? null,
    descripcion: j.descripcion ?? null,
    precioReferencia: precio,
    costoUnitario: j.costoUnitario !== null && j.costoUnitario !== undefined ? Number(j.costoUnitario) : null,
    frecuenciaFacturacion: j.frecuenciaFacturacion ?? null,
    stockDisponible: j.stockDisponible ?? null,
    activo: Boolean(j.activo),
    imagen: j.imagen ?? undefined,
    lineaId: j.lineaId ?? null,
    linea: j.linea ? { id: j.linea.id, nombre: j.linea.nombre, categoria: j.linea.categoria } : null,
    principioActivo: j.principioActivo ?? null,
    presentacion: j.presentacion ?? null,
    tipoServicio: j.tipoServicio ?? null,
    unidadMedida: j.unidadMedida ?? null,
    fechaAlta: j.fechaAlta,
    // compatibilidad v1 (pantalla de productos)
    ref: j.codigo ?? null,
    precioUnitario: precio ?? 0,
    costeUnidad: j.costoUnitario !== null && j.costoUnitario !== undefined ? Number(j.costoUnitario) : 0,
    imagenUrl: j.imagen ?? null,
    tipoProducto: j.tipo === 'servicio' ? SERVICIO_V1 : (j.linea?.nombre ?? null),
    tipoServicioNombre: j.tipo === 'servicio' ? j.nombre : undefined,
  };
};

const lineaPorNombre = async (nombre) => {
  if (!nombre) return null;
  const [l] = await LineaProducto.findOrCreate({ where: { nombre }, defaults: { nombre, categoria: categoriaDe(nombre) } });
  return l.id;
};

const datosItem = async (b, tipoForzado) => {
  const d = pick({
    ...b,
    codigo: b.codigo !== undefined ? b.codigo : b.ref,
    precioReferencia: b.precioReferencia !== undefined ? b.precioReferencia : b.precioUnitario,
    costoUnitario: b.costoUnitario !== undefined ? b.costoUnitario : b.costeUnidad,
    imagen: b.imagen !== undefined ? b.imagen : b.imagenUrl,
  }, ['tipo', 'nombre', 'codigo', 'descripcion', 'precioReferencia', 'costoUnitario', 'frecuenciaFacturacion', 'stockDisponible', 'activo', 'imagen', 'lineaId', 'principioActivo', 'presentacion', 'tipoServicio', 'unidadMedida']);
  if (tipoForzado) d.tipo = tipoForzado;
  // La pantalla v1 manda "tipoProducto": un servicio o el nombre de una línea.
  if (b.tipoProducto !== undefined && !tipoForzado) {
    if (/servicio/i.test(b.tipoProducto)) d.tipo = 'servicio';
    else {
      d.tipo = d.tipo || 'producto';
      if (d.lineaId === undefined) d.lineaId = await lineaPorNombre(texto(b.tipoProducto, 'tipoProducto', 100));
    }
  }
  if (d.tipo !== undefined) d.tipo = unoDe(d.tipo, ['producto', 'servicio'], 'tipo');
  if (d.nombre !== undefined) d.nombre = texto(d.nombre, 'nombre', 150);
  if (d.codigo !== undefined) d.codigo = texto(d.codigo, 'codigo', 50);
  if (d.descripcion !== undefined) d.descripcion = texto(d.descripcion, 'descripcion', 5000);
  if (d.precioReferencia !== undefined) d.precioReferencia = numero(d.precioReferencia, 'precioReferencia', { min: 0 });
  if (d.costoUnitario !== undefined) d.costoUnitario = numero(d.costoUnitario, 'costoUnitario', { min: 0 });
  if (d.frecuenciaFacturacion !== undefined) d.frecuenciaFacturacion = texto(d.frecuenciaFacturacion, 'frecuenciaFacturacion', 50);
  if (d.stockDisponible !== undefined) d.stockDisponible = numero(d.stockDisponible, 'stockDisponible', { entero: true, min: 0 });
  if (d.activo !== undefined) d.activo = Boolean(d.activo);
  if (d.imagen !== undefined) {
    // Imagen embebida (data URL) o enlace http(s); nunca javascript: u otros esquemas.
    d.imagen = d.imagen && String(d.imagen).startsWith('data:') ? dataUrl(d.imagen, 'imagen', 3) : urlHttp(d.imagen, 'imagen');
  }
  if (d.lineaId !== undefined && d.lineaId !== null) {
    d.lineaId = numero(d.lineaId, 'lineaId', { entero: true });
    if (!(await LineaProducto.findByPk(d.lineaId))) throw badRequest('La línea indicada no existe', { lineaId: 'inexistente' });
  }
  if (d.principioActivo !== undefined) d.principioActivo = texto(d.principioActivo, 'principioActivo', 150);
  if (d.presentacion !== undefined) d.presentacion = texto(d.presentacion, 'presentacion', 100);
  if (d.tipoServicio !== undefined) d.tipoServicio = unoDe(d.tipoServicio || null, TIPOS_SERVICIO, 'tipoServicio');
  if (d.unidadMedida !== undefined) d.unidadMedida = texto(d.unidadMedida, 'unidadMedida', 30);
  return d;
};

const listarItemsDe = (tipo) => asyncHandler(async (req, res) => {
  const where = {};
  if (tipo) where.tipo = tipo;
  else if (req.query.tipo) where.tipo = unoDe(String(req.query.tipo), ['producto', 'servicio'], 'tipo');
  if (req.query.activos === '1') where.activo = true;
  if (req.query.lineaId) where.lineaId = Number(req.query.lineaId);
  const q = String(req.query.q || '').trim();
  if (q) where[Op.or] = [{ nombre: { [Op.like]: `%${q}%` } }, { codigo: { [Op.like]: `%${q}%` } }, { principioActivo: { [Op.like]: `%${q}%` } }];
  const scope = req.query.sinImagen === '1' ? 'defaultScope' : 'conImagen';
  const items = await ItemCatalogo.scope(scope).findAll({ where, include: [{ model: LineaProducto, as: 'linea' }], order: [['nombre', 'ASC']] });
  res.json({ data: items.map(serializeItem) });
});

export const listarItems = listarItemsDe(null);
export const listarProductos = listarItemsDe('producto');
export const listarServicios = listarItemsDe('servicio');

export const obtenerItem = asyncHandler(async (req, res) => {
  const i = await ItemCatalogo.scope('conImagen').findByPk(idParam(req), { include: [{ model: LineaProducto, as: 'linea' }] });
  if (!i) throw notFound('Ítem del catálogo');
  res.json({ data: serializeItem(i) });
});

const crearItemDe = (tipoForzado) => asyncHandler(async (req, res) => {
  const body = req.body || {};
  const d = await datosItem({ ...body, nombre: body.nombre ?? body.tipoServicio }, tipoForzado);
  if (!d.tipo) d.tipo = 'producto';
  requerido(d, ['nombre']);
  const i = await ItemCatalogo.create(d);
  const full = await ItemCatalogo.scope('conImagen').findByPk(i.id, { include: [{ model: LineaProducto, as: 'linea' }] });
  res.status(201).json({ message: d.tipo === 'servicio' ? 'Servicio creado' : 'Producto creado', data: serializeItem(full) });
});

export const crearItem = crearItemDe(null);
export const crearServicio = crearItemDe('servicio');

export const actualizarItem = asyncHandler(async (req, res) => {
  const i = await ItemCatalogo.findByPk(idParam(req));
  if (!i) throw notFound('Ítem del catálogo');
  const d = await datosItem(req.body || {});
  if (d.nombre === null) throw badRequest('El nombre no puede quedar vacío');
  await i.update(d);
  const full = await ItemCatalogo.scope('conImagen').findByPk(i.id, { include: [{ model: LineaProducto, as: 'linea' }] });
  res.json({ message: 'Ítem actualizado', data: serializeItem(full) });
});

// Si el ítem ya figura en órdenes u oportunidades se desactiva en vez de borrarse.
export const eliminarItem = asyncHandler(async (req, res) => {
  const i = await ItemCatalogo.findByPk(idParam(req));
  if (!i) throw notFound('Ítem del catálogo');
  const usado = (await OrdenServicio.count({ where: { servicioId: i.id }, paranoid: false })) + (await ProductoAplicado.count({ where: { itemId: i.id } }));
  if (usado) {
    await i.update({ activo: false });
    return res.json({ message: 'El ítem figura en órdenes de servicio: se desactivó en lugar de eliminarse.', data: { id: i.id, activo: false } });
  }
  try {
    await i.destroy();
  } catch (e) {
    if (e.name === 'SequelizeForeignKeyConstraintError') {
      await i.update({ activo: false });
      return res.json({ message: 'El ítem está en uso: se desactivó en lugar de eliminarse.', data: { id: i.id, activo: false } });
    }
    throw e;
  }
  res.json({ message: 'Ítem eliminado', id: i.id });
});
