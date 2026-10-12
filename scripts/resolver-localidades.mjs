#!/usr/bin/env node
// Resuelve las localidades cargadas a mano que seed:localidades no pudo unir solo
// (nombre escrito distinto o repetido en varias provincias) y ordena la tabla.
//
//   npm run localidades:resolver              → muestra qué haría, sin escribir
//   npm run localidades:resolver -- --aplicar → lo aplica
//   (--ensayo para trabajar sobre la base de ENSAYO del .env)
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
const APLICAR = Boolean(args.aplicar);
if (args.ensayo) {
  if (!process.env.ENSAYO_DB_NAME || process.env.ENSAYO_DB_NAME === process.env.DB_NAME) {
    console.error('Falta ENSAYO_DB_NAME en el .env (o es igual a DB_NAME).');
    process.exit(1);
  }
  for (const k of ['NAME', 'USER', 'PASS', 'HOST', 'PORT']) if (process.env[`ENSAYO_DB_${k}`]) process.env[`DB_${k}`] = process.env[`ENSAYO_DB_${k}`];
  console.log(`[ensayo] Base: ${process.env.DB_NAME}`);
}
const { default: sequelize } = await import('../src/config/database.js');

const PROV = { 6: 'Buenos Aires', 14: 'Córdoba', 30: 'Entre Ríos', 82: 'Santa Fe' };
// Localidad oficial (Georef) para cada nombre cargado a mano.
const DECISIONES = [
  { nombre: 'Firmat', oficial: '82042120', nota: 'la ciudad está en dos departamentos; se usa General López, donde está el casco urbano' },
  { nombre: 'Rojas', oficial: '06686060', nota: 'la otra coincidencia era la misma ciudad cargada como "entidad"' },
  { nombre: 'Villa San Marcial', oficial: '30098150', nota: 'nombre oficial: Villa San Marcial (Est. Gobernador Urquiza)' },
  { nombre: 'Monte de Oca', oficial: '82007050', nota: 'nombre oficial: Montes de Oca' },
  { nombre: 'Puerto San Martín', oficial: '82119080', nota: 'nombre oficial: Puerto General San Martín' },
  { nombre: 'Ascención', oficial: '06294020', nota: 'nombre oficial: Ascensión' },
  { nombre: 'Villa Fontana', opciones: { '30084280': 30, '14105270': 14 } },
  { nombre: 'San Pedro', opciones: { '06770050': 6, '14126160': 14, '30028100': 30 } },
  { nombre: 'Estación Runciman', provincia: 82, nota: 'no figura en Georef; se le asigna Santa Fe' },
  { nombre: 'La California', provincia: 82, nota: 'no figura en Georef; se le asigna Santa Fe' },
  { nombre: 'Espinillo', nota: 'no figura en Georef para las 7 provincias' },
  { nombre: 'Tarragona', nota: 'no figura en Georef' },
];

