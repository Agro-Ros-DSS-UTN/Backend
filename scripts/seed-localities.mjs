#!/usr/bin/env node
// Carga las provincias y localidades oficiales de Argentina (API Georef del
// Estado, datos.gob.ar) y une con ellas las localidades cargadas a mano antes
// de la v2 (id "cp-<código postal>" o "m-…"), conservando su código postal.
//
// Por defecto carga las 7 provincias de trabajo (decisión P-9): Santa Fe, Córdoba,
// Buenos Aires, Entre Ríos, Corrientes, San Juan y San Luis. Las 24 provincias se
// dan de alta siempre (son pocas filas), pero las localidades solo de esas 7.
//
//   node scripts/seed-localities.mjs --dry-run      → muestra qué haría, sin escribir
//   node scripts/seed-localities.mjs                → las 7 provincias de trabajo
//   node scripts/seed-localities.mjs --provinces=82,06,14   → solo esas provincias
//   node scripts/seed-localities.mjs --all          → todo el país
//   npm run seed:localities:rehearsal               → lo mismo, sobre la base de ENSAYO (REHEARSAL_DB_* del .env)
//   node scripts/seed-localities.mjs --provinces-only        → sin internet: solo las 24 provincias
//   node scripts/seed-localities.mjs --file=localidades.json → desde un JSON descargado de Georef
//
// Se puede correr varias veces: no duplica ni borra datos de empresas.
import 'dotenv/config';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const DRY = Boolean(args['dry-run']);

// --rehearsal: trabaja sobre la base de ensayo en vez de la del .env (producción).
if (args.rehearsal) {
  if (!process.env.REHEARSAL_DB_NAME || process.env.REHEARSAL_DB_NAME === process.env.DB_NAME) {
    console.error('Falta REHEARSAL_DB_NAME en el .env (o es igual a DB_NAME).');
    process.exit(1);
  }
  for (const k of ['NAME', 'USER', 'PASS', 'HOST', 'PORT']) if (process.env[`REHEARSAL_DB_${k}`]) process.env[`DB_${k}`] = process.env[`REHEARSAL_DB_${k}`];
  console.log(`[ensayo] Base: ${process.env.DB_NAME}`);
}
const { default: sequelize } = await import('../src/config/database.js');
const PREFERRED = Number(args['preferred-province'] || 82); // Santa Fe

// Códigos INDEC (los mismos que usa Georef).
const PROVINCES = [
  [2, 'Ciudad Autónoma de Buenos Aires'], [6, 'Buenos Aires'], [10, 'Catamarca'], [14, 'Córdoba'], [18, 'Corrientes'],
  [22, 'Chaco'], [26, 'Chubut'], [30, 'Entre Ríos'], [34, 'Formosa'], [38, 'Jujuy'], [42, 'La Pampa'], [46, 'La Rioja'],
  [50, 'Mendoza'], [54, 'Misiones'], [58, 'Neuquén'], [62, 'Río Negro'], [66, 'Salta'], [70, 'San Juan'], [74, 'San Luis'],
  [78, 'Santa Cruz'], [82, 'Santa Fe'], [86, 'Santiago del Estero'], [90, 'Tucumán'], [94, 'Tierra del Fuego, Antártida e Islas del Atlántico Sur'],
];

// P-9: provincias de trabajo (códigos INDEC).
const WORK_PROVINCES = [82, 14, 6, 30, 18, 70, 74];

