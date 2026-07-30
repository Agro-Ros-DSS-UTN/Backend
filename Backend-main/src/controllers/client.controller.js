/* eslint-disable */
import Client from '../models/client.model.js';
import Locality from '../models/locality.model.js';

// Creacion de un cliente
export const createClient = async (req, res) => {
    try {
        const { numDoc, nombreApellido, direccionMail, tipoClient, codigoPostal, nota } = req.body;

        if (!numDoc || !nombreApellido || !tipoClient || !codigoPostal) {
            return res.status(400).json({
                message: "El numero de documento, nombre y apellido, tipo cliente y codigo postal son obligatorios"
            });
        }

        // El cliente depende de que la localidad exista
        const locality = await Locality.findByPk(codigoPostal);
        if (!locality) {
            return res.status(404).json({
                message: "La localidad indicada no existe. Cree la localidad antes de asignarla a un cliente."
            });
        }

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

    } catch (error) {
        console.error("Error al crear el cliente:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Obtener todos los clientes (con su localidad)
export const getAllClients = async (req, res) => {
    try {
        const clients = await Client.findAll({
            include: { model: Locality }
        });

        return res.status(200).json({
            message: "Clientes obtenidos exitosamente",
            data: clients
        });
    } catch (error) {
        console.error("Error al obtener los clientes:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Obtener un cliente por su numero de documento (con su localidad)
export const getClientById = async (req, res) => {
    try {
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

    } catch (error) {
        console.error("Error al obtener el cliente:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Actualizar un cliente por su numero de documento
export const updateClientById = async (req, res) => {
    try {
        const { numDoc } = req.params;
        const { nombreApellido, direccionMail, tipoClient, codigoPostal, nota } = req.body;

        const client = await Client.findByPk(numDoc);

        if (!client) {
            return res.status(404).json({
                message: "Cliente no encontrado",
            });
        }

        // Si se quiere cambiar la localidad, validar que exista
        if (codigoPostal) {
            const locality = await Locality.findByPk(codigoPostal);
            if (!locality) {
                return res.status(404).json({
                    message: "La localidad indicada no existe."
                });
            }
        }

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

    } catch (error) {
        console.error("Error al actualizar el cliente:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Eliminar un cliente por su numero de documento
export const deleteClientById = async (req, res) => {
    try {
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

    } catch (error) {
        console.error("Error al eliminar el cliente:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};