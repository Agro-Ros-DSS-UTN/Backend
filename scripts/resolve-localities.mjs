#!/usr/bin/env node
// Resuelve las localidades cargadas a mano que seed:localities no pudo unir solo
// (nombre escrito distinto o repetido en varias provincias) y ordena la tabla.
//
//   npm run localities:resolve              → muestra qué haría, sin escribir
//   npm run localities:resolve -- --apply   → lo aplica
//   (--rehearsal para trabajar sobre la base de ENSAYO del .env)
//
// Qué hace:
//  1. Une cada localidad manual con la oficial que corresponde (lista de abajo,
//     revisada contra la API Georef). Las empresas y zonas pasan a la oficial.
//  2. Para nombres repetidos en varias provincias (Villa Fontana, San Pedro) decide
//     con la dirección de las empresas y la característica telefónica de sus
//     contactos. Si no hay pistas claras, no toca nada y las muestra.
//  3. Las que no están en la lista oficial quedan como están, con su provincia
//     cuando se sabe.
//  4. Borra los códigos postales heredados de la v1: no eran reales (Firmat tenía
//     3005 en vez de 2630, Rojas 3012 en vez de 2705). Quedan en _bak_v1_localidades.
//  5. Quita duplicados de Georef: la misma ciudad cargada como "entidad" (id de 10
//     dígitos) además de la localidad (8 dígitos), si nadie la usa.
import 'dotenv/config';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const APPLY = Boolean(args.apply);
if (args.rehearsal) {
  if (!process.env.REHEARSAL_DB_NAME || process.env.REHEARSAL_DB_NAME === process.env.DB_NAME) {
    console.error('Falta REHEARSAL_DB_NAME en el .env (o es igual a DB_NAME).');
    process.exit(1);
  }
  for (const k of ['NAME', 'USER', 'PASS', 'HOST', 'PORT']) if (process.env[`REHEARSAL_DB_${k}`]) process.env[`DB_${k}`] = process.env[`REHEARSAL_DB_${k}`];
  console.log(`[ensayo] Base: ${process.env.DB_NAME}`);
}
const { default: sequelize } = await import('../src/config/database.js');

const PROVINCE = { 6: 'Buenos Aires', 14: 'Córdoba', 30: 'Entre Ríos', 82: 'Santa Fe' };
// Localidad oficial (Georef) para cada nombre cargado a mano.
const DECISIONS = [
  { name: 'Firmat', official: '82042120', note: 'la ciudad está en dos departamentos; se usa General López, donde está el casco urbano' },
  { name: 'Rojas', official: '06686060', note: 'la otra coincidencia era la misma ciudad cargada como "entidad"' },
  { name: 'Villa San Marcial', official: '30098150', note: 'nombre oficial: Villa San Marcial (Est. Gobernador Urquiza)' },
  { name: 'Monte de Oca', official: '82007050', note: 'nombre oficial: Montes de Oca' },
  { name: 'Puerto San Martín', official: '82119080', note: 'nombre oficial: Puerto General San Martín' },
  { name: 'Ascención', official: '06294020', note: 'nombre oficial: Ascensión' },
  { name: 'Villa Fontana', options: { '30084280': 30, '14105270': 14 } },
  { name: 'San Pedro', options: { '06770050': 6, '14126160': 14, '30028100': 30 } },
  { name: 'Estación Runciman', province: 82, note: 'no figura en Georef; se le asigna Santa Fe' },
  { name: 'La California', province: 82, note: 'no figura en Georef; se le asigna Santa Fe' },
  { name: 'Espinillo', note: 'no figura en Georef para las 7 provincias' },
  { name: 'Tarragona', note: 'no figura en Georef' },
];

// Pistas de provincia en un texto o en un teléfono.
const TEXT_PROVINCE = [
  [30, /entre\s*r[ií]os|\be\.?\s*r\.?\b|paran[aá]\b/i],
  [14, /c[oó]rdoba|\bcba\b/i],
  [6, /buenos\s*aires|\bbs\.?\s*as\b|\bpba\b/i],
  [82, /santa\s*fe|\bsta\.?\s*fe\b|rosario/i],
];
const provinceFromPhone = (phone) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('9')) d = d.slice(1);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length < 10) return null;
  if (/^(343|345|3436|3437|3438|344[2-7]|345[4-8])/.test(d)) return 30;
  if (/^(351|353|358|35[2-8]\d)/.test(d)) return 14;
  if (/^(3329|3364|3388|2\d\d)/.test(d) || /^11/.test(d)) return 6;
  if (/^(341|342|340\d|346\d|347\d|348\d|349\d|3400|3401|3402|3404|3405|3406|3407|3408|3409)/.test(d)) return 82;
  return null;
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const q = (sql, r) => sequelize.query(sql, { replacements: r, raw: true });
const rows = async (sql, r) => (await q(sql, r))[0];
const actions = [];
const run = async (desc, sql, r) => {
  actions.push(desc);
  if (APPLY) await q(sql, r);
};

