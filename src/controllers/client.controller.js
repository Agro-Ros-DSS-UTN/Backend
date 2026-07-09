/* eslint-disable */
import Client from '../models/client.model.js';

// Creacion de un cliente
export const createClient= async (req, res) => {
    try{
        const{numDoc, nombreApellido, direccionMail, tipoClient, codigoPostal, nota} = req.body;

        if(!numDoc || !nombreApellido || !tipoClient || !codigoPostal){
            return res.status(400).json({
                message: "El numero de documento, nombre y apellido, tipo cliente y codigo postal son obligatorios"
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

}catch(error){
console.error("Error al crear el cliente:", error);
return res.status(500).json({
    message:"Hubo un error interno en el servidor",
    error: error.message
});

}};


// Obtener todos los clientes
export const getAllClients = async (req, res) => {
    try{
        const clients = await Client.findAll();

        return res.status(200).json({
            message: "Clientes obtenidos exitosamente",
            data:clients
        });
    }catch(error){
        console.error("Erro al obtener los clientes:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }};


// Obtener un cliente por su numero de documento

export const getClientById = async (req, res)=> {
    try{
            const {numDoc}= req.params;
            const client= await Client.findByPk(numDoc);

            if(!client){
                return res.status(404).json({
                    message:"Cliente no encontrado"
                });
            }

            return res.status(200).json({
                message:"Cliente obtenido con exito",
                data:client
            });


    }catch(error){
            console.error("Error al obtener el clinte", error);
            return res.status(500).json({
                message:"Hubo un error interno en el servidor",
                error: error.message
            });
    }};


    // Actualizar un cliente por su numero de documento

export const updateClientById = async (req, res) => {
    try{
        const {numDoc}= req.params;
        const{nombreApellido, direccionMail, tipoClient, codigoPostal, nota}= req.body;

        const client= await Client.findByPk(numDoc);

        if(!client){
            return res.status(404).json({
                message:"Cliente no encontrado",
            });    
        }

        await client.update({
            nombreApellido,
            direccionMail,
            tipoClient,
            codigoPostal,
            nota
        });

        return res.status(200).json({
            message:"Cliente actualizado exitosamente",
            data: client
        });

    }catch(error){
        console.error("Error al actualizar el cliente:", error);
        return res.status(500).json({
            message:"Hubo un error interno en el servidor",
            error: error.message
        });
    }};


// Eliminar un cliente por su numero de documento
export const deleteClientById= async (req, res) => {
    try{
        const{numDoc}= req.params;
        const client= await Client.findByPk(numDoc);

        if(!client){
            return res.status(404).json({
                message:"Cliente no encontrado"
            });
        }

        await client.destroy();

        return res.status(200).json({
            message:"Cliente eliminado exitosamente"

        });


    }catch(error){
        console.error("Error al eliminar el cliente:", error);
        return res.status(500).json({
            messge:"Hubo un error interno en el servidor",
            error: error.message    
        })
    }};

    