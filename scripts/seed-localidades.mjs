#!/usr/bin/env node
// Carga las provincias y localidades oficiales de Argentina (API Georef del
// Estado, datos.gob.ar) y une con ellas las localidades cargadas a mano antes
// de la v2 (id "cp-<código postal>" o "m-…"), conservando su código postal.
//
// Por defecto carga las 7 provincias de trabajo (decisión P-9): Santa Fe, Córdoba,
// Buenos Aires, Entre Ríos, Corrientes, San Juan y San Luis. Las 24 provincias se
// dan de alta siempre (son pocas filas), pero las localidades solo de esas 7.
//
//   node scripts/seed-localidades.mjs --dry-run      → muestra qué haría, sin escribir
//   node scripts/seed-localidades.mjs                → las 7 provincias de trabajo
//   node scripts/seed-localidades.mjs --provincias=82,06,14   → solo esas provincias
//   node scripts/seed-localidades.mjs --todas        → todo el país
//   node scripts/seed-localidades.mjs --solo-provincias       → sin internet: solo las 24 provincias
//   node scripts/seed-localidades.mjs --archivo=localidades.json → desde un JSON descargado de Georef
//
// Se puede correr varias veces: no duplica ni borra datos de empresas.
import fs from 'node:fs';
import sequelize from '../src/config/database.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const DRY = Boolean(args['dry-run']);
const PREFERIDA = Number(args['provincia-preferida'] || 82); // Santa Fe

// Códigos INDEC (los mismos que usa Georef).
const PROVINCIAS = [
  [2, 'Ciudad Autónoma de Buenos Aires'], [6, 'Buenos Aires'], [10, 'Catamarca'], [14, 'Córdoba'], [18, 'Corrientes'],
  [22, 'Chaco'], [26, 'Chubut'], [30, 'Entre Ríos'], [34, 'Formosa'], [38, 'Jujuy'], [42, 'La Pampa'], [46, 'La Rioja'],
  [50, 'Mendoza'], [54, 'Misiones'], [58, 'Neuquén'], [62, 'Río Negro'], [66, 'Salta'], [70, 'San Juan'], [74, 'San Luis'],
  [78, 'Santa Cruz'], [82, 'Santa Fe'], [86, 'Santiago del Estero'], [90, 'Tucumán'], [94, 'Tierra del Fuego, Antártida e Islas del Atlántico Sur'],
];

// P-9: provincias de trabajo (códigos INDEC).
const PROVINCIAS_TRABAJO = [82, 14, 6, 30, 18, 70, 74];

// Provincias posibles según el código postal (numérico de 4 dígitos). Solo se usa
// para desempatar cuando una localidad manual tiene el mismo nombre en varias
// provincias (ej. "Casilda"); nunca descarta una coincidencia única.
const RANGOS_CP = [
  [1000, 1499, [2]], [1500, 1999, [6]], [2000, 2399, [82]], [2400, 2499, [14, 82]], [2500, 2699, [82, 14]],
  [2700, 2799, [6, 82]], [2800, 2999, [6, 30, 82]], [3000, 3099, [82]], [3100, 3299, [30]], [3300, 3399, [54]],
  [3400, 3499, [18]], [3500, 3549, [22]], [3550, 3599, [82, 22]], [3600, 3699, [34]], [4000, 4999, [90, 66, 38, 10, 86]],
  [5000, 5299, [14]], [5300, 5399, [46, 14]], [5400, 5499, [70]], [5500, 5699, [50]], [5700, 5799, [74]],
  [5800, 5999, [14]], [6000, 6299, [6, 14]], [6300, 6399, [42]], [6400, 8199, [6]], [8200, 8299, [42]],
  [8300, 8399, [58, 62]], [8400, 8599, [62]], [9000, 9299, [26]], [9300, 9499, [78, 94]],
];
const provinciasPorCp = (cp) => {
  const n = Number(String(cp || '').replace(/\D/g, '').slice(0, 4));
  return RANGOS_CP.find(([a, b]) => n >= a && n <= b)?.[2] || null;
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const q = (sql, replacements) => sequelize.query(sql, { replacements, raw: true });
const rows = async (sql, r) => (await q(sql, r))[0];
const cambios = [];
const exec = async (desc, sql, r) => {
  cambios.push(desc);
  if (!DRY) await q(sql, r);
};

const descargarLocalidades = async (provincias) => {
  const base = 'https://apis.datos.gob.ar/georef/api/localidades';
  const todas = [];
  const lista = provincias?.length ? provincias : [null];
  for (const p of lista) {
    const url = `${base}?max=5000&campos=id,nombre,provincia.id,centroide.lat,centroide.lon${p ? `&provincia=${p}` : ''}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Georef respondió ${res.status}`);
    const data = await res.json();
    todas.push(...(data.localidades || []));
  }
  return todas.map((l) => ({
    id: String(l.id),
    nombre: l.nombre,
    provinciaId: Number(l.provincia?.id),
    latitud: l.centroide?.lat ?? null,
    longitud: l.centroide?.lon ?? null,
  }));
};

