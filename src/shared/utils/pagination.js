// Helper reutilizable para aplicar paginación opcional en consultas Sequelize
export const applyPagination = (queryOptions = {}, filters = {}) => {
  if (!filters.page && !filters.limit) return queryOptions;
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 25));
  return {
    ...queryOptions,
    limit,
    offset: (page - 1) * limit,
  };
};

export default applyPagination;
