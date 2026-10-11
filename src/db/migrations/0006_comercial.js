// Negocio → Oportunidad (5 estados), Actividad (vinculada y con adjuntos propios), Tareas.

export const descripcion = 'Oportunidades, actividades, adjuntos y tareas';

const normalizarTipoContacto = (t) => {
  const n = String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (n.startsWith('llam') || n.includes('telef')) return 'llamada';
  if (n.includes('whats')) return 'whatsapp';
  if (n.includes('mail') || n.includes('correo')) return 'email';
  if (n.startsWith('reun')) return 'reunion';
  return 'visita';
};

const ESTADO_SQL = `
  CASE
    WHEN etapa_comercial = 'cierre_ganado' OR estado IN ('Activo', 'Ganada', 'Ganado') THEN 'Ganada'
    WHEN etapa_comercial = 'cierre_perdido' OR estado IN ('Perdido', 'Perdida', 'Inactivo') THEN 'Perdida'
    WHEN etapa_comercial IN ('presentacion_programada', 'decisor_convencido', 'contrato_enviado')
         OR estado IN ('Negociación', 'Negociacion', 'Cotizado') THEN 'Cotizado'
    WHEN etapa_comercial IN ('cita_programada', 'calificado_comprar') OR estado = 'Contactado' THEN 'Contactado'
    ELSE 'Prospecto'
  END`;

