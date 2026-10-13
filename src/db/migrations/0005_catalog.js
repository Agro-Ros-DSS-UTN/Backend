// Catálogo único de productos y servicios (ItemCatalogo con herencia en una tabla).

export const description = 'Catálogo: líneas de producto e items_catalogo (productos y servicios)';

const tipoServicioDe = (nombre) => {
  const n = String(nombre || '').toLowerCase();
  if (n.includes('silobolsa') || n.includes('silo bolsa')) return 'silobolsa';
  if (n.includes('contenedor')) return 'contenedor';
  if (n.includes('buque') || n.includes('bodega')) return 'buque';
  if (n.includes('urban') || n.includes('domicil')) return 'plagasUrbanas';
  if (n.includes('monitoreo') || n.includes('agronóm') || n.includes('agronom')) return 'monitoreo';
  if (n.includes('silo') || n.includes('celda') || n.includes('fumig')) return 'fumigacionSilo';
  return 'otro';
};

const categoriaDe = (nombre) => {
  const n = String(nombre || '').toLowerCase();
  if (n.includes('fumig') || n.includes('fosf')) return 'fumigante';
  if (n.includes('insect') || n.includes('piretr')) return 'insecticida';
  if (n.includes('rodent') || n.includes('roedor')) return 'rodenticida';
  if (n.includes('fertil')) return 'fertilizante';
  return 'otro';
};

export const up = async ({ h, log }) => {
  // ── líneas de producto ──
  await h.renameColumn('lineas_producto', 'linea_producto', 'nombre');
  await h.addColumn('lineas_producto', 'codigo', 'VARCHAR(30) NULL', 'id');
  await h.addColumn('lineas_producto', 'categoria', "VARCHAR(30) NOT NULL DEFAULT 'otro'");
  if (await h.hasColumn('lineas_producto', 'type_product_id')) {
    if (await h.hasTable('tipos_producto')) {
      const lineas = await h.rows(
        'SELECT l.id, t.tipo_producto AS tipo FROM lineas_producto l LEFT JOIN tipos_producto t ON t.id = l.type_product_id'
      );
      for (const l of lineas) await h.q('UPDATE lineas_producto SET categoria = ? WHERE id = ?', [categoriaDe(l.tipo), l.id]);
    }
    await h.dropColumn('lineas_producto', 'type_product_id');
  }

  // ── items_catalogo ──
  const creada = await h.createTable('items_catalogo', `
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(10) NOT NULL COMMENT 'producto | servicio',
    nombre VARCHAR(150) NOT NULL,
    codigo VARCHAR(50) NULL,
    descripcion TEXT NULL,
    precio_referencia DECIMAL(12,2) NULL,
    costo_unitario DECIMAL(12,2) NULL,
    frecuencia_facturacion VARCHAR(50) NULL,
    stock_disponible INT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    imagen LONGTEXT NULL,
    linea_id INT NULL,
    principio_activo VARCHAR(150) NULL,
    presentacion VARCHAR(100) NULL,
    tipo_servicio VARCHAR(30) NULL,
    unidad_medida VARCHAR(30) NULL,
    fecha_alta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_items_tipo (tipo, activo),
    KEY ix_items_linea (linea_id)`);
  if (!creada && (await h.count('items_catalogo')) > 0) return log('items_catalogo ya tenía datos: no se vuelve a poblar.');

  // Productos v1 → items (se conserva el id). Lo que estaba cargado como
  // "Servicio ..." en productos pasa a ser un servicio del catálogo.
  if (await h.hasTable('productos')) {
    const productos = await h.rows('SELECT * FROM productos');
    for (const p of productos) {
      const esServicio = /servicio/i.test(p.tipo_producto || '');
      let lineaId = null;
      if (!esServicio && p.tipo_producto) {
        const linea = await h.one('SELECT id FROM lineas_producto WHERE LOWER(nombre) = LOWER(?)', [p.tipo_producto]);
        if (linea) lineaId = linea.id;
        else {
          await h.q('INSERT INTO lineas_producto (nombre, categoria) VALUES (?, ?)', [p.tipo_producto, categoriaDe(p.tipo_producto)]);
          lineaId = (await h.one('SELECT id FROM lineas_producto WHERE nombre = ? ORDER BY id DESC LIMIT 1', [p.tipo_producto])).id;
        }
      }
      await h.q(
        `INSERT INTO items_catalogo (id, tipo, nombre, codigo, descripcion, precio_referencia, costo_unitario, frecuencia_facturacion, stock_disponible, activo, imagen, linea_id, tipo_servicio, fecha_alta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, esServicio ? 'servicio' : 'producto', p.nombre, p.ref, p.descripcion, p.precio_unitario, p.coste_unidad ?? null, p.frecuencia_facturacion ?? null,
          p.stock_disponible ?? null, p.activo ? 1 : 0, p.imagen_url, lineaId, esServicio ? tipoServicioDe(p.nombre) : null, p.fecha_creacion || new Date()]
      );
    }
    log(`${productos.length} productos copiados a items_catalogo (con precio, costo, stock y frecuencia de facturación).`);
  }

  // Servicios: los tipos usados en la tabla vieja `services` y en las órdenes de servicio.
  const nombres = new Set();
  if (await h.hasTable('services')) for (const r of await h.rows('SELECT DISTINCT tipo_servicio AS n FROM services')) nombres.add(r.n);
  if (await h.hasTable('ordenes_servicio')) for (const r of await h.rows('SELECT DISTINCT tipo_trabajo AS n FROM ordenes_servicio')) nombres.add(r.n);
  let nuevos = 0;
  for (const nombre of nombres) {
    if (!nombre || !String(nombre).trim()) continue;
    const existe = await h.one("SELECT id FROM items_catalogo WHERE tipo = 'servicio' AND LOWER(nombre) = LOWER(?)", [nombre.trim()]);
    if (existe) continue;
    await h.q("INSERT INTO items_catalogo (tipo, nombre, tipo_servicio, unidad_medida) VALUES ('servicio', ?, ?, 'tn')", [nombre.trim(), tipoServicioDe(nombre)]);
    nuevos++;
  }
  log(`${nuevos} servicios agregados al catálogo desde órdenes y servicios v1.`);
};