try {
  // ── Provincias: ids oficiales. Las existentes se renumeran (ON UPDATE CASCADE) ──
  const existentes = await rows('SELECT id, nombre FROM provincias');
  const oficialPorNombre = new Map(PROVINCIAS.map(([id, n]) => [norm(n), id]));
  oficialPorNombre.set('caba', 2);
  oficialPorNombre.set('capital federal', 2);
  oficialPorNombre.set('tierra del fuego', 94);
  // Primero se apartan los ids que chocan, para poder renumerar sin conflictos.
  for (const p of existentes) {
    const oficial = oficialPorNombre.get(norm(p.nombre));
    if (oficial && oficial !== p.id) await exec(`provincia "${p.nombre}" ${p.id} → temporal`, 'UPDATE provincias SET id = ? WHERE id = ?', [100000 + p.id, p.id]);
  }
  for (const p of existentes) {
    const oficial = oficialPorNombre.get(norm(p.nombre));
    if (!oficial || oficial === p.id) continue;
    const yaEsta = (await rows('SELECT id FROM provincias WHERE id = ?', [oficial])).length;
    if (yaEsta && !DRY) {
      await exec(`provincia "${p.nombre}" duplicada: localidades a ${oficial}`, 'UPDATE localidades SET provincia_id = ? WHERE provincia_id = ?', [oficial, 100000 + p.id]);
      await exec(`provincia duplicada ${p.id} eliminada`, 'DELETE FROM provincias WHERE id = ?', [100000 + p.id]);
    } else {
      await exec(`provincia "${p.nombre}" ${p.id} → ${oficial}`, 'UPDATE provincias SET id = ? WHERE id = ?', [oficial, 100000 + p.id]);
    }
  }
  for (const [id, nombre] of PROVINCIAS) {
    await exec(`provincia ${id} ${nombre}`, 'INSERT INTO provincias (id, nombre) VALUES (?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)', [id, nombre]);
  }

  if (args['solo-provincias']) {
    console.log(`${DRY ? '[simulación] ' : ''}Provincias listas (${PROVINCIAS.length}).`);
  } else {
    const filtro = args.todas ? null : typeof args.provincias === 'string' ? args.provincias.split(',').map(Number).filter(Boolean) : PROVINCIAS_TRABAJO;
    console.log(filtro ? `Provincias: ${filtro.map((id) => PROVINCIAS.find((p) => p[0] === id)?.[1] || id).join(', ')}.` : 'Provincias: todo el país.');
    let oficiales;
    if (typeof args.archivo === 'string') {
      const data = JSON.parse(fs.readFileSync(args.archivo, 'utf8'));
      oficiales = (data.localidades || data).map((l) => ({
        id: String(l.id), nombre: l.nombre, provinciaId: Number(l.provincia?.id ?? l.provinciaId),
        latitud: l.centroide?.lat ?? l.latitud ?? null, longitud: l.centroide?.lon ?? l.longitud ?? null,
      })).filter((l) => !filtro || filtro.includes(l.provinciaId));
    } else {
      console.log('Descargando localidades de Georef (datos.gob.ar)…');
      oficiales = await descargarLocalidades(filtro);
    }
    console.log(`${oficiales.length} localidades oficiales recibidas.`);

    // ── Unir las localidades manuales con la oficial equivalente ──
    const porNombre = new Map();
    for (const l of oficiales) {
      const k = norm(l.nombre);
      if (!porNombre.has(k)) porNombre.set(k, []);
      porNombre.get(k).push(l);
    }
    const manuales = await rows("SELECT id, nombre, codigo_postal, provincia_id FROM localidades WHERE id LIKE 'cp-%' OR id LIKE 'm-%'");
    const sinUnir = [];
    for (const m of manuales) {
      let candidatas = porNombre.get(norm(m.nombre)) || [];
      if (m.provincia_id && candidatas.length > 1) candidatas = candidatas.filter((c) => c.provinciaId === Number(m.provincia_id));
      if (candidatas.length > 1) {
        const posibles = provinciasPorCp(m.codigo_postal);
        const porCp = posibles ? candidatas.filter((c) => posibles.includes(c.provinciaId)) : [];
        if (porCp.length === 1) candidatas = porCp;
      }
      if (candidatas.length > 1) {
        const preferidas = candidatas.filter((c) => c.provinciaId === PREFERIDA);
        if (preferidas.length === 1) candidatas = preferidas;
      }
      if (candidatas.length !== 1) { sinUnir.push(`${m.nombre} (${m.id}: ${candidatas.length} coincidencias)`); continue; }
      const o = candidatas[0];
      const yaEsta = (await rows('SELECT id FROM localidades WHERE id = ?', [o.id])).length;
      if (!yaEsta) {
        // Renombrar la clave: empresas y zonas se actualizan solas (ON UPDATE CASCADE).
        await exec(`${m.nombre}: ${m.id} → ${o.id}`, 'UPDATE localidades SET id = ?, nombre = ?, provincia_id = ?, latitud = ?, longitud = ? WHERE id = ?',
          [o.id, o.nombre, o.provinciaId, o.latitud, o.longitud, m.id]);
      } else {
        await exec(`${m.nombre}: empresas de ${m.id} a ${o.id}`, 'UPDATE empresas SET localidad_id = ? WHERE localidad_id = ?', [o.id, m.id]);
        await exec(`${m.nombre}: zonas de ${m.id} a ${o.id}`, 'UPDATE IGNORE usuario_localidades SET localidad_id = ? WHERE localidad_id = ?', [o.id, m.id]);
        await exec(`${m.nombre}: código postal a ${o.id}`, 'UPDATE localidades SET codigo_postal = COALESCE(codigo_postal, ?) WHERE id = ?', [m.codigo_postal, o.id]);
        await exec(`${m.nombre}: ${m.id} eliminada (duplicada)`, 'DELETE FROM localidades WHERE id = ? AND NOT EXISTS (SELECT 1 FROM empresas WHERE localidad_id = ?)', [m.id, m.id]);
      }
    }

    // ── Alta de las oficiales que faltan (en lotes) ──
    const actuales = new Set((await rows('SELECT id FROM localidades')).map((r) => r.id));
    const nuevas = oficiales.filter((l) => !actuales.has(l.id));
    for (let i = 0; i < nuevas.length; i += 500) {
      const lote = nuevas.slice(i, i + 500);
      await exec(`${lote.length} localidades nuevas`, `INSERT IGNORE INTO localidades (id, nombre, provincia_id, latitud, longitud) VALUES ${lote.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
        lote.flatMap((l) => [l.id, l.nombre, l.provinciaId, l.latitud, l.longitud]));
    }
    console.log(`${DRY ? '[simulación] ' : ''}${manuales.length - sinUnir.length} localidades manuales unidas, ${nuevas.length} oficiales agregadas.`);
    if (sinUnir.length) console.log(`Quedan para revisar a mano (Empresas → Localidad):\n  - ${sinUnir.join('\n  - ')}`);
  }
  if (DRY) console.log(`\n[simulación] ${cambios.length} operaciones. Primeras:\n  ${cambios.slice(0, 30).join('\n  ')}`);
} catch (e) {
  console.error('Error:', e.message);
  if (/fetch|ENOTFOUND|Georef/i.test(e.message)) console.error('Sin acceso a Georef: podés correr con --solo-provincias y cargar localidades después.');
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