// Provincias posibles según el código postal (numérico de 4 dígitos). Solo se usa
// para desempatar cuando una localidad manual tiene el mismo nombre en varias
// provincias (ej. "Casilda"); nunca descarta una coincidencia única.
const POSTAL_CODE_RANGES = [
  [1000, 1499, [2]], [1500, 1999, [6]], [2000, 2399, [82]], [2400, 2499, [14, 82]], [2500, 2699, [82, 14]],
  [2700, 2799, [6, 82]], [2800, 2999, [6, 30, 82]], [3000, 3099, [82]], [3100, 3299, [30]], [3300, 3399, [54]],
  [3400, 3499, [18]], [3500, 3549, [22]], [3550, 3599, [82, 22]], [3600, 3699, [34]], [4000, 4999, [90, 66, 38, 10, 86]],
  [5000, 5299, [14]], [5300, 5399, [46, 14]], [5400, 5499, [70]], [5500, 5699, [50]], [5700, 5799, [74]],
  [5800, 5999, [14]], [6000, 6299, [6, 14]], [6300, 6399, [42]], [6400, 8199, [6]], [8200, 8299, [42]],
  [8300, 8399, [58, 62]], [8400, 8599, [62]], [9000, 9299, [26]], [9300, 9499, [78, 94]],
];
const provincesByCp = (cp) => {
  const n = Number(String(cp || '').replace(/\D/g, '').slice(0, 4));
  return POSTAL_CODE_RANGES.find(([a, b]) => n >= a && n <= b)?.[2] || null;
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const q = (sql, replacements) => sequelize.query(sql, { replacements, raw: true });
const rows = async (sql, r) => (await q(sql, r))[0];
const changes = [];
const exec = async (desc, sql, r) => {
  changes.push(desc);
  if (!DRY) await q(sql, r);
};

const downloadLocalities = async (provinces) => {
  const base = 'https://apis.datos.gob.ar/georef/api/localidades';
  const all = [];
  const listing = provinces?.length ? provinces : [null];
  for (const p of listing) {
    const url = `${base}?max=5000&campos=id,nombre,provincia.id,centroide.lat,centroide.lon${p ? `&provincia=${p}` : ''}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Georef respondió ${res.status}`);
    const data = await res.json();
    all.push(...(data.localidades || [])); // la API de Georef responde con nombres en español
  }
  return all.map((l) => ({
    id: String(l.id),
    name: l.nombre,
    provinceId: Number(l.provincia?.id),
    latitude: l.centroide?.lat ?? null,
    longitude: l.centroide?.lon ?? null,
  }));
};

