import { asyncHandler } from '../../shared/utils/http.js';
import * as provinceService from './province.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await provinceService.listProvinces();
  res.json({ data });
});
