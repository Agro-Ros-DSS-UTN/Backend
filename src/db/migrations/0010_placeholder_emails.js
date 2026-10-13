// Emails de relleno → NULL.
// La carga inicial de contactos completó con direcciones inventadas
// ("no-email-10000180@ejemplo.com") a los que no tenían correo, y algunos
// empleados tienen valores como "2". Un email vacío tiene que quedar vacío:
// si no, se ve como dato real, se le pueden mandar correos y ensucia búsquedas.
//
// - Relleno evidente (@ejemplo.com, no-email, "-", "sin email"...): se borra.
// - Escrito pero inválido (sin @, con espacios...): se borra del campo y queda
//   copiado en las observaciones, por si era un dato real mal tipeado.
// Todo queda además en _bak_v1_* (respaldo de la migración 0002).

export const description = 'Emails de relleno o inválidos en contactos, empleados y usuarios → vacíos';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esRelleno = (e) => {
  const v = String(e).trim().toLowerCase();
  return !v || /@ejemplo\.(com|com\.ar)$/.test(v) || /^no[-_.]?e?-?mail/.test(v) || /^(sin|no tiene|n\/a|na|-+|\.+|0+)$/.test(v) || /@example\.com$/.test(v);
};

// tabla, columna de clave, columna de observaciones (o null si no tiene)
const TABLAS = [
  ['contactos', 'id', 'observaciones'],
  ['empleados', 'id', 'observaciones'],
  ['usuarios', 'id_user', null],
];

export const up = async ({ h, log }) => {
  for (const [tabla, pk, obs] of TABLAS) {
    if (!(await h.hasColumn(tabla, 'email'))) continue;
    const filas = await h.rows(`SELECT ${h.id(pk)} AS pk, email${obs ? `, ${h.id(obs)} AS obs` : ''} FROM ${h.id(tabla)} WHERE email IS NOT NULL`);
    let relleno = 0;
    let invalidos = 0;
    for (const f of filas) {
      const email = String(f.email);
      if (esRelleno(email)) {
        await h.q(`UPDATE ${h.id(tabla)} SET email = NULL WHERE ${h.id(pk)} = ?`, [f.pk]);
        relleno++;
      } else if (!EMAIL_OK.test(email.trim())) {
        if (obs) {
          const nota = `Email cargado antes (no válido): ${email.trim()}`;
          const nuevo = f.obs ? `${f.obs}\n${nota}` : nota;
          await h.q(`UPDATE ${h.id(tabla)} SET email = NULL, ${h.id(obs)} = ? WHERE ${h.id(pk)} = ?`, [nuevo, f.pk]);
        } else {
          await h.q(`UPDATE ${h.id(tabla)} SET email = NULL WHERE ${h.id(pk)} = ?`, [f.pk]);
        }
        invalidos++;
      } else if (email !== email.trim()) {
        await h.q(`UPDATE ${h.id(tabla)} SET email = ? WHERE ${h.id(pk)} = ?`, [email.trim(), f.pk]);
      }
    }
    log(`${tabla}: ${relleno} emails de relleno y ${invalidos} inválidos quedaron vacíos (de ${filas.length} con email).`);
  }
};

// No hay vuelta atrás automática: los valores originales están en _bak_v1_*.