try {
  // ── Provincias: ids oficiales. Las existentes se renumeran (ON UPDATE CASCADE) ──
  const existing = await rows('SELECT id, name FROM provinces');
  const officialByName = new Map(PROVINCES.map(([id, n]) => [norm(n), id]));
  officialByName.set('caba', 2);
  officialByName.set('capital federal', 2);
  officialByName.set('tierra del fuego', 94);
  // Primero se apartan los ids que chocan, para poder renumerar sin conflictos.
  for (const p of existing) {
    const official = officialByName.get(norm(p.name));
    if (official && official !== p.id) await exec(`provincia "${p.name}" ${p.id} → temporal`, 'UPDATE provinces SET id = ? WHERE id = ?', [100000 + p.id, p.id]);
  }
  for (const p of existing) {
    const official = officialByName.get(norm(p.name));
    if (!official || official === p.id) continue;
    const alreadyExists = (await rows('SELECT id FROM provinces WHERE id = ?', [official])).length;
    if (alreadyExists && !DRY) {
      await exec(`provincia "${p.name}" duplicada: localidades a ${official}`, 'UPDATE localities SET province_id = ? WHERE province_id = ?', [official, 100000 + p.id]);
      await exec(`provincia duplicada ${p.id} eliminada`, 'DELETE FROM provinces WHERE id = ?', [100000 + p.id]);
    } else {
      await exec(`provincia "${p.name}" ${p.id} → ${official}`, 'UPDATE provinces SET id = ? WHERE id = ?', [official, 100000 + p.id]);
    }
  }
  for (const [id, name] of PROVINCES) {
    await exec(`provincia ${id} ${name}`, 'INSERT INTO provinces (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [id, name]);
  }

  if (args['provinces-only']) {
    console.log(`${DRY ? '[simulación] ' : ''}Provincias listas (${PROVINCES.length}).`);
  } else {
    const filter = args.all ? null : typeof args.provinces === 'string' ? args.provinces.split(',').map(Number).filter(Boolean) : WORK_PROVINCES;
    console.log(filter ? `Provincias: ${filter.map((id) => PROVINCES.find((p) => p[0] === id)?.[1] || id).join(', ')}.` : 'Provincias: todo el país.');
    let official;
    if (typeof args.file === 'string') {
      const data = JSON.parse(fs.readFileSync(args.file, 'utf8'));
      official = (data.localidades || data).map((l) => ({
        id: String(l.id), name: l.nombre ?? l.name, provinceId: Number(l.provincia?.id ?? l.provinceId),
        latitude: l.centroide?.lat ?? l.latitude ?? null, longitude: l.centroide?.lon ?? l.longitude ?? null,
      })).filter((l) => !filter || filter.includes(l.provinceId));
    } else {
      console.log('Descargando localidades de Georef (datos.gob.ar)…');
      official = await downloadLocalities(filter);
    }
    // Georef repite algunas ciudades como "entidad" (id de 10 dígitos) además de la
    // localidad (8 dígitos): se deja solo la localidad para no duplicar el selector.
    const withLocality = new Set(official.filter((l) => l.id.length === 8).map((l) => `${norm(l.name)}|${l.provinceId}`));
    const before = official.length;
    official = official.filter((l) => !(l.id.length === 10 && withLocality.has(`${norm(l.name)}|${l.provinceId}`)));
    console.log(`${official.length} localidades oficiales recibidas${before > official.length ? ` (${before - official.length} duplicadas como "entidad" descartadas)` : ''}.`);

    // ── Unir las localidades manuales con la oficial equivalente ──
    const byName = new Map();
    for (const l of official) {
      const k = norm(l.name);
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(l);
    }
    const manual = await rows("SELECT id, name, postal_code, province_id FROM localities WHERE id LIKE 'cp-%' OR id LIKE 'm-%'");
    const unmerged = [];
    for (const m of manual) {
      let candidates = byName.get(norm(m.name)) || [];
      if (m.province_id && candidates.length > 1) candidates = candidates.filter((c) => c.provinceId === Number(m.province_id));
      if (candidates.length > 1) {
        // Misma localidad partida en componentes: se prefiere la de 8 dígitos (localidad) a la entidad.
        const simple = candidates.filter((c) => c.id.length === 8);
        if (simple.length === 1) candidates = simple;
      }
      if (candidates.length > 1) {
        const possible = provincesByCp(m.postal_code);
        const byPostalCode = possible ? candidates.filter((c) => possible.includes(c.provinceId)) : [];
        if (byPostalCode.length === 1) candidates = byPostalCode;
      }
      if (candidates.length > 1) {
        const preferred = candidates.filter((c) => c.provinceId === PREFERRED);
        if (preferred.length === 1) candidates = preferred;
      }
      if (candidates.length !== 1) { unmerged.push(`${m.name} (${m.id}: ${candidates.length} coincidencias)`); continue; }
      const o = candidates[0];
      const alreadyExists = (await rows('SELECT id FROM localities WHERE id = ?', [o.id])).length;
      if (!alreadyExists) {
        // Renombrar la clave: empresas y zonas se actualizan solas (ON UPDATE CASCADE).
        await exec(`${m.name}: ${m.id} → ${o.id}`, 'UPDATE localities SET id = ?, name = ?, province_id = ?, latitude = ?, longitude = ? WHERE id = ?',
          [o.id, o.name, o.provinceId, o.latitude, o.longitude, m.id]);
      } else {
        await exec(`${m.name}: empresas de ${m.id} a ${o.id}`, 'UPDATE companies SET locality_id = ? WHERE locality_id = ?', [o.id, m.id]);
        await exec(`${m.name}: zonas de ${m.id} a ${o.id}`, 'UPDATE IGNORE user_localities SET locality_id = ? WHERE locality_id = ?', [o.id, m.id]);
        await exec(`${m.name}: código postal a ${o.id}`, 'UPDATE localities SET postal_code = COALESCE(postal_code, ?) WHERE id = ?', [m.postal_code, o.id]);
        await exec(`${m.name}: ${m.id} eliminada (duplicada)`, 'DELETE FROM localities WHERE id = ? AND NOT EXISTS (SELECT 1 FROM companies WHERE locality_id = ?)', [m.id, m.id]);
      }
    }

    // ── Alta de las oficiales que faltan (en lotes) ──
    const current = new Set((await rows('SELECT id FROM localities')).map((r) => r.id));
    const added = official.filter((l) => !current.has(l.id));
    for (let i = 0; i < added.length; i += 500) {
      const batch = added.slice(i, i + 500);
      await exec(`${batch.length} localidades nuevas`, `INSERT IGNORE INTO localities (id, name, province_id, latitude, longitude) VALUES ${batch.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
        batch.flatMap((l) => [l.id, l.name, l.provinceId, l.latitude, l.longitude]));
    }
    console.log(`${DRY ? '[simulación] ' : ''}${manual.length - unmerged.length} localidades manuales unidas, ${added.length} oficiales agregadas.`);
    if (unmerged.length) console.log(`Quedan para revisar a mano (Empresas → Localidad):\n  - ${unmerged.join('\n  - ')}`);
  }
  if (DRY) console.log(`\n[simulación] ${changes.length} operaciones. Primeras:\n  ${changes.slice(0, 30).join('\n  ')}`);
} catch (e) {
  console.error('Error:', e.message);
  if (/fetch|ENOTFOUND|Georef/i.test(e.message)) console.error('Sin acceso a Georef: podés correr con --provinces-only y cargar localidades después.');
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
