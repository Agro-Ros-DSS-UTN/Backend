import { asyncHandler } from '../../shared/utils/http.js';
import * as dashboardService from './dashboard.service.js';

export const general = asyncHandler(async (req, res) => {
  const result = await dashboardService.getGeneralDashboard();
  res.json(result);
});
