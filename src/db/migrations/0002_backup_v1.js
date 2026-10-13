// Respaldo dentro de la misma base: copia cada tabla existente a _bak_v1_<tabla>
// (estructura + datos, sin FKs). Si algo sale mal en las migraciones siguientes,
// los datos originales quedan intactos acá. Se borran a mano cuando el equipo
// confirme que la v2 funciona (ver docs/MIGRACION_V2.md, paso "Limpieza").
//
// Este respaldo NO reemplaza un volcado completo (mysqldump / backup de Hostinger)
// antes de migrar producción.

export const description = 'Respaldo de todas las tablas v1 en _bak_v1_*';

export const up = async ({ h, log }) => {
  const tables = await h.rows(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
    [h.db]
  );
  let n = 0;
  for (const { t } of tables) {
    if (t === 'migraciones' || t.startsWith('_bak_')) continue;
    if ((await h.count(t)) === 0) continue; // tablas vacías: nada que respaldar
    const target = await h.backupTable(t);
    if (target) {
      n++;
      log(`${t} → ${target} (${await h.count(target)} filas)`);
    }
  }
  log(`${n} tablas respaldadas.`);
};

// No hay down: los respaldos se eliminan con la migración de limpieza manual.
