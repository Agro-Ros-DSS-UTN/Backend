// Usuarios (rol único con zona asignada) + Provincia/Localidad con clave propia.
// Antes de renombrar columnas se sueltan todas las FKs del esquema v1;
// la migración 0009 crea las FKs v2 con sus reglas de integridad.

export const descripcion = 'Usuarios, provincias y localidades (clave propia, zona del vendedor)';

export const up = async ({ h, log }) => {
  await h.dropAllForeignKeys();
  log('FKs v1 eliminadas (se recrean en 0009).');

  // ── usuarios ──
  await h.renameColumn('usuarios', 'direccion_mail', 'email');
  await h.renameColumn('usuarios', 'password', 'password_hash');
  await h.renameColumn('usuarios', 'account_statement', 'estado_cuenta');
  await h.renameColumn('usuarios', 'role', 'rol');
  await h.addColumn('usuarios', 'telefono', 'VARCHAR(30) NULL', 'email');
  await h.addColumn('usuarios', 'fecha_ingreso', 'DATE NULL');
  await h.addColumn('usuarios', 'fecha_alta', 'DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
  await h.addColumn('usuarios', 'ultimo_acceso', 'DATETIME NULL');
  // Se incrementa al cambiar contraseña, rol o estado: invalida los tokens viejos.
  await h.addColumn('usuarios', 'token_version', 'INT NOT NULL DEFAULT 0');

  const [roles] = await h.q("SELECT rol, COUNT(*) AS n FROM usuarios GROUP BY rol");
  log(`Roles antes de normalizar: ${roles.map((r) => `${r.rol}=${r.n}`).join(', ') || '(sin usuarios)'}`);
  await h.q(`UPDATE usuarios SET rol = 'administrador'
              WHERE LOWER(TRIM(rol)) IN ('admin', 'administrador', 'administracion', 'administración', 'administradora')`);
  // Cualquier valor desconocido queda con el rol de menor privilegio.
  await h.q("UPDATE usuarios SET rol = 'vendedor' WHERE rol <> 'administrador'");
  await h.q("UPDATE usuarios SET estado_cuenta = 'Inactivo' WHERE LOWER(TRIM(estado_cuenta)) IN ('inactivo', 'baja', 'suspendido', 'bloqueado')");
  await h.q("UPDATE usuarios SET estado_cuenta = 'Activo' WHERE estado_cuenta <> 'Inactivo'");
  await h.modifyColumn('usuarios', 'rol', { type: 'VARCHAR(20)', default: "'vendedor'" });
  await h.modifyColumn('usuarios', 'estado_cuenta', { type: 'VARCHAR(20)', default: "'Activo'" });

  // ── provincias ──
  await h.renameColumn('provincias', 'nom_provincia', 'nombre');
  // El id pasa a ser el código oficial de georef (datos.gob.ar); deja de ser autoincremental.
  await h.modifyColumn('provincias', 'id', { extra: '' });

  // ── localidades: la clave deja de ser el código postal ──
  if (!(await h.hasColumn('localidades', 'id'))) {
    await h.addColumn('localidades', 'id', 'VARCHAR(20) NULL', null);
    // Las localidades cargadas a mano conservan un id sintético "cp-<código postal>".
    // scripts/seed-localidades.mjs las une con las oficiales y reasigna las empresas.
    await h.q("UPDATE localidades SET id = CONCAT('cp-', cod_postal)");
    await h.q('ALTER TABLE localidades DROP PRIMARY KEY');
    await h.q('ALTER TABLE localidades MODIFY id VARCHAR(20) NOT NULL');
    await h.q('ALTER TABLE localidades ADD PRIMARY KEY (id)');
  }
  await h.renameColumn('localidades', 'cod_postal', 'codigo_postal', { nullable: true });
  await h.renameColumn('localidades', 'nom_localidad', 'nombre');
  await h.renameColumn('localidades', 'province_id', 'provincia_id');
  await h.addColumn('localidades', 'provincia_id', 'INT NULL');
  await h.addColumn('localidades', 'latitud', 'DECIMAL(10,7) NULL');
  await h.addColumn('localidades', 'longitud', 'DECIMAL(10,7) NULL');
  await h.addIndex('localidades', 'ix_localidades_codigo_postal', ['codigo_postal']);
  await h.addIndex('localidades', 'ix_localidades_nombre', ['nombre']);

  // La empresa pasa a apuntar a localidades.id
  if (await h.hasColumn('empresas_clientes', 'locality_cod_postal')) {
    await h.addColumn('empresas_clientes', 'localidad_id', 'VARCHAR(20) NULL');
    await h.q("UPDATE empresas_clientes SET localidad_id = CONCAT('cp-', locality_cod_postal) WHERE locality_cod_postal IS NOT NULL");
    await h.dropColumn('empresas_clientes', 'locality_cod_postal');
  }

  // ── zona asignada del vendedor ──
  await h.createTable('usuario_localidades', `
    usuario_id VARCHAR(20) NOT NULL,
    localidad_id VARCHAR(20) NOT NULL,
    PRIMARY KEY (usuario_id, localidad_id)`);

  log(`usuarios=${await h.count('usuarios')}, localidades=${await h.count('localidades')}, provincias=${await h.count('provincias')}`);
};
