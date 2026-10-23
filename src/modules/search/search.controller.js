import { asyncHandler } from '../../shared/utils/http.js';
import { isAdmin } from '../../shared/middlewares/auth.middleware.js';
import * as searchService from './search.service.js';

export const search = asyncHandler(async (req, res) => {
  const isSeller = !isAdmin(req);
  const result = await searchService.globalSearch(req.query.q, {
    limit: req.query.limit,
    isSeller,
    currentUserId: req.user?.idUser || req.user?.id,
  });
  res.json({ data: result });
});
