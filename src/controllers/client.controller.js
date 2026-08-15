/* eslint-disable */
import Client from '../models/client.model.js';
import Locality from '../models/locality.model.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Creacion de un cliente
export const createClient = asyncHandler(async (req, res) => {
    const { numDoc, nombreApellido, direccionMail, tipoClient, codigoPostal, nota } = req.body;

    // La validación de campos obligatorios y existencia de la localidad
    // ya la hace validateCreateClient (middleware)
    const newClient = await Client.create({
        numDoc,
        nombreApellido,
        direccionMail,
        tipoClient,
        codigoPostal,
        nota
    });

    return res.status(201).json({
        message: "Cliente creado exitosamente",
        data: newClient
    });
});


// Obtener todos los clientes (con su localidad)
export const getAllClients = asyncHandler(async (req, res) => {
    const clients = await Client.findAll({
        include: { model: Locality }
    });

    return res.status(200).json({
        message: "Clientes obtenidos exitosamente",
        data: clients
    });
});


// Obtener un cliente por su numero de documento (con su localidad)
export const getClientById = asyncHandler(async (req, res) => {
    const { numDoc } = req.params;
    const client = await Client.findByPk(numDoc, {
        include: { model: Locality }
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
    const { nombreApellido, direccionMail, tipoClient, codigoPostal, nota } = req.body;

    const client = await Client.findByPk(numDoc);

    if (!client) {
        return res.status(404).json({
            message: "Cliente no encontrado",
        });
    }

    // La validación de la localidad (si se envía) ya la hace
    // validateUpdateClient (middleware)
    await client.update({
        nombreApellido,
        direccionMail,
        tipoClient,
        codigoPostal,
        nota
    });

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