// Pistas de provincia en un texto o en un teléfono.
const TEXTO_PROV = [
  [30, /entre\s*r[ií]os|\be\.?\s*r\.?\b|paran[aá]\b/i],
  [14, /c[oó]rdoba|\bcba\b/i],
  [6, /buenos\s*aires|\bbs\.?\s*as\b|\bpba\b/i],
  [82, /santa\s*fe|\bsta\.?\s*fe\b|rosario/i],
];
const provDeTelefono = (tel) => {
  let d = String(tel || '').replace(/\D/g, '');
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
const acciones = [];
const hacer = async (desc, sql, r) => {
  acciones.push(desc);
  if (APLICAR) await q(sql, r);
};

try {
  console.log(APLICAR ? 'Aplicando cambios.\n' : 'Simulación (no se escribe nada). Para aplicar: npm run localidades:resolver -- --aplicar\n');
  const manuales = await rows("SELECT id, nombre, provincia_id FROM localidades WHERE id LIKE 'cp-%' OR id LIKE 'm-%'");
  const porNombre = new Map(manuales.map((m) => [norm(m.nombre), m]));

  const unir = async (m, oficialId, detalle) => {
    const of = (await rows('SELECT id, nombre, provincia_id FROM localidades WHERE id = ?', [oficialId]))[0];
    if (!of) {
      console.log(`  ✘ ${m.nombre}: la localidad oficial ${oficialId} no está cargada (correr antes seed:localidades).`);
      return;
    }
    const [{ n }] = await rows('SELECT COUNT(*) AS n FROM empresas WHERE localidad_id = ?', [m.id]);
    console.log(`  ✔ ${m.nombre} → ${of.nombre} (${PROV[of.provincia_id] || of.provincia_id}) · ${n} empresa(s)${detalle ? ` · ${detalle}` : ''}`);
    await hacer(`empresas de ${m.id} → ${of.id}`, 'UPDATE empresas SET localidad_id = ? WHERE localidad_id = ?', [of.id, m.id]);
    await hacer(`zonas de ${m.id} → ${of.id}`, 'UPDATE IGNORE usuario_localidades SET localidad_id = ? WHERE localidad_id = ?', [of.id, m.id]);
    await hacer(`zonas sobrantes de ${m.id}`, 'DELETE FROM usuario_localidades WHERE localidad_id = ?', [m.id]);
    await hacer(`borrar ${m.id}`, 'DELETE FROM localidades WHERE id = ?', [m.id]);
  };

  for (const d of DECISIONES) {
    const m = porNombre.get(norm(d.nombre));
    if (!m) continue; // ya resuelta o no existe en esta base
    if (d.oficial) { await unir(m, d.oficial, d.nota); continue; }

    const empresas = await rows('SELECT id, razon_social, direccion, descripcion FROM empresas WHERE localidad_id = ?', [m.id]);
    if (d.opciones) {
      // Votos por provincia según direcciones y teléfonos de contactos.
      const votos = {};
      const pistas = [];
      for (const e of empresas) {
        const texto = `${e.direccion || ''} ${e.descripcion || ''}`;
        for (const [p, re] of TEXTO_PROV) if (re.test(texto)) { votos[p] = (votos[p] || 0) + 2; pistas.push(`"${e.razon_social}": dirección menciona ${PROV[p]}`); }
        const tels = await rows('SELECT t.numero FROM contacto_telefonos t JOIN contactos c ON c.id = t.contacto_id WHERE c.empresa_id = ?', [e.id]);
        for (const { numero } of tels) {
          const p = provDeTelefono(numero);
          if (p) { votos[p] = (votos[p] || 0) + 1; pistas.push(`"${e.razon_social}": teléfono ${numero} (${PROV[p]})`); }
        }
      }
      const candidatas = Object.entries(d.opciones).filter(([, p]) => votos[p]);
      if (candidatas.length === 1) {
        await unir(m, candidatas[0][0], `elegida por: ${pistas.filter((x) => x.includes(PROV[candidatas[0][1]])).join('; ')}`);
      } else {
        console.log(`  ? ${m.nombre}: existe en ${Object.values(d.opciones).map((p) => PROV[p]).join(', ')} y no hay pistas claras. No se toca.`);
        for (const e of empresas) console.log(`      - ${e.razon_social} · ${e.direccion || 'sin dirección'}`);
        if (pistas.length) console.log(`      pistas: ${pistas.join('; ')}`);
      }
      continue;
    }
    if (d.provincia && Number(m.provincia_id) !== d.provincia) {
      console.log(`  ~ ${m.nombre}: ${d.nota}.`);
      await hacer(`provincia de ${m.id}`, 'UPDATE localidades SET provincia_id = ? WHERE id = ?', [d.provincia, m.id]);
    } else {
      console.log(`  · ${m.nombre}: ${d.nota}; queda como está (${empresas.length} empresa(s)): ${empresas.map((e) => e.razon_social).join(', ')}`);
    }
  }

  // Códigos postales heredados de la v1 (no eran reales). Georef no trae códigos postales.
  const [{ n: conCp }] = await rows('SELECT COUNT(*) AS n FROM localidades WHERE codigo_postal IS NOT NULL');
  if (conCp) {
    console.log(`\n${conCp} localidades tienen el código postal heredado de la v1 (no eran códigos reales): se borran.`);
    await hacer('borrar códigos postales v1', 'UPDATE localidades SET codigo_postal = NULL WHERE codigo_postal IS NOT NULL');
  }

  // Duplicados de Georef: "entidad" (10 dígitos) con el mismo nombre y provincia que una localidad (8 dígitos).
  const dup = await rows(
    `SELECT e.id, e.nombre FROM localidades e
       JOIN localidades l ON l.nombre = e.nombre AND l.provincia_id = e.provincia_id AND l.id <> e.id AND LENGTH(l.id) = 8
      WHERE LENGTH(e.id) = 10 AND e.id REGEXP '^[0-9]+$'
        AND NOT EXISTS (SELECT 1 FROM empresas x WHERE x.localidad_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM usuario_localidades z WHERE z.localidad_id = e.id)`
  );
  if (dup.length) {
    console.log(`${dup.length} localidades repetidas de Georef (la misma ciudad como "entidad"): se quitan del selector.`);
    for (let i = 0; i < dup.length; i += 200) {
      const lote = dup.slice(i, i + 200).map((d) => d.id);
      await hacer(`${lote.length} duplicadas`, `DELETE FROM localidades WHERE id IN (${lote.map(() => '?').join(', ')})`, lote);
    }
  }

  const [{ n: quedan }] = await rows("SELECT COUNT(*) AS n FROM localidades WHERE id LIKE 'cp-%' OR id LIKE 'm-%'");
  console.log(`\n${APLICAR ? 'Listo' : 'Simulación lista'}: ${acciones.length} operaciones. Localidades cargadas a mano que quedarían: ${APLICAR ? quedan : '(ver arriba)'}.`);
} catch (e) {
  console.error('Error:', e.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
