/* eslint-disable */
import Client from '../models/client.model.js';
import Locality from '../models/locality.model.js';
import ClientCompany from '../models/clientCompany.model.js';
import ClientPhone from '../models/clientPhone.model.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Creacion de un cliente
export const createClient = asyncHandler(async (req, res) => {
    const { numDoc, nombreApellido, direccionMail, tipoClient, codigoPostal, nota, clientCompanyId, telefono, telefonos } = req.body;

    const newClient = await Client.create({
        numDoc,
        nombreApellido,
        direccionMail,
        tipoClient,
        codigoPostal,
        nota,
        clientCompanyId: clientCompanyId ? Number(clientCompanyId) : null
    });

    const phoneToSave = telefono || (Array.isArray(telefonos) && telefonos.length > 0 ? telefonos[0] : null);
    if (phoneToSave) {
        try {
            await ClientPhone.create({
                clientNumDoc: numDoc,
                numTelefono: phoneToSave
            });
        } catch (phoneErr) {
            console.warn('Advertencia al asociar telefono:', phoneErr.message);
        }
    }

    return res.status(201).json({
        message: "Cliente creado exitosamente",
        data: newClient
    });
});


// Obtener todos los clientes (con su localidad, empresa y telefonos)
export const getAllClients = asyncHandler(async (req, res) => {
    const clients = await Client.findAll({
        include: [
            { model: Locality },
            { model: ClientCompany },
            { model: ClientPhone }
        ]
    });

    return res.status(200).json({
        message: "Clientes obtenidos exitosamente",
        data: clients
    });
});


// Obtener un cliente por su numero de documento
export const getClientById = asyncHandler(async (req, res) => {
    const { numDoc } = req.params;
    const client = await Client.findByPk(numDoc, {
        include: [
            { model: Locality },
            { model: ClientCompany },
            { model: ClientPhone }
        ]
    });

    if (!client) {
        return res.status(404).json({
            message: "Cliente no encontrado"
        });
    }

    return res.status(200).json({
        message: "Cliente obtenido con exito",
        data: client
    });
});


// Actualizar un cliente por su numero de documento
export const updateClientById = asyncHandler(async (req, res) => {
    const { numDoc } = req.params;
    const { nombreApellido, direccionMail, tipoClient, codigoPostal, nota, clientCompanyId, telefono, telefonos } = req.body;

    const client = await Client.findByPk(numDoc);

    if (!client) {
        return res.status(404).json({
            message: "Cliente no encontrado",
        });
    }

    const updateFields = {
        nombreApellido: nombreApellido !== undefined ? nombreApellido : client.nombreApellido,
        direccionMail: direccionMail !== undefined ? direccionMail : client.direccionMail,
        tipoClient: tipoClient !== undefined ? tipoClient : client.tipoClient,
        codigoPostal: codigoPostal !== undefined ? codigoPostal : client.codigoPostal,
        nota: nota !== undefined ? nota : client.nota,
    };

    if (clientCompanyId !== undefined) {
        updateFields.clientCompanyId = clientCompanyId ? Number(clientCompanyId) : null;
    }

    await client.update(updateFields);

    const phoneToSave = telefono || (Array.isArray(telefonos) && telefonos.length > 0 ? telefonos[0] : null);
    if (phoneToSave) {
        try {
            const existingPhone = await ClientPhone.findOne({ where: { clientNumDoc: numDoc } });
            if (existingPhone) {
                await existingPhone.update({ numTelefono: phoneToSave });
            } else {
                await ClientPhone.create({ clientNumDoc: numDoc, numTelefono: phoneToSave });
            }
        } catch (phoneErr) {
            console.warn('Advertencia al actualizar teléfono:', phoneErr.message);
        }
    }

    return res.status(200).json({
        message: "Cliente actualizado exitosamente",
        data: client
    });
});


// Eliminar un cliente por su numero de documento
export const deleteClientById = asyncHandler(async (req, res) => {
    const { numDoc } = req.params;
    const client = await Client.findByPk(numDoc);

    if (!client) {
        return res.status(404).json({
            message: "Cliente no encontrado"
        });
    }

    await client.destroy();

    return res.status(200).json({
        message: "Cliente eliminado exitosamente"
    });
});
