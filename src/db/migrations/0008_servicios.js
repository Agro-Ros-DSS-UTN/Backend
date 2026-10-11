// Órdenes de servicio vinculadas a Empresa, Servicio del catálogo y Empleados (rol técnico).

export const descripcion = 'Órdenes de servicio, empleados con rol, productos aplicados y evaluación';

const rolDe = (puesto) => {
  const p = String(puesto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (p.includes('tecnic') || p.includes('aplicad')) return 'tecnico';
  if (p.includes('chofer') || p.includes('conductor')) return 'chofer';
  if (p.includes('administ')) return 'administrativo';
  return 'ayudante';
};

export const up = async ({ h, log }) => {
  // ── empleados ──
  if (await h.addColumn('empleados', 'rol', "VARCHAR(20) NOT NULL DEFAULT 'ayudante'", 'matricula')) {
    for (const e of await h.rows('SELECT id, puesto FROM empleados')) {
      await h.q('UPDATE empleados SET rol = ? WHERE id = ?', [rolDe(e.puesto), e.id]);
    }
    const roles = await h.rows('SELECT rol, COUNT(*) AS n FROM empleados GROUP BY rol');
    log(`Roles de empleados: ${roles.map((r) => `${r.rol}=${r.n}`).join(', ') || '(sin empleados)'}`);
  }
  await h.addIndex('empleados', 'ix_empleados_dni', ['dni']);

  // ── órdenes de servicio ──
  await h.renameColumn('ordenes_servicio', 'fecha', 'fecha_programada');
  await h.renameColumn('ordenes_servicio', 'observaciones_orden', 'observaciones');
  await h.addColumn('ordenes_servicio', 'fecha_realizada', 'DATE NULL', 'fecha_programada');
  await h.addColumn('ordenes_servicio', 'empresa_id', 'INT NULL', 'numero_orden');
  await h.addColumn('ordenes_servicio', 'servicio_id', 'INT NULL', 'empresa_id');
  await h.addColumn('ordenes_servicio', 'oportunidad_id', 'INT NULL', 'servicio_id');
  await h.addColumn('ordenes_servicio', 'creado_por_id', 'VARCHAR(20) NULL');
  await h.addColumn('ordenes_servicio', 'fecha_baja', 'DATETIME NULL');
  await h.q("UPDATE ordenes_servicio SET fecha_realizada = fecha_programada WHERE estado = 'Completada' AND fecha_realizada IS NULL");
  await h.q(`UPDATE ordenes_servicio o JOIN empresas e ON LOWER(TRIM(e.razon_social)) = LOWER(TRIM(o.cliente_nombre))
                SET o.empresa_id = e.id WHERE o.empresa_id IS NULL`);
  await h.q(`UPDATE ordenes_servicio o JOIN items_catalogo i ON i.tipo = 'servicio' AND LOWER(i.nombre) = LOWER(TRIM(o.tipo_trabajo))
                SET o.servicio_id = i.id WHERE o.servicio_id IS NULL`);
  const sinEmpresa = await h.count('ordenes_servicio', 'empresa_id IS NULL');
  if (sinEmpresa) log(`${sinEmpresa} órdenes sin empresa coincidente: quedan con el nombre del acta y empresa vacía para asignar a mano.`);

  // Número de orden único: si había repetidos se les agrega un sufijo.
  const repetidos = await h.rows('SELECT numero_orden AS n FROM ordenes_servicio GROUP BY numero_orden HAVING COUNT(*) > 1');
  for (const { n } of repetidos) {
    const filas = await h.rows('SELECT id FROM ordenes_servicio WHERE numero_orden = ? ORDER BY id', [n]);
    for (let i = 1; i < filas.length; i++) await h.q('UPDATE ordenes_servicio SET numero_orden = ? WHERE id = ?', [`${n}-${i + 1}`, filas[i].id]);
    log(`Número de orden repetido "${n}" renombrado con sufijo en ${filas.length - 1} filas.`);
  }
  await h.addIndex('ordenes_servicio', 'ux_ordenes_numero', ['numero_orden'], { unique: true });
  await h.addIndex('ordenes_servicio', 'ix_ordenes_empresa_fecha', ['empresa_id', 'fecha_programada']);

  // Técnicos: texto libre → relación con empleados.
  await h.createTable('orden_empleados', `
    orden_servicio_id INT NOT NULL,
    empleado_id INT NOT NULL,
    PRIMARY KEY (orden_servicio_id, empleado_id)`);
  if (await h.hasColumn('ordenes_servicio', 'tecnico_aplicador')) {
    const ordenes = await h.rows("SELECT id, tecnico_aplicador FROM ordenes_servicio WHERE tecnico_aplicador IS NOT NULL AND tecnico_aplicador <> ''");
    let vinculados = 0;
    let creados = 0;
    const sinMatch = [];
    for (const o of ordenes) {
      for (const nombre of String(o.tecnico_aplicador).split(/[,;/]| y /).map((s) => s.trim()).filter(Boolean)) {
        const emp = await h.one('SELECT id FROM empleados WHERE LOWER(TRIM(nombre_apellido)) = LOWER(?)', [nombre]);
        if (emp) {
          await h.q('INSERT IGNORE INTO orden_empleados (orden_servicio_id, empleado_id) VALUES (?, ?)', [o.id, emp.id]);
          vinculados++;
        } else if (/no registrado|sin asignar|^-+$/i.test(nombre)) {
          sinMatch.push(`${o.id}:${nombre}`);
        } else {
          // Técnico que figuraba en la orden pero no estaba en Empleados: se da de alta
          // con rol "tecnico" para no perder el dato (la administración completa el resto).
          await h.q("INSERT INTO empleados (nombre_apellido, rol, puesto, activo, observaciones, fecha_creacion) VALUES (?, 'tecnico', 'Técnico aplicador', 1, 'Alta automática desde órdenes de servicio v1', NOW())", [nombre]);
          const nuevo = await h.one('SELECT id FROM empleados WHERE nombre_apellido = ? ORDER BY id DESC LIMIT 1', [nombre]);
          await h.q('INSERT IGNORE INTO orden_empleados (orden_servicio_id, empleado_id) VALUES (?, ?)', [o.id, nuevo.id]);
          creados++;
        }
      }
    }
    log(`${vinculados} técnicos vinculados a órdenes, ${creados} dados de alta como empleados.${sinMatch.length ? ` Sin coincidencia (quedan en _bak_v1_ordenes_servicio): ${sinMatch.join(', ')}` : ''}`);
    await h.dropColumn('ordenes_servicio', 'tecnico_aplicador');
  }

  // ── detalle / productos aplicados ──
  await h.renameTable('orden_servicio_productos', 'productos_aplicados');
  await h.addColumn('productos_aplicados', 'item_id', 'INT NULL', 'orden_servicio_id');
  await h.q(`UPDATE productos_aplicados p JOIN items_catalogo i ON i.tipo = 'producto' AND LOWER(i.nombre) = LOWER(TRIM(p.producto))
                SET p.item_id = i.id WHERE p.item_id IS NULL`);
  await h.q('DELETE p FROM productos_aplicados p LEFT JOIN ordenes_servicio o ON o.id = p.orden_servicio_id WHERE o.id IS NULL');

  // ── evaluación (1:1 con la orden) ──
  await h.renameColumn('evaluaciones_servicio', 'ppm_p_h3', 'ppm_ph3');
  await h.addColumn('evaluaciones_servicio', 'satisfaccion_cliente', 'TINYINT NULL COMMENT \'1 a 5\'');
  await h.addColumn('evaluaciones_servicio', 'comentario_cliente', 'TEXT NULL');
  await h.q(`DELETE a FROM evaluaciones_servicio a JOIN evaluaciones_servicio b
              ON a.orden_servicio_id = b.orden_servicio_id AND a.id < b.id`);
  await h.q('DELETE e FROM evaluaciones_servicio e LEFT JOIN ordenes_servicio o ON o.id = e.orden_servicio_id WHERE o.id IS NULL');
  await h.addIndex('evaluaciones_servicio', 'ux_evaluaciones_orden', ['orden_servicio_id'], { unique: true });

  log(`órdenes=${await h.count('ordenes_servicio')}, orden_empleados=${await h.count('orden_empleados')}, empleados=${await h.count('empleados')}`);
};
