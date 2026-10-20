import * as cropRepository from './crop.repository.js';
import { required, text } from '../../shared/utils/validation.js';

export const listCrops = async () => cropRepository.findAll();

export const createCrop = async (body = {}) => {
  const name = text(body?.name, 'name', 100);
  required({ name }, ['name']);
  return cropRepository.create({ name, demandMonths: text(body?.demandMonths, 'demandMonths', 40) });
};
