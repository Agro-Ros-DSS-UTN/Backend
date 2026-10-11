// Negocio → Oportunidad (5 estados), Actividad (vinculada y con adjuntos propios), Tareas.

import { claveNombre, indicePorNombre } from '../texto.js';

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

// Busca la empresa a la que se refiere un texto libre: por razón social y, si no,
// por nombre de un contacto (en v1 a veces se escribía la persona en vez de la empresa).
const buscadorEmpresa = async (h) => {
  const empresas = indicePorNombre(await h.rows('SELECT id, razon_social FROM empresas'), 'razon_social');
  const contactos = indicePorNombre(await h.rows('SELECT id, nombre_apellido, empresa_id FROM contactos WHERE empresa_id IS NOT NULL'), 'nombre_apellido');
  return (texto) => {
    const k = claveNombre(texto);
    if (!k) return null;
    const e = empresas.get(k);
    if (e?.length === 1) return { empresaId: e[0].id, via: 'empresa' };
    const c = contactos.get(k);
    if (c?.length === 1) return { empresaId: c[0].empresa_id, contactoId: c[0].id, via: 'contacto' };
    return null; // sin coincidencia o ambiguo: no se adivina
  };
};

export const up = async ({ h, log }) => {
  // ── oportunidades ──
  // Algunas bases v1 tienen además una tabla `oportunidades` vieja (modelo HubSpot
  // con seller_id → vendedores) que la app ya no usaba: la de verdad es `negocios`.
  // Se aparta con su contenido para que negocios pueda tomar su nombre.
  if ((await h.hasTable('negocios')) && (await h.hasTable('oportunidades'))) {
    const n = await h.count('oportunidades');
    const destino = (await h.hasTable('_bak_v1_oportunidades_antigua')) ? `_bak_v1_oportunidades_antigua_${Date.now()}` : '_bak_v1_oportunidades_antigua';
    await h.q(`RENAME TABLE oportunidades TO ${h.id(destino)}`);
    log(`Tabla oportunidades vieja (sin uso en v1, ${n} filas) apartada como ${destino}.`);
  }
  await h.renameTable('negocios', 'oportunidades');
  if (!(await h.hasColumn('oportunidades', 'nombre_negocio')) && !(await h.hasColumn('oportunidades', 'titulo'))) {
    throw new Error('La tabla oportunidades no tiene la forma esperada (ni nombre_negocio ni titulo). Revisar antes de seguir.');
  }
  if (await h.hasColumn('oportunidades', 'nombre_negocio')) {
    await h.addColumn('oportunidades', 'motivo_perdida', 'VARCHAR(255) NULL');
    await h.q("UPDATE oportunidades SET motivo_perdida = 'Migrada desde el estado Inactivo' WHERE estado = 'Inactivo'");
    // Si alguna instalación vieja no tenía etapa_comercial, se agrega vacía para usar el mismo CASE.
    await h.addColumn('oportunidades', 'etapa_comercial', 'VARCHAR(60) NULL');
    await h.setExacto('oportunidades', 'estado', ESTADO_SQL);
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
  // Quién la cargó (P-3: el vendedor solo da de baja lo que creó). En v1 el
  // responsable era quien la cargaba, así que se toma ese valor.
  if (await h.addColumn('oportunidades', 'creado_por_id', 'VARCHAR(20) NULL')) {
    await h.q('UPDATE oportunidades SET creado_por_id = usuario_id');
  }
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

  // 'Visita' → 'visita', 'Reunión' → 'reunion', etc. (DISTINCT con collation *_ci junta
  // las variantes de mayúsculas/acentos, que van todas al mismo valor).
  const tipos = await h.rows('SELECT DISTINCT tipo_contacto AS t FROM actividades WHERE tipo_contacto IS NOT NULL');
  if (tipos.length) {
    const caso = `CASE tipo_contacto ${tipos.map((r) => `WHEN ${h.esc(r.t)} THEN ${h.esc(normalizarTipoContacto(r.t))}`).join(' ')} ELSE 'visita' END`;
    await h.setExacto('actividades', 'tipo_contacto', caso, 'tipo_contacto IS NOT NULL');
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

  // Actividades sin oportunidad pero con texto de empresa: se busca la empresa
  // (o el contacto) con comparación tolerante a mayúsculas, acentos y espacios, y
  // se vinculan a una oportunidad abierta de esa empresa o se crea una.
  if (await h.hasColumn('actividades', 'empresa')) {
    const buscar = await buscadorEmpresa(h);
    const sueltas = await h.rows("SELECT id, usuario_id, fecha_hora, empresa FROM actividades WHERE oportunidad_id IS NULL AND empresa IS NOT NULL AND TRIM(empresa) <> ''");
    let vinculadas = 0;
    let creadas = 0;
    for (const a of sueltas) {
      const m = buscar(a.empresa);
      if (!m) continue;
      let opp = await h.one(
        "SELECT id FROM oportunidades WHERE empresa_id = ? AND estado NOT IN ('Ganada', 'Perdida') AND fecha_baja IS NULL ORDER BY id DESC LIMIT 1",
        [m.empresaId]
      );
      if (!opp) {
        await h.q(
          `INSERT INTO oportunidades (titulo, estado, empresa_id, usuario_id, contacto_id, fecha_inicio, fecha_ultima_actualizacion)
           VALUES ('Seguimiento comercial (migrado)', 'Contactado', ?, ?, ?, COALESCE(?, NOW()), NOW())`,
          [m.empresaId, a.usuario_id, m.contactoId || null, a.fecha_hora]
        );
        opp = await h.one('SELECT id FROM oportunidades WHERE empresa_id = ? ORDER BY id DESC LIMIT 1', [m.empresaId]);
        creadas++;
      }
      await h.q('UPDATE actividades SET oportunidad_id = ? WHERE id = ?', [opp.id, a.id]);
      vinculadas++;
    }
    const sinVinculo = await h.count('actividades', 'oportunidad_id IS NULL');
    log(`${vinculadas} actividades vinculadas por nombre de empresa o contacto (${creadas} oportunidades creadas); ${sinVinculo} quedan sin oportunidad (el texto queda en la descripción).`);
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
    let vacios = 0;
    const raros = [];
    // v1 guardaba {"fotoUrl": "data:image/…", "audioData": {"url": "data:audio/…", "name": "…"}}
    // (con null en lo que no se cargó). También se acepta un data URL suelto.
    const pieza = (v) => {
      if (!v) return null;
      if (typeof v === 'string') return { contenido: v, nombre: null };
      if (typeof v === 'object') {
        const contenido = v.url || v.dataUrl || v.data || v.src || null;
        return typeof contenido === 'string' ? { contenido, nombre: v.name || v.nombre || null } : null;
      }
      return null;
    };
    for (const a of conAdjunto) {
      let data;
      try { data = JSON.parse(a.archivo_adjunto); } catch { data = { fotoUrl: a.archivo_adjunto }; }
      if (typeof data === 'string') data = { fotoUrl: data };
      const piezas = [
        ['foto', pieza(data?.fotoUrl ?? data?.foto ?? data?.imagen)],
        ['audio', pieza(data?.audioData ?? data?.audio)],
      ].filter(([, p]) => p && /^data:/.test(p.contenido));
      if (!piezas.length) {
        const tieneAlgo = data && Object.values(data).some((v) => v);
        if (tieneAlgo) raros.push(a.id); else vacios++;
        continue;
      }
      for (const [tipo, p] of piezas) {
        const mime = (p.contenido.match(/^data:([^;,]+)/) || [])[1] || null;
        await h.q(
          'INSERT INTO adjuntos (actividad_id, tipo, nombre_archivo, mime_type, tamanio_kb, contenido) VALUES (?, ?, ?, ?, ?, ?)',
          [a.id, tipo, p.nombre ? String(p.nombre).slice(0, 200) : null, mime, Math.ceil((p.contenido.length * 3) / 4 / 1024), p.contenido]
        );
        n++;
      }
    }
    if (vacios) log(`${vacios} actividades tenían el campo de adjunto vacío (sin foto ni audio): no hay nada que migrar.`);
    if (raros.length) log(`Atención: actividades con adjunto en un formato no reconocido (queda en _bak_v1_actividades): ${raros.join(', ')}.`);
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
  // El contacto de la tarea pasa a ser un vínculo a contactos (decisión P-7).
  await h.addColumn('tareas', 'contacto_id', 'INT NULL', 'empresa_id');
  await h.addColumn('tareas', 'creado_por_id', 'VARCHAR(20) NULL');
  if (await h.hasColumn('tareas', 'empresa')) {
    const buscar = await buscadorEmpresa(h);
    const contactos = await h.rows('SELECT id, nombre_apellido, empresa_id FROM contactos');
    const porNombre = indicePorNombre(contactos, 'nombre_apellido');
    let conEmpresa = 0;
    let conContacto = 0;
    for (const t of await h.rows('SELECT id, empresa, contacto FROM tareas')) {
      const m = t.empresa ? buscar(t.empresa) : null;
      let contactoId = null;
      let empresaId = m?.empresaId || null;
      if (t.contacto && String(t.contacto).trim()) {
        const cands = porNombre.get(claveNombre(t.contacto)) || [];
        // Si hay empresa, el contacto tiene que ser de esa empresa; si no, debe ser único.
        const elegidos = empresaId ? cands.filter((c) => c.empresa_id === empresaId) : cands;
        if (elegidos.length === 1) {
          contactoId = elegidos[0].id;
          empresaId = empresaId || elegidos[0].empresa_id || null;
        }
      }
      if (!contactoId && m?.contactoId) contactoId = m.contactoId;
      if (empresaId || contactoId) {
        await h.q('UPDATE tareas SET empresa_id = ?, contacto_id = ? WHERE id = ?', [empresaId, contactoId, t.id]);
        if (empresaId) conEmpresa++;
        if (contactoId) conContacto++;
      }
    }
    log(`Tareas vinculadas: ${conEmpresa} con empresa, ${conContacto} con contacto.`);
  }
  await h.setExacto('tareas', 'estado', `CASE WHEN LOWER(estado) IN ('finalizada', 'completada', 'completa', 'hecha') THEN 'Finalizada'
                                              WHEN LOWER(estado) = 'cancelada' THEN 'Cancelada' ELSE 'Pendiente' END`);
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
    const [r] = await h.q(`UPDATE tareas SET notas = CONCAT(IF(notas IS NULL OR notas = '', '', CONCAT(notas, '\\n')), 'Contacto: ', contacto)
                            WHERE contacto_id IS NULL AND contacto IS NOT NULL AND TRIM(contacto) <> ''`);
    if (r.affectedRows) log(`${r.affectedRows} tareas con un contacto que no está cargado: el nombre quedó en las notas.`);
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
  await h.addIndex('tareas', 'ix_tareas_contacto', ['contacto_id']);

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
