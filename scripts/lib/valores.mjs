// Revisa que los datos guardados cumplan lo que exige cada modelo: valores de las
// listas cerradas (isIn) con mayúsculas y acentos exactos, y campos obligatorios
// sin NULL. Un valor fuera de lista haría fallar cualquier edición de ese registro.
export const valoresInvalidos = async (sequelize) => {
  const problemas = [];
  const q = async (sql, replacements) => (await sequelize.query(sql, { replacements, raw: true }))[0];
  for (const model of Object.values(sequelize.models)) {
    const tabla = model.getTableName();
    for (const [nombre, attr] of Object.entries(model.getAttributes())) {
      if (attr.type?.key === 'VIRTUAL') continue;
      const col = `\`${attr.field || nombre}\``;
      const isIn = attr.validate?.isIn;
      const lista = Array.isArray(isIn) ? (Array.isArray(isIn[0]) ? isIn[0] : isIn) : isIn?.args?.[0];
      if (Array.isArray(lista) && lista.length) {
        const malos = await q(
          `SELECT CAST(${col} AS CHAR) AS v, COUNT(*) AS n FROM \`${tabla}\` WHERE ${col} IS NOT NULL AND BINARY ${col} NOT IN (${lista.map(() => '?').join(', ')}) GROUP BY v`,
          lista,
        );
        for (const m of malos) problemas.push(`${tabla}.${attr.field || nombre}="${m.v}" (${m.n})`);
      }
      if (attr.allowNull === false && !attr.autoIncrement && !attr.primaryKey) {
        const [r] = await q(`SELECT COUNT(*) AS n FROM \`${tabla}\` WHERE ${col} IS NULL`);
        if (Number(r.n)) problemas.push(`${tabla}.${attr.field || nombre} con NULL (${r.n})`);
      }
    }
  }
  return problemas;
};
