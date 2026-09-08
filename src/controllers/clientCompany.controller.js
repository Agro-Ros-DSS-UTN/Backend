/* eslint-disable */
import ClientCompany from '../models/clientCompany.model.js';
import Locality from '../models/locality.model.js';
import Client from '../models/client.model.js';
import ClientPhone from '../models/clientPhone.model.js';

// Obtener todas las empresas clientes
export const getClientCompany = async (req, res) => {
  try {
    const { tipoEmpresa, localityCodPostal } = req.query;

    const filter = {};
    if (tipoEmpresa) filter.tipoEmpresa = tipoEmpresa;
    if (localityCodPostal) filter.localityCodPostal = localityCodPostal;

    const empresas = await ClientCompany.findAll({
      where: filter,
      include: [
        { model: Locality },
        { model: Client }
      ]
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

// Crear una nueva empresa cliente con asociacion opcional de contacto
export const createClientCompany = async (req, res) => {
  try {
    const {
      nombreEmpresa,
      cuit,
      tipoEmpresa,
      direccionEmpresa,
      localidad,
      localityCodPostal,
      superficieHa,
      proveedorActual,
      descEmpresa,
      existingContactNumDoc,
      newContact
    } = req.body;

    if (!nombreEmpresa || !cuit) {
      return res.status(400).json({
        ok: false,
        message: 'El nombre/razón social y el CUIT de la empresa son obligatorios.'
      });
    }

    const postalCode = localityCodPostal ? String(localityCodPostal) : '2170';

    // Asegurar que la localidad exista en la base de datos para no violar la FK
    await Locality.findOrCreate({
      where: { codPostal: postalCode },
      defaults: {
        codPostal: postalCode,
        nomLocalidad: localidad || 'Santa Fe'
      }
    });

    // Crear la empresa cliente en la BD
    const newCompany = await ClientCompany.create({
      nombreEmpresa: nombreEmpresa.trim(),
      descEmpresa: descEmpresa || null,
      direccionEmpresa: direccionEmpresa ? direccionEmpresa.trim() : 'Ruta Provincial',
      cuit: cuit.trim(),
      proveedorActual: proveedorActual || null,
      superficieHa: superficieHa ? Number(superficieHa) : null,
      tipoEmpresa: tipoEmpresa || 'Productor',
      localityCodPostal: postalCode
    });

    let linkedContact = null;

    // CASO 1: Asociar contacto ya registrado
    if (existingContactNumDoc) {
      const existingClient = await Client.findByPk(existingContactNumDoc);
      if (existingClient) {
        await existingClient.update({ clientCompanyId: newCompany.id });
        linkedContact = existingClient;
      }
    }
    // CASO 2: Dar de alta y vincular un nuevo contacto
    else if (newContact && (newContact.nombreApellido || newContact.nombre)) {
      const contactFullName = (newContact.nombreApellido || `${newContact.nombre || ''} ${newContact.apellido || ''}`).trim();
      const contactDoc = newContact.numDoc || `20-${Math.floor(10000000 + Math.random() * 90000000)}-${Math.floor(Math.random() * 9)}`;
      const contactPostal = newContact.codigoPostal || postalCode;

      await Locality.findOrCreate({
        where: { codPostal: String(contactPostal) },
        defaults: {
          codPostal: String(contactPostal),
          nomLocalidad: localidad || 'Santa Fe'
        }
      });

      linkedContact = await Client.create({
        numDoc: contactDoc,
        nombreApellido: contactFullName,
        direccionMail: newContact.direccionMail || newContact.email || null,
        tipoClient: newContact.tipoClient || newContact.puesto || 'Encargado de Planta',
        codigoPostal: String(contactPostal),
        nota: newContact.nota || `Contacto referente de ${nombreEmpresa}`,
        clientCompanyId: newCompany.id
      });

      if (newContact.telefono) {
        try {
          await ClientPhone.create({
            clientNumDoc: contactDoc,
            numTelefono: newContact.telefono
          });
        } catch (phoneErr) {
          console.warn('Advertencia al guardar teléfono de contacto:', phoneErr.message);
        }
      }
    }

    return res.status(201).json({
      ok: true,
      message: 'Empresa cliente registrada exitosamente',
      data: newCompany,
      contact: linkedContact
    });
  } catch (error) {
    console.error('Error al registrar empresa cliente:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error interno al registrar la empresa cliente',
      error: error.message
    });
  }
};

// Actualizar una empresa cliente
export const updateClientCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombreEmpresa,
      cuit,
      tipoEmpresa,
      direccionEmpresa,
      localityCodPostal,
      superficieHa,
      proveedorActual,
      descEmpresa
    } = req.body;

    const company = await ClientCompany.findByPk(id);
    if (!company) {
      return res.status(404).json({ ok: false, message: 'Empresa no encontrada' });
    }

    if (localityCodPostal) {
      await Locality.findOrCreate({
        where: { codPostal: String(localityCodPostal) },
        defaults: {
          codPostal: String(localityCodPostal),
          nomLocalidad: 'Santa Fe'
        }
      });
    }

    await company.update({
      nombreEmpresa: nombreEmpresa !== undefined ? nombreEmpresa : company.nombreEmpresa,
      cuit: cuit !== undefined ? cuit : company.cuit,
      tipoEmpresa: tipoEmpresa !== undefined ? tipoEmpresa : company.tipoEmpresa,
      direccionEmpresa: direccionEmpresa !== undefined ? direccionEmpresa : company.direccionEmpresa,
      localityCodPostal: localityCodPostal !== undefined ? String(localityCodPostal) : company.localityCodPostal,
      superficieHa: superficieHa !== undefined ? Number(superficieHa) : company.superficieHa,
      proveedorActual: proveedorActual !== undefined ? proveedorActual : company.proveedorActual,
      descEmpresa: descEmpresa !== undefined ? descEmpresa : company.descEmpresa
    });

    return res.status(200).json({
      ok: true,
      message: 'Empresa actualizada exitosamente',
      data: company
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar empresa',
      error: error.message
    });
  }
};

// Eliminar una empresa cliente
export const deleteClientCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await ClientCompany.findByPk(id);
    if (!company) {
      return res.status(404).json({ ok: false, message: 'Empresa no encontrada' });
    }

    await company.destroy();
    return res.status(200).json({
      ok: true,
      message: 'Empresa eliminada exitosamente'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar empresa',
      error: error.message
    });
  }
};
