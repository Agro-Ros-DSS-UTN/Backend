// DNI inventados → NULL.
// En la v1 el DNI era la clave primaria de los clientes, así que la carga inicial
// les puso números correlativos (10000005, 10000144, 10000180…) a los que no lo
// tenían. Desde la v2 la clave es contactos.id (autoincremental) y el DNI es un dato
// opcional, así que esos números de relleno se pueden vaciar sin romper nada.
//
// Criterio: DNI numérico entre 10.000.000 y 10.000.999, y solo si hay muchos (es una
// serie generada, no personas reales nacidas en 1950). El valor original queda en
// _bak_v1_clientes.num_doc.

export const description = 'DNI correlativos inventados en la carga inicial de contactos → vacíos';

const DESDE = 10000000;
const HASTA = 10000999;
const MINIMO_SERIE = 20;

export const up = async ({ h, log }) => {
  if (!(await h.hasColumn('contactos', 'dni'))) return;
  const filas = await h.rows("SELECT id, dni FROM contactos WHERE dni IS NOT NULL AND dni REGEXP '^[0-9]{8}$'");
  const serie = filas.filter((f) => Number(f.dni) >= DESDE && Number(f.dni) <= HASTA);
  if (serie.length < MINIMO_SERIE) {
    log(`${serie.length} DNI en el rango ${DESDE}–${HASTA}: no alcanza para ser una serie generada, no se toca nada.`);
    return;
  }
  for (let i = 0; i < serie.length; i += 200) {
    const ids = serie.slice(i, i + 200).map((f) => f.id);
    await h.q(`UPDATE contactos SET dni = NULL WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
  }
  log(`${serie.length} DNI correlativos de relleno quedaron vacíos (de ${filas.length} contactos con DNI numérico).`);
};
