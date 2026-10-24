/**
 * Helper reutilizable para aplicar paginación en consultas Sequelize.
 * 
 * REGLA DE ARQUITECTURA FUNDAMENTAL:
 * La paginación es estrictamente OPT-IN. Solo se activa si el cliente solicita explícitamente
 * paginar enviando los parámetros 'page' o 'limit'.
 * 
 * Si el cliente no los envía (como ocurre en las páginas que realizan filtrado, ordenamiento,
 * jerarquías y paginación en memoria del navegador), se debe devolver la consulta COMPLETA
 * sin aplicar LIMIT ni OFFSET para evitar recortar la visibilidad de datos.
 */
export const applyPagination = (queryOptions = {}, filters = {}) => {
  // 1. Desactivación explícita mediante flags
  if (
    filters.paginate === false ||
    filters.paginate === 'false' ||
    filters.unlimited === true ||
    filters.unlimited === 'true' ||
    filters.limit === 'all' ||
    filters.limit === -1 ||
    filters.limit === '-1'
  ) {
    return queryOptions;
  }

  // 2. Comprobar si el cliente solicitó paginación de forma explícita
  const hasPage = filters.page !== undefined && filters.page !== null && String(filters.page).trim() !== '';
  const hasLimit = filters.limit !== undefined && filters.limit !== null && String(filters.limit).trim() !== '';

  // 3. Si no se solicitó ni página ni límite, DEVOLVER TODO (sin recortar registros)
  if (!hasPage && !hasLimit) {
    return queryOptions;
  }

  // 4. Si se solicitó paginación explícita, sanitizar valores
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.max(1, parseInt(filters.limit, 10) || 50);

  return {
    ...queryOptions,
    limit,
    offset: (page - 1) * limit,
  };
};

export default applyPagination;
