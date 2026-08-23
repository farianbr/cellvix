import { asyncHandler } from '../utils/ApiError.js';
import * as taxonomyService from '../services/taxonomyService.js';

export const tree = asyncHandler(async (_req, res) => {
  res.json(await taxonomyService.getTree());
});
