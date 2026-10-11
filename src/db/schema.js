// Helpers de DDL idempotentes para MySQL / MariaDB.
// Cada operación primero consulta information_schema, así una migración que
// falló a mitad de camino se puede volver a ejecutar sin romper nada.

export const createSchemaHelpers = (sequelize) => {
  const db = sequelize.config.database;

  const q = (sql, replacements) => sequelize.query(sql, { replacements, raw: true });
  const rows = async (sql, replacements) => (await sequelize.query(sql, { replacements, raw: true }))[0];
  const one = async (sql, replacements) => (await rows(sql, replacements))[0];
  const esc = (v) => sequelize.escape(v);
  const id = (name) => `\`${String(name).replace(/`/g, '')}\``;

  const hasTable = async (table) =>
    Boolean(await one('SELECT 1 AS x FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [db, table]));

  const getColumn = (table, column) =>
    one(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_KEY
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [db, table, column]
    );

  const hasColumn = async (table, column) => Boolean(await getColumn(table, column));

  const columns = async (table) =>
    (await rows('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [db, table])).map(
      (r) => r.COLUMN_NAME
    );

  const count = async (table, where = '1=1') => Number((await one(`SELECT COUNT(*) AS n FROM ${id(table)} WHERE ${where}`)).n);

  const renameTable = async (from, to) => {
    if ((await hasTable(from)) && !(await hasTable(to))) await q(`RENAME TABLE ${id(from)} TO ${id(to)}`);
  };

  // Arma la definición de una columna existente para usarla en un CHANGE.
  const columnDefinition = (col, overrides = {}) => {
    const type = overrides.type || col.COLUMN_TYPE;
    const nullable = overrides.nullable !== undefined ? overrides.nullable : col.IS_NULLABLE === 'YES';
    let def = `${type}${nullable ? ' NULL' : ' NOT NULL'}`;
    let dflt = overrides.default !== undefined ? overrides.default : col.COLUMN_DEFAULT;
    if (dflt !== null && dflt !== undefined && overrides.default === undefined) {
      const s = String(dflt);
      if (s.toUpperCase() === 'NULL') dflt = null;
      else if (/^current_timestamp/i.test(s) || /^'.*'$/.test(s) || /^-?\d+(\.\d+)?$/.test(s)) dflt = s;
      else dflt = sequelize.escape(s);
    }
    if (dflt !== null && dflt !== undefined) def += ` DEFAULT ${dflt}`;
    const extra = String(overrides.extra !== undefined ? overrides.extra : col.EXTRA || '');
    if (/auto_increment/i.test(extra)) def += ' AUTO_INCREMENT';
    return def;
  };

  const renameColumn = async (table, from, to, overrides) => {
    if (!(await hasTable(table))) return;
    const col = await getColumn(table, from);
    if (!col || (await hasColumn(table, to))) return;
    await q(`ALTER TABLE ${id(table)} CHANGE ${id(from)} ${id(to)} ${columnDefinition(col, overrides)}`);
  };

  const modifyColumn = async (table, column, overrides) => {
    const col = await getColumn(table, column);
    if (!col) return;
    await q(`ALTER TABLE ${id(table)} MODIFY ${id(column)} ${columnDefinition(col, overrides)}`);
  };

  const addColumn = async (table, column, definition, after) => {
    if (await hasColumn(table, column)) return false;
    await q(`ALTER TABLE ${id(table)} ADD COLUMN ${id(column)} ${definition}${after ? ` AFTER ${id(after)}` : ''}`);
    return true;
  };

  const dropColumn = async (table, column) => {
    if (!(await hasColumn(table, column))) return;
    await dropForeignKeysOn(table, column);
    await dropIndexesOn(table, column);
    await q(`ALTER TABLE ${id(table)} DROP COLUMN ${id(column)}`);
  };

  const foreignKeys = (table) =>
    rows(
      `SELECT DISTINCT k.CONSTRAINT_NAME AS name, k.TABLE_NAME AS tableName, k.COLUMN_NAME AS columnName
         FROM information_schema.KEY_COLUMN_USAGE k
         JOIN information_schema.REFERENTIAL_CONSTRAINTS r
           ON r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.TABLE_NAME = k.TABLE_NAME
        WHERE k.TABLE_SCHEMA = ? ${table ? 'AND k.TABLE_NAME = ?' : ''} AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
      table ? [db, table] : [db]
    );

  const dropForeignKeysOn = async (table, column) => {
    for (const fk of await foreignKeys(table)) {
      if (!column || fk.columnName === column) {
        await q(`ALTER TABLE ${id(fk.tableName)} DROP FOREIGN KEY ${id(fk.name)}`).catch(() => {});
      }
    }
  };

  const dropAllForeignKeys = async () => {
    for (const fk of await foreignKeys()) {
      await q(`ALTER TABLE ${id(fk.tableName)} DROP FOREIGN KEY ${id(fk.name)}`).catch(() => {});
    }
  };

  const indexes = (table) =>
    rows(
      `SELECT INDEX_NAME AS name, NON_UNIQUE AS nonUnique, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
         FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        GROUP BY INDEX_NAME, NON_UNIQUE`,
      [db, table]
    );

  const dropIndexesOn = async (table, column) => {
    for (const ix of await indexes(table)) {
      if (ix.name === 'PRIMARY') continue;
      if (String(ix.cols).split(',').includes(column)) {
        await q(`ALTER TABLE ${id(table)} DROP INDEX ${id(ix.name)}`).catch(() => {});
      }
    }
  };

  const addIndex = async (table, name, cols, { unique = false } = {}) => {
    if ((await indexes(table)).some((ix) => ix.name === name)) return;
    await q(`ALTER TABLE ${id(table)} ADD ${unique ? 'UNIQUE ' : ''}INDEX ${id(name)} (${cols.map(id).join(', ')})`);
  };

  const addForeignKey = async (table, column, refTable, refColumn, { onDelete = 'RESTRICT', onUpdate = 'CASCADE', name } = {}) => {
    const fkName = name || `fk_${table}_${column}`.slice(0, 64);
    if ((await foreignKeys(table)).some((fk) => fk.name === fkName)) return;
    await q(
      `ALTER TABLE ${id(table)} ADD CONSTRAINT ${id(fkName)} FOREIGN KEY (${id(column)})
         REFERENCES ${id(refTable)} (${id(refColumn)}) ON DELETE ${onDelete} ON UPDATE ${onUpdate}`
    );
  };

  const primaryKey = async (table) =>
    (await rows(
      `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION`,
      [db, table]
    )).map((r) => r.COLUMN_NAME);

  // Juego de caracteres único para toda la base. MySQL/MariaDB rechazan una FK entre
  // VARCHAR con collation distinta y dan "Illegal mix of collations" al comparar
  // columnas de tablas creadas en distintos momentos. Se usa el de la base si es
  // utf8mb4; si no, utf8mb4_unicode_ci.
  let destino;
  const targetCollation = async () => {
    if (destino) return destino;
    const r = await one('SELECT DEFAULT_CHARACTER_SET_NAME AS cs, DEFAULT_COLLATION_NAME AS co FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [db]);
    destino = r?.cs === 'utf8mb4' ? { cs: r.cs, co: r.co } : { cs: 'utf8mb4', co: 'utf8mb4_unicode_ci' };
    return destino;
  };

  // Convierte al juego de caracteres único las tablas (o columnas) que difieran.
  // Debe correrse sin FKs (las FKs v1 se sueltan antes en 0003).
  const normalizeCollation = async () => {
    const { cs, co } = await targetCollation();
    const distintas = await rows(
      `SELECT DISTINCT t.TABLE_NAME AS t FROM information_schema.TABLES t
         LEFT JOIN information_schema.COLUMNS c
           ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME AND c.COLLATION_NAME IS NOT NULL AND c.COLLATION_NAME <> ?
        WHERE t.TABLE_SCHEMA = ? AND t.TABLE_TYPE = 'BASE TABLE' AND t.TABLE_NAME NOT LIKE '\\_bak\\_%'
          AND (t.TABLE_COLLATION <> ? OR c.COLUMN_NAME IS NOT NULL)`,
      [co, db, co]
    );
    for (const { t } of distintas) await q(`ALTER TABLE ${id(t)} CONVERT TO CHARACTER SET ${cs} COLLATE ${co}`);
    return { tablas: distintas.map((r) => r.t), collation: co };
  };

  const createTable = async (table, body) => {
    if (await hasTable(table)) return false;
    const { cs, co } = await targetCollation();
    await q(`CREATE TABLE ${id(table)} (\n${body}\n) ENGINE=InnoDB DEFAULT CHARSET=${cs} COLLATE=${co}`);
    return true;
  };

  const dropTable = async (table) => {
    if (!(await hasTable(table))) return;
    // Primero se sueltan las FKs que apuntan a esta tabla.
    const refs = await rows(
      `SELECT CONSTRAINT_NAME AS name, TABLE_NAME AS tableName FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME = ?`,
      [db, table]
    );
    for (const r of refs) await q(`ALTER TABLE ${id(r.tableName)} DROP FOREIGN KEY ${id(r.name)}`).catch(() => {});
    await q(`DROP TABLE ${id(table)}`);
  };

  // Reescribe una columna con el valor de `expr` aunque solo cambien mayúsculas o
  // acentos ('activo' → 'Activo', 'Reunión' → 'reunion'). Con collation *_ci esos
  // valores son "iguales" y el motor puede no escribir el cambio; por eso se pasa
  // por un valor intermedio con un carácter de control adelante.
  const setExacto = async (table, column, expr, where = '1=1') => {
    const marca = 'CHAR(1 USING utf8mb4)';
    await q(`UPDATE ${id(table)} SET ${id(column)} = CONCAT(${marca}, ${expr}) WHERE ${where}`);
    await q(`UPDATE ${id(table)} SET ${id(column)} = SUBSTRING(${id(column)}, 2) WHERE LEFT(${id(column)}, 1) = ${marca}`);
  };

  // Copia una tabla completa a _bak_v1_<tabla> (estructura + datos, sin FKs).
  const backupTable = async (table, prefix = '_bak_v1_') => {
    const target = `${prefix}${table}`.slice(0, 64);
    if (!(await hasTable(table)) || (await hasTable(target))) return null;
    await q(`CREATE TABLE ${id(target)} LIKE ${id(table)}`);
    await q(`INSERT INTO ${id(target)} SELECT * FROM ${id(table)}`);
    return target;
  };

  return {
    q, rows, one, id, esc, db,
    hasTable, getColumn, hasColumn, columns, count,
    renameTable, renameColumn, modifyColumn, addColumn, dropColumn,
    foreignKeys, dropForeignKeysOn, dropAllForeignKeys,
    indexes, addIndex, dropIndexesOn, addForeignKey, primaryKey,
    createTable, dropTable, backupTable, targetCollation, normalizeCollation, setExacto,
  };
};