export const up = async ({ h, log }) => {
  // ── oportunidades ──
  await h.renameTable('negocios', 'oportunidades');
  if (await h.hasColumn('oportunidades', 'nombre_negocio')) {
    await h.addColumn('oportunidades', 'motivo_perdida', 'VARCHAR(255) NULL');
    await h.q("UPDATE oportunidades SET motivo_perdida = 'Migrada desde el estado Inactivo' WHERE estado = 'Inactivo'");
    // Si alguna instalación vieja no tenía etapa_comercial, se agrega vacía para usar el mismo CASE.
    await h.addColumn('oportunidades', 'etapa_comercial', 'VARCHAR(60) NULL');
    await h.q(`UPDATE oportunidades SET estado = ${ESTADO_SQL}`);
    const resumen = await h.rows('SELECT estado, COUNT(*) AS n FROM oportunidades GROUP BY estado');
    log(`Estados mapeados: ${resumen.map((r) => `${r.estado}=${r.n}`).join(', ') || '(sin oportunidades)'}`);
  }
  await h.renameColumn('oportunidades', 'nombre_negocio', 'titulo');
  await h.renameColumn('oportunidades', 'potencialidad_cliente', 'potencialidad');
  await h.renameColumn('oportunidades', 'fecha_cierre', 'fecha_cierre_estimada');
  await h.renameColumn('oportunidades', 'client_company_id', 'empresa_id');
  await h.renameColumn('oportunidades', 'propietario_id', 'usuario_id');
  await h.addColumn('oportunidades', 'contacto_id', 'INT NULL');
  await h.addColumn('oportunidades', 'fecha_baja', 'DATETIME NULL');
  if (await h.hasColumn('oportunidades', 'contacto_num_doc')) {
    await h.q('UPDATE oportunidades o JOIN contactos c ON c.dni = o.contacto_num_doc SET o.contacto_id = c.id');
  }
  await h.q("UPDATE oportunidades SET titulo = 'Oportunidad sin título' WHERE titulo IS NULL OR TRIM(titulo) = ''");
  await h.modifyColumn('oportunidades', 'titulo', { nullable: false });
  await h.modifyColumn('oportunidades', 'estado', { type: 'VARCHAR(20)', default: "'Prospecto'" });
  await h.q('UPDATE oportunidades o LEFT JOIN usuarios u ON u.id_user = o.usuario_id SET o.usuario_id = NULL WHERE u.id_user IS NULL');
  await h.q('UPDATE oportunidades o LEFT JOIN empresas e ON e.id = o.empresa_id SET o.empresa_id = NULL WHERE e.id IS NULL');
  for (const c of ['pipeline', 'etapa_comercial', 'prioridad', 'tipo_negocio', 'propietario', 'contacto_nombre', 'contacto_num_doc']) {
    await h.dropColumn('oportunidades', c);
  }
  await h.addIndex('oportunidades', 'ix_oportunidades_estado', ['estado']);

  await h.createTable('oportunidad_items', `
    oportunidad_id INT NOT NULL,
    item_id INT NOT NULL,
    cantidad DECIMAL(12,2) NULL,
    PRIMARY KEY (oportunidad_id, item_id)`);

  // ── actividades ──
  await h.renameColumn('actividades', 'id_formulario', 'id');
  await h.renameColumn('actividades', 'opportunity_id', 'oportunidad_id');
  await h.renameColumn('actividades', 'id_user', 'usuario_id');
  await h.modifyColumn('actividades', 'tipo_contacto', { type: 'VARCHAR(20)', default: "'visita'" });
  await h.addColumn('actividades', 'resultado', 'VARCHAR(255) NULL', 'descripcion');
  await h.addColumn('actividades', 'sin_seguimiento', 'TINYINT(1) NOT NULL DEFAULT 0');
  await h.addColumn('actividades', 'orden_servicio_id', 'INT NULL');
  await h.addColumn('actividades', 'parada_id', 'INT NULL');
  await h.addColumn('actividades', 'fecha_registro', 'DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
  // Clave de idempotencia para el envío diferido sin conexión: un reintento no duplica.
  await h.addColumn('actividades', 'client_uuid', 'VARCHAR(36) NULL');
  await h.addIndex('actividades', 'ux_actividades_client_uuid', ['client_uuid'], { unique: true });
  await h.addIndex('actividades', 'ix_actividades_fecha', ['fecha_hora']);

  for (const r of await h.rows('SELECT DISTINCT tipo_contacto AS t FROM actividades')) {
    await h.q('UPDATE actividades SET tipo_contacto = ? WHERE tipo_contacto = ?', [normalizarTipoContacto(r.t), r.t]);
  }

  // Corrección de zona horaria (decisión D-3): el formulario mandaba la hora local
  // sin zona y el servidor (UTC) la guardaba como UTC → se mostraba 3 h antes.
  // Esas filas tienen segundos en 0 (el formulario arma "HH:MM:00"); las creadas
  // con la fecha del servidor tienen segundos arbitrarios y no se tocan.
  if (await h.hasColumn('actividades', 'autor_nombre')) {
    const [res] = await h.q('UPDATE actividades SET fecha_hora = DATE_ADD(fecha_hora, INTERVAL 3 HOUR) WHERE fecha_hora IS NOT NULL AND SECOND(fecha_hora) = 0');
    log(`Hora corregida (+3 h) en ${res.affectedRows ?? res.changedRows ?? '?'} actividades cargadas desde el formulario.`);
  }

  await h.q('UPDATE actividades a LEFT JOIN usuarios u ON u.id_user = a.usuario_id SET a.usuario_id = NULL WHERE u.id_user IS NULL');
  await h.q('UPDATE actividades a LEFT JOIN oportunidades o ON o.id = a.oportunidad_id SET a.oportunidad_id = NULL WHERE o.id IS NULL');

  // Actividades sin oportunidad pero con el nombre de una empresa existente:
  // se vinculan a una oportunidad abierta de esa empresa o se crea una.
  if (await h.hasColumn('actividades', 'empresa')) {
    const sueltas = await h.rows(
      `SELECT a.id, a.usuario_id, a.fecha_hora, e.id AS empresa_id
         FROM actividades a JOIN empresas e ON LOWER(TRIM(e.razon_social)) = LOWER(TRIM(a.empresa))
        WHERE a.oportunidad_id IS NULL AND a.empresa IS NOT NULL AND TRIM(a.empresa) <> ''`
    );
    let vinculadas = 0;
    let creadas = 0;
    for (const a of sueltas) {
      let opp = await h.one(
        "SELECT id FROM oportunidades WHERE empresa_id = ? AND estado NOT IN ('Ganada', 'Perdida') AND fecha_baja IS NULL ORDER BY id DESC LIMIT 1",
        [a.empresa_id]
      );
      if (!opp) {
        await h.q(
          `INSERT INTO oportunidades (titulo, estado, empresa_id, usuario_id, fecha_inicio, fecha_ultima_actualizacion)
           VALUES ('Seguimiento comercial (migrado)', 'Contactado', ?, ?, COALESCE(?, NOW()), NOW())`,
          [a.empresa_id, a.usuario_id, a.fecha_hora]
        );
        opp = await h.one('SELECT id FROM oportunidades WHERE empresa_id = ? ORDER BY id DESC LIMIT 1', [a.empresa_id]);
        creadas++;
      }
      await h.q('UPDATE actividades SET oportunidad_id = ? WHERE id = ?', [opp.id, a.id]);
      vinculadas++;
    }
    const sinVinculo = await h.count('actividades', 'oportunidad_id IS NULL');
    log(`${vinculadas} actividades vinculadas por nombre de empresa (${creadas} oportunidades creadas); ${sinVinculo} quedan sin vincular para revisión manual.`);
  }

  // ── adjuntos (antes: JSON con base64 dentro de actividades.archivo_adjunto) ──
  await h.createTable('adjuntos', `
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actividad_id INT NULL,
    orden_servicio_id INT NULL,
    tipo VARCHAR(12) NOT NULL COMMENT 'foto | audio | documento',
    nombre_archivo VARCHAR(200) NULL,
    mime_type VARCHAR(100) NULL,
    tamanio_kb INT NULL,
    contenido LONGTEXT NOT NULL COMMENT 'data URL (base64)',
    fecha_carga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_adjuntos_actividad (actividad_id),
    KEY ix_adjuntos_orden (orden_servicio_id)`);
  if (await h.hasColumn('actividades', 'archivo_adjunto')) {
    const conAdjunto = await h.rows("SELECT id, archivo_adjunto FROM actividades WHERE archivo_adjunto IS NOT NULL AND archivo_adjunto <> ''");
    let n = 0;
    for (const a of conAdjunto) {
      let data;
      try { data = JSON.parse(a.archivo_adjunto); } catch { data = { fotoUrl: a.archivo_adjunto }; }
      const piezas = [
        ['foto', data?.fotoUrl],
        ['audio', data?.audioData],
      ];
      for (const [tipo, contenido] of piezas) {
        if (!contenido || typeof contenido !== 'string') continue;
        const mime = (contenido.match(/^data:([^;,]+)/) || [])[1] || null;
        await h.q(
          'INSERT INTO adjuntos (actividad_id, tipo, mime_type, tamanio_kb, contenido) VALUES (?, ?, ?, ?, ?)',
          [a.id, tipo, mime, Math.ceil((contenido.length * 3) / 4 / 1024), contenido]
        );
        n++;
      }
    }
    log(`${n} adjuntos extraídos de ${conAdjunto.length} actividades.`);
  }
  // Antes de borrar las columnas de texto libre, lo que no se pudo vincular queda
  // escrito en la descripción para no perder información.
  if (await h.hasColumn('actividades', 'autor_nombre')) {
    await h.q(`UPDATE actividades a JOIN usuarios u ON LOWER(TRIM(u.nombre_apellido)) = LOWER(TRIM(a.autor_nombre))
               SET a.usuario_id = u.id_user WHERE a.usuario_id IS NULL`);
    await h.q(`UPDATE actividades SET descripcion = CONCAT(IF(descripcion IS NULL OR descripcion = '', '', CONCAT(descripcion, '\\n')), '(Registrada por: ', autor_nombre, ')')
               WHERE usuario_id IS NULL AND autor_nombre IS NOT NULL AND TRIM(autor_nombre) <> '' AND autor_nombre <> 'Equipo AgroRos'`);
  }
  if (await h.hasColumn('actividades', 'empresa')) {
    await h.q(`UPDATE actividades SET descripcion = CONCAT('[Empresa: ', empresa, ']', IF(descripcion IS NULL OR descripcion = '', '', CONCAT('\\n', descripcion)))
               WHERE oportunidad_id IS NULL AND empresa IS NOT NULL AND TRIM(empresa) <> ''`);
  }
  for (const c of ['empresa', 'archivo_adjunto', 'autor_nombre']) await h.dropColumn('actividades', c);

  // ── tareas ──
  await h.renameColumn('tareas', 'formulario_actividad_id', 'actividad_id');
  await h.addColumn('tareas', 'empresa_id', 'INT NULL');
  await h.addColumn('tareas', 'creado_por_id', 'VARCHAR(20) NULL');
  if (await h.hasColumn('tareas', 'empresa')) {
    await h.q('UPDATE tareas t JOIN empresas e ON LOWER(TRIM(e.razon_social)) = LOWER(TRIM(t.empresa)) SET t.empresa_id = e.id WHERE t.empresa IS NOT NULL');
  }
  await h.q("UPDATE tareas SET estado = 'Finalizada' WHERE LOWER(estado) IN ('finalizada', 'completada', 'completa', 'hecha')");
  await h.q("UPDATE tareas SET estado = 'Cancelada' WHERE LOWER(estado) = 'cancelada'");
  await h.q("UPDATE tareas SET estado = 'Pendiente' WHERE estado NOT IN ('Finalizada', 'Cancelada')");
  await h.q('UPDATE tareas t LEFT JOIN usuarios u ON u.id_user = t.finalizado_por_id SET t.finalizado_por_id = NULL WHERE u.id_user IS NULL');
  await h.q('UPDATE tareas t LEFT JOIN actividades a ON a.id = t.actividad_id SET t.actividad_id = NULL WHERE a.id IS NULL');
  // Nada de lo que estaba escrito se pierde: la empresa que no se pudo vincular y
  // el contacto (texto libre en v1) pasan a las notas de la tarea.
  if (await h.hasColumn('tareas', 'empresa')) {
    const r = await h.q(`UPDATE tareas SET notas = CONCAT(IF(notas IS NULL OR notas = '', '', CONCAT(notas, '\\n')), 'Empresa: ', empresa)
                          WHERE empresa_id IS NULL AND empresa IS NOT NULL AND TRIM(empresa) <> ''`);
    log(`${r?.[0]?.affectedRows ?? r?.affectedRows ?? 0} tareas con empresa sin vincular: el nombre quedó en las notas.`);
  }
  if (await h.hasColumn('tareas', 'contacto')) {
    await h.q(`UPDATE tareas SET notas = CONCAT(IF(notas IS NULL OR notas = '', '', CONCAT(notas, '\\n')), 'Contacto: ', contacto)
               WHERE contacto IS NOT NULL AND TRIM(contacto) <> ''`);
  }
  // Tareas viejas sin filas en tareas_asignados: se vinculan por nombre del usuario.
  if (await h.hasColumn('tareas', 'asignado_a') && await h.hasTable('tareas_asignados')) {
    const cols = await h.columns('tareas_asignados');
    const tCol = cols.includes('task_id') ? 'task_id' : 'tarea_id';
    const uCol = cols.includes('id_user') ? 'id_user' : 'usuario_id';
    await h.q(`INSERT INTO tareas_asignados (${tCol}, ${uCol})
               SELECT t.id, u.id_user FROM tareas t JOIN usuarios u ON LOWER(TRIM(u.nombre_apellido)) = LOWER(TRIM(t.asignado_a))
               WHERE NOT EXISTS (SELECT 1 FROM tareas_asignados x WHERE x.${tCol} = t.id)`);
  }
  for (const c of ['empresa', 'contacto', 'asignado_a', 'creado_por_rol', 'destinatario_rol']) await h.dropColumn('tareas', c);
  await h.addIndex('tareas', 'ix_tareas_estado_venc', ['estado', 'fecha_vencimiento']);

  await h.renameTable('tareas_asignados', 'tarea_asignados');
  await h.renameColumn('tarea_asignados', 'task_id', 'tarea_id');
  await h.renameColumn('tarea_asignados', 'id_user', 'usuario_id');
  await h.q(`DELETE a FROM tarea_asignados a JOIN tarea_asignados b
              ON a.tarea_id = b.tarea_id AND a.usuario_id = b.usuario_id AND a.id > b.id`);
  await h.q('DELETE a FROM tarea_asignados a LEFT JOIN usuarios u ON u.id_user = a.usuario_id WHERE u.id_user IS NULL');
  await h.q('DELETE a FROM tarea_asignados a LEFT JOIN tareas t ON t.id = a.tarea_id WHERE t.id IS NULL');
  await h.addIndex('tarea_asignados', 'ux_tarea_asignados', ['tarea_id', 'usuario_id'], { unique: true });

  log(`oportunidades=${await h.count('oportunidades')}, actividades=${await h.count('actividades')}, adjuntos=${await h.count('adjuntos')}, tareas=${await h.count('tareas')}`);
};
