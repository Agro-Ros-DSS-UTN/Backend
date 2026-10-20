import * as provinceRepository from './province.repository.js';

export const listProvinces = async () => provinceRepository.findAll();

export const provinceExists = async (id) => Boolean(await provinceRepository.findById(id));
