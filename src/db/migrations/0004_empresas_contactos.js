// EmpresaCliente → Empresa, Cliente → Contacto (clave numérica propia), cultivos.

export const descripcion = 'Empresas, contactos (id propio), teléfonos y cultivos';

export const up = async ({ h, log }) => {
  // ── empresas ──
  await h.renameTable('empresas_clientes', 'empresas');
  await h.renameColumn('empresas', 'nombre_empresa', 'razon_social');
  await h.renameColumn('empresas', 'desc_empresa', 'descripcion');
  await h.renameColumn('empresas', 'direccion_empresa', 'direccion', { nullable: true });
  await h.renameColumn('empresas', 'nivel_empresa', 'nivel');
  await h.renameColumn('empresas', 'parent_company_id', 'empresa_padre_id');
  await h.addColumn('empresas', 'nombre_fantasia', 'VARCHAR(150) NULL', 'razon_social');
  await h.addColumn('empresas', 'localidad_id', 'VARCHAR(20) NULL');
  await h.addColumn('empresas', 'latitud', 'DECIMAL(10,7) NULL');
  await h.addColumn('empresas', 'longitud', 'DECIMAL(10,7) NULL');
  await h.addColumn('empresas', 'fecha_baja', 'DATETIME NULL');
  // "Ruta Provincial" era un valor de relleno cuando no se cargaba dirección.
  await h.q("UPDATE empresas SET direccion = NULL WHERE TRIM(direccion) IN ('', 'Ruta Provincial')");
  await h.q('UPDATE empresas e LEFT JOIN usuarios u ON u.id_user = e.creado_por_id SET e.creado_por_id = NULL WHERE u.id_user IS NULL');
  await h.addIndex('empresas', 'ix_empresas_razon_social', ['razon_social']);
  await h.addIndex('empresas', 'ix_empresas_cuit', ['cuit']);

  // ── cultivos ──
  await h.renameTable('tipos_cultivo', 'cultivos');
  await h.renameColumn('cultivos', 'tipo_cultivo', 'nombre');
  await h.addColumn('cultivos', 'meses_necesidad', "VARCHAR(40) NULL COMMENT 'Meses separados por coma (1-12)'");
  await h.renameTable('empresa_tipo_cultivo', 'empresa_cultivos');
  await h.renameColumn('empresa_cultivos', 'client_company_id', 'empresa_id');
  await h.renameColumn('empresa_cultivos', 'cultivation_type_id', 'cultivo_id');

  // ── contactos ──
  await h.renameTable('clientes', 'contactos');
  if (!(await h.hasColumn('contactos', 'id'))) {
    await h.q('ALTER TABLE contactos DROP PRIMARY KEY, ADD COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST');
  }
  await h.renameColumn('contactos', 'num_doc', 'dni', { nullable: true });
  await h.renameColumn('contactos', 'tipo_client', 'cargo', { nullable: true });
  await h.renameColumn('contactos', 'direccion_mail', 'email');
  await h.renameColumn('contactos', 'nota', 'observaciones');
  await h.renameColumn('contactos', 'fecha_agregado', 'fecha_alta');
  await h.renameColumn('contactos', 'client_company_id', 'empresa_id');
  await h.addColumn('contactos', 'es_principal', 'TINYINT(1) NOT NULL DEFAULT 0');
  await h.addColumn('contactos', 'fecha_baja', 'DATETIME NULL');
  await h.dropColumn('contactos', 'codigo_postal');
  await h.dropColumn('contactos', 'locality_cod_postal');
  await h.addIndex('contactos', 'ix_contactos_dni', ['dni']);

  // ── teléfonos del contacto ──
  await h.renameTable('telefonos_cliente', 'contacto_telefonos');
  if (await h.hasColumn('contacto_telefonos', 'client_num_doc')) {
    await h.addColumn('contacto_telefonos', 'contacto_id', 'INT NULL', 'id');
    await h.q('UPDATE contacto_telefonos t JOIN contactos c ON c.dni = t.client_num_doc SET t.contacto_id = c.id');
    const huerfanos = await h.count('contacto_telefonos', 'contacto_id IS NULL');
    if (huerfanos) log(`${huerfanos} teléfonos sin contacto se eliminan (quedan en _bak_v1_telefonos_cliente).`);
    await h.q('DELETE FROM contacto_telefonos WHERE contacto_id IS NULL');
    await h.modifyColumn('contacto_telefonos', 'contacto_id', { nullable: false });
    await h.dropColumn('contacto_telefonos', 'client_num_doc');
  }
  await h.modifyColumn('contacto_telefonos', 'numero', { type: 'VARCHAR(30)' });

  log(`empresas=${await h.count('empresas')}, contactos=${await h.count('contactos')}, teléfonos=${await h.count('contacto_telefonos')}`);
};
