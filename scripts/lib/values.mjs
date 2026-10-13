// Revisa que los datos guardados cumplan lo que exige cada modelo: valores de las
// listas cerradas (isIn) con mayúsculas y acentos exactos, y campos obligatorios
// sin NULL. Un valor fuera de lista haría fallar cualquier edición de ese registro.
export const invalidValues = async (sequelize) => {
  const problems = [];
  const q = async (sql, replacements) => (await sequelize.query(sql, { replacements, raw: true }))[0];
  for (const model of Object.values(sequelize.models)) {
    const table = model.getTableName();
    for (const [name, attr] of Object.entries(model.getAttributes())) {
      if (attr.type?.key === 'VIRTUAL') continue;
      const col = `\`${attr.field || name}\``;
      const isIn = attr.validate?.isIn;
      const listing = Array.isArray(isIn) ? (Array.isArray(isIn[0]) ? isIn[0] : isIn) : isIn?.args?.[0];
      if (Array.isArray(listing) && listing.length) {
        const bad = await q(
          `SELECT CAST(${col} AS CHAR) AS v, COUNT(*) AS n FROM \`${table}\` WHERE ${col} IS NOT NULL AND BINARY ${col} NOT IN (${listing.map(() => '?').join(', ')}) GROUP BY v`,
          listing,
        );
        for (const m of bad) problems.push(`${table}.${attr.field || name}="${m.v}" (${m.n})`);
      }
      if (attr.allowNull === false && !attr.autoIncrement && !attr.primaryKey) {
        const [r] = await q(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE ${col} IS NULL`);
        if (Number(r.n)) problems.push(`${table}.${attr.field || name} con NULL (${r.n})`);
      }
    }
  }
  return problems;
};
