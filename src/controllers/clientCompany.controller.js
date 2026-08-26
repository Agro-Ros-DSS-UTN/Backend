/* eslint-disable */
import ClientCompany from '../models/clientCompany.model.js';
import Locality from '../models/locality.model.js';

export const getClientCompany = async (req, res) => {
  try {
    const { tipoEmpresa, localityCodPostal } = req.query;

    const filter = {};
    if (tipoEmpresa) filter.tipoEmpresa = tipoEmpresa;
    if (localityCodPostal) filter.localityCodPostal = localityCodPostal;

    const empresas = await ClientCompany.findAll({
      where: filter,
      include: [{ model: Locality }]
    });

    return res.status(200).json({
      ok: true,
      data: empresas
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener el listado de empresas clientes',
      error: error.message
    });
  }
};
