// Hojas de ruta, objetivos con período real, promociones sobre ítems, notas y notificaciones.

export const description = 'Hojas de ruta, objetivos (fechas y N:M), promociones, notas y notificaciones';

// Lunes de la semana ISO `week` de `year` (UTC).
const isoWeekMonday = (year, week) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  return monday;
};
const ymd = (d) => d.toISOString().slice(0, 10);

const normalizarTipoObjetivo = (t) => {
  const n = String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (n.startsWith('visit')) return 'visitas';
  if (n.startsWith('cotiz')) return 'cotizaciones';
  if (n.includes('nuev') || n.includes('prospec')) return 'nuevosClientes';
  if (n.startsWith('servic')) return 'servicios';
  return 'ventas'; // "Ventas", y "Cobranzas" (excluida por la minuta) pasa a ventas
};

export const up = async ({ h, log }) => {
  // ── hojas de ruta ──
  await h.renameColumn('hojas_ruta', 'nombre_zona', 'nombre');
  await h.renameColumn('hojas_ruta', 'fecha_ruta', 'fecha');
  await h.renameColumn('hojas_ruta', 'hora_ruta', 'hora_inicio_plan');
  await h.renameColumn('hojas_ruta', 'fecha_fin_propuesta', 'fecha_fin_plan');
  await h.renameColumn('hojas_ruta', 'hora_fin_propuesta', 'hora_fin_plan');
  await h.renameColumn('hojas_ruta', 'id_user_asignado', 'usuario_id');
  await h.renameColumn('hojas_ruta', 'fecha_hora_inicio_real', 'inicio_real');
  await h.renameColumn('hojas_ruta', 'fecha_hora_fin_real', 'fin_real');
  // creado_por_id era INT y nunca coincidía con un id de usuario (VARCHAR).
  const creadoPor = await h.getColumn('hojas_ruta', 'creado_por_id');
  if (creadoPor && /int/i.test(creadoPor.COLUMN_TYPE)) {
    await h.q('UPDATE hojas_ruta SET creado_por_id = NULL');
    await h.modifyColumn('hojas_ruta', 'creado_por_id', { type: 'VARCHAR(20)', nullable: true });
  }
  await h.addColumn('hojas_ruta', 'fecha_creacion', 'DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
  await h.dropColumn('hojas_ruta', 'fecha_nota');
  await h.q('UPDATE hojas_ruta r LEFT JOIN usuarios u ON u.id_user = r.usuario_id SET r.usuario_id = NULL WHERE u.id_user IS NULL');

  await h.renameTable('hoja_ruta_paradas', 'paradas_ruta');
  await h.renameColumn('paradas_ruta', 'roadmap_id', 'hoja_ruta_id');
  await h.renameColumn('paradas_ruta', 'client_company_id', 'empresa_id');
  await h.renameColumn('paradas_ruta', 'estado_parada', 'estado');
  await h.modifyColumn('paradas_ruta', 'latitud', { type: 'DECIMAL(10,7)' });
  await h.modifyColumn('paradas_ruta', 'longitud', { type: 'DECIMAL(10,7)' });
  // Solo se aceptan enlaces http(s): un "javascript:" en una parada era un XSS guardado.
  const [urls] = await h.q("UPDATE paradas_ruta SET url = NULL WHERE url IS NOT NULL AND url NOT LIKE 'http://%' AND url NOT LIKE 'https://%'");
  if (urls.affectedRows) log(`${urls.affectedRows} enlaces de paradas no http(s) eliminados.`);
  await h.q('DELETE p FROM paradas_ruta p LEFT JOIN hojas_ruta r ON r.id = p.hoja_ruta_id WHERE r.id IS NULL');
  await h.q('UPDATE paradas_ruta p LEFT JOIN empresas e ON e.id = p.empresa_id SET p.empresa_id = NULL WHERE e.id IS NULL');

  // ── objetivos ──
  await h.renameColumn('objetivos', 'id_user', 'usuario_id');
  await h.addColumn('objetivos', 'tipo_periodo', "VARCHAR(10) NOT NULL DEFAULT 'semanal'", 'tipo_objetivo');
  await h.addColumn('objetivos', 'fecha_inicio', 'DATE NULL', 'tipo_periodo');
  await h.addColumn('objetivos', 'fecha_fin', 'DATE NULL', 'fecha_inicio');
  await h.addColumn('objetivos', 'creado_por_id', 'VARCHAR(20) NULL');
  await h.addColumn('objetivos', 'fecha_creacion', 'DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
  await h.createTable('objetivo_empresas', `
    objetivo_id INT NOT NULL,
    empresa_id INT NOT NULL,
    PRIMARY KEY (objetivo_id, empresa_id)`);
  await h.createTable('objetivo_items', `
    objetivo_id INT NOT NULL,
    item_id INT NOT NULL,
    PRIMARY KEY (objetivo_id, item_id)`);

  if (await h.hasColumn('objetivos', 'periodo_semana')) {
    const year = new Date().getUTCFullYear();
    const objetivos = await h.rows('SELECT id, periodo_semana, tipo_objetivo, client_company_id FROM objetivos');
    const now = new Date();
    for (const o of objetivos) {
      let week = Number(o.periodo_semana);
      if (!week || week < 1 || week > 53) {
        // Sin semana válida: se toma la semana actual.
        const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const dayNum = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - dayNum);
        week = Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
      }
      const lunes = isoWeekMonday(year, week);
      const domingo = new Date(lunes);
      domingo.setUTCDate(lunes.getUTCDate() + 6);
      await h.q('UPDATE objetivos SET fecha_inicio = ?, fecha_fin = ?, tipo_objetivo = ? WHERE id = ?', [
        ymd(lunes), ymd(domingo), normalizarTipoObjetivo(o.tipo_objetivo), o.id,
      ]);
      if (o.client_company_id) {
        await h.q('INSERT IGNORE INTO objetivo_empresas (objetivo_id, empresa_id) SELECT ?, id FROM empresas WHERE id = ?', [o.id, o.client_company_id]);
      }
    }
    log(`${objetivos.length} objetivos con semana ${year} convertida a fechas (lunes a domingo).`);
    await h.dropColumn('objetivos', 'periodo_semana');
    await h.dropColumn('objetivos', 'client_company_id');
  }
  await h.modifyColumn('objetivos', 'fecha_inicio', { nullable: false });
  await h.modifyColumn('objetivos', 'fecha_fin', { nullable: false });
  await h.modifyColumn('objetivos', 'tipo_objetivo', { type: 'VARCHAR(20)' });
  await h.q('UPDATE objetivos o LEFT JOIN usuarios u ON u.id_user = o.usuario_id SET o.usuario_id = NULL WHERE u.id_user IS NULL');
  await h.addIndex('objetivos', 'ix_objetivos_usuario_periodo', ['usuario_id', 'fecha_inicio']);

  await h.renameTable('objetivo_promocion', 'objetivo_promociones');
  await h.renameColumn('objetivo_promociones', 'objective_id', 'objetivo_id');
  await h.renameColumn('objetivo_promociones', 'promotion_id', 'promocion_id');

  // ── promociones ──
  await h.modifyColumn('promociones', 'fecha_inicio', { type: 'DATE' });
  await h.modifyColumn('promociones', 'fecha_fin', { type: 'DATE' });
  await h.addColumn('promociones', 'creado_por_id', 'VARCHAR(20) NULL');
  await h.createTable('promocion_items', `
    promocion_id INT NOT NULL,
    item_id INT NOT NULL,
    PRIMARY KEY (promocion_id, item_id)`);
  if (await h.hasTable('promocion_linea_producto')) {
    await h.q(`INSERT IGNORE INTO promocion_items (promocion_id, item_id)
               SELECT pl.promotion_id, i.id FROM promocion_linea_producto pl JOIN items_catalogo i ON i.linea_id = pl.product_line_id`);
    log(`promocion_items=${await h.count('promocion_items')} (desde promoción × línea de producto).`);
    const sinItems = await h.rows(
      `SELECT pl.promotion_id AS p, pl.product_line_id AS l FROM promocion_linea_producto pl
        LEFT JOIN items_catalogo i ON i.linea_id = pl.product_line_id WHERE i.id IS NULL`
    );
    if (sinItems.length) {
      log(`Atención: ${sinItems.length} vínculos promoción→línea sin productos en esa línea (${sinItems.map((r) => `promo ${r.p}/línea ${r.l}`).join(', ')}). Reasignar los ítems de la promoción desde la pantalla de Promociones.`);
    }
  }

  // ── notas internas ──
  await h.renameColumn('notas_internas', 'id_user', 'usuario_id');
  await h.addColumn('notas_internas', 'estado', "VARCHAR(12) NOT NULL DEFAULT 'abierta'");

  // ── notificaciones (nueva) ──
  await h.createTable('notificaciones', `
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    usuario_id VARCHAR(20) NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    mensaje VARCHAR(255) NOT NULL,
    entidad VARCHAR(30) NULL,
    entidad_id VARCHAR(30) NULL,
    leida TINYINT(1) NOT NULL DEFAULT 0,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_notificaciones_usuario (usuario_id, leida)`);

  log(`hojas_ruta=${await h.count('hojas_ruta')}, paradas=${await h.count('paradas_ruta')}, objetivos=${await h.count('objetivos')}`);
};
