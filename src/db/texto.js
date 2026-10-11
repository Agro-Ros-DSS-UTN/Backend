// Comparación tolerante de nombres escritos a mano (migración de texto libre v1).
// "ACA  San Genaro S.A." y "aca san genaro" dan la misma clave.
export const claveNombre = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?\s?a\.?|s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?\s?s\.?)\s*$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Arma un índice clave → [filas] para buscar por nombre.
export const indicePorNombre = (filas, campo) => {
  const m = new Map();
  for (const f of filas) {
    const k = claveNombre(f[campo]);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(f);
  }
  return m;
};
