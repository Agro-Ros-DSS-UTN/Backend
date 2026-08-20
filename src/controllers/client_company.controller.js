/* eslint-disable */
import ClientCompany from '../models/client_company.model.js';



export const getClientCompany = async (req, res) => {
  try {
    const { tipoEmpresa, localityCodPostal} = req.query;

    // Construimos el filtro dinámico según lo que envíe el cliente
    const filter = {};
    if (tipoEmpresa) filter.tipoEmpresa = tipoEmpresa;
    if (localityCodPostal) filter.localityCodPostal = localityCodPostal;

    // Solo seleccionamos los campos requeridos: nombre y estado (y el id para ir al detalle)
    const empresas = await ClientCompany.find(filter).select('nombre estado');

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