try {
  console.log(APPLY ? 'Aplicando cambios.\n' : 'Simulación (no se escribe nada). Para aplicar: npm run localities:resolve -- --apply\n');
  const manual = await rows("SELECT id, name, province_id FROM localities WHERE id LIKE 'cp-%' OR id LIKE 'm-%'");
  const byName = new Map(manual.map((m) => [norm(m.name), m]));

  const merge = async (m, officialId, details) => {
    const of = (await rows('SELECT id, name, province_id FROM localities WHERE id = ?', [officialId]))[0];
    if (!of) {
      console.log(`  ✘ ${m.name}: la localidad oficial ${officialId} no está cargada (correr antes seed:localities).`);
      return;
    }
    const [{ n }] = await rows('SELECT COUNT(*) AS n FROM companies WHERE locality_id = ?', [m.id]);
    console.log(`  ✔ ${m.name} → ${of.name} (${PROVINCE[of.province_id] || of.province_id}) · ${n} empresa(s)${details ? ` · ${details}` : ''}`);
    await run(`empresas de ${m.id} → ${of.id}`, 'UPDATE companies SET locality_id = ? WHERE locality_id = ?', [of.id, m.id]);
    await run(`zonas de ${m.id} → ${of.id}`, 'UPDATE IGNORE user_localities SET locality_id = ? WHERE locality_id = ?', [of.id, m.id]);
    await run(`zonas sobrantes de ${m.id}`, 'DELETE FROM user_localities WHERE locality_id = ?', [m.id]);
    await run(`borrar ${m.id}`, 'DELETE FROM localities WHERE id = ?', [m.id]);
  };

  for (const d of DECISIONS) {
    const m = byName.get(norm(d.name));
    if (!m) continue; // ya resuelta o no existe en esta base
    if (d.official) { await merge(m, d.official, d.note); continue; }

    const companies = await rows('SELECT id, legal_name, address, description FROM companies WHERE locality_id = ?', [m.id]);
    if (d.options) {
      // Votos por provincia según direcciones y teléfonos de contactos.
      const votes = {};
      const clues = [];
      for (const e of companies) {
        const text = `${e.address || ''} ${e.description || ''}`;
        for (const [p, re] of TEXT_PROVINCE) if (re.test(text)) { votes[p] = (votes[p] || 0) + 2; clues.push(`"${e.legal_name}": dirección menciona ${PROVINCE[p]}`); }
        const phones = await rows('SELECT t.number FROM contact_phones t JOIN contacts c ON c.id = t.contact_id WHERE c.company_id = ?', [e.id]);
        for (const { number } of phones) {
          const p = provinceFromPhone(number);
          if (p) { votes[p] = (votes[p] || 0) + 1; clues.push(`"${e.legal_name}": teléfono ${number} (${PROVINCE[p]})`); }
        }
      }
      const candidates = Object.entries(d.options).filter(([, p]) => votes[p]);
      if (candidates.length === 1) {
        await merge(m, candidates[0][0], `elegida por: ${clues.filter((x) => x.includes(PROVINCE[candidates[0][1]])).join('; ')}`);
      } else {
        console.log(`  ? ${m.name}: existe en ${Object.values(d.options).map((p) => PROVINCE[p]).join(', ')} y no hay pistas claras. No se toca.`);
        for (const e of companies) console.log(`      - ${e.legal_name} · ${e.address || 'sin dirección'}`);
        if (clues.length) console.log(`      pistas: ${clues.join('; ')}`);
      }
      continue;
    }
    if (d.province && Number(m.province_id) !== d.province) {
      console.log(`  ~ ${m.name}: ${d.note}.`);
      await run(`provincia de ${m.id}`, 'UPDATE localities SET province_id = ? WHERE id = ?', [d.province, m.id]);
    } else {
      console.log(`  · ${m.name}: ${d.note}; queda como está (${companies.length} empresa(s)): ${companies.map((e) => e.legal_name).join(', ')}`);
    }
  }

  // Códigos postales heredados de la v1 (no eran reales). Georef no trae códigos postales.
  const [{ n: withPostalCode }] = await rows('SELECT COUNT(*) AS n FROM localities WHERE postal_code IS NOT NULL');
  if (withPostalCode) {
    console.log(`\n${withPostalCode} localidades tienen el código postal heredado de la v1 (no eran códigos reales): se borran.`);
    await run('borrar códigos postales v1', 'UPDATE localities SET postal_code = NULL WHERE postal_code IS NOT NULL');
  }

  // Duplicados de Georef: "entidad" (10 dígitos) con el mismo nombre y provincia que una localidad (8 dígitos).
  const dup = await rows(
    `SELECT e.id, e.name FROM localities e
       JOIN localities l ON l.name = e.name AND l.province_id = e.province_id AND l.id <> e.id AND LENGTH(l.id) = 8
      WHERE LENGTH(e.id) = 10 AND e.id REGEXP '^[0-9]+$'
        AND NOT EXISTS (SELECT 1 FROM companies x WHERE x.locality_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM user_localities z WHERE z.locality_id = e.id)`
  );
  if (dup.length) {
    console.log(`${dup.length} localidades repetidas de Georef (la misma ciudad como "entidad"): se quitan del selector.`);
    for (let i = 0; i < dup.length; i += 200) {
      const batch = dup.slice(i, i + 200).map((d) => d.id);
      await run(`${batch.length} duplicadas`, `DELETE FROM localities WHERE id IN (${batch.map(() => '?').join(', ')})`, batch);
    }
  }

  const [{ n: remaining }] = await rows("SELECT COUNT(*) AS n FROM localities WHERE id LIKE 'cp-%' OR id LIKE 'm-%'");
  console.log(`\n${APPLY ? 'Listo' : 'Simulación lista'}: ${actions.length} operaciones. Localidades cargadas a mano que quedarían: ${APPLY ? remaining : '(ver arriba)'}.`);
} catch (e) {
  console.error('Error:', e.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
