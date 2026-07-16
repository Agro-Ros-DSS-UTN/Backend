/* eslint-disable */
import Provider from '../models/provider.model.js';

// Cracion de un proveedor 
export const createProvider = async (req, res)=>{
    try{
        const {numDoc, nombreApellido, direccionMail} = req.body;

        if(!numDoc || !nombreApellido){
            return res.status(400).json({
                message: "El numero de documento, nombre y apellido son obligatorios"
            });
        }

        const newProvider = await Provider.create({
            numDoc,
            nombreApellido,
            direccionMail
        });

        return res.status(201).json({
            message: "Proveedor creado exitosamente",
            data: newProvider
        });
    }catch(error){
        console.error("Error al crear el proveedor:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
}

// Obtener todos los proveedores
export const getAllProviders= async (req, res)=>{
    try{
        const providers = await Provider.findAll();

        return res.status(200).json({
            message: "Proveedores obtenidos exitosamente",
            data: providers
        });
    }catch(error){
        console.error("Error al obtener los proveedores:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
        
    };

// Obtener un proveedor por su numero de documento
export const getProviderById = async (req, res)=>{
    try{
        const {numDoc} = req.params;
        const provider= await Provider.findByPk(numDoc);

        if(!provider){
            return res.status(404).json({
                message: "Proveedor no encontrado"
            });
        }

        return res.status(200).json({
            message: "Proveedor obtenido exitosamente",
            data: provider
        });
    }catch(error){
        console.error("Error al obtener el proveedor:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};

// Actualizar un proveedor por su numero de documento
export const updateProviderById = async (req, res)=>{
    try{
        const {numDoc} = req.params;
        const {nombreApellido, direccionMail} = req.body;

        const provider = await Provider.findByPk(numDoc);

        if(!provider){
            return res.status(404).json({
                message: "Proveedor no encontrado"
            });
        }
        await provider.update({
            nombreApellido,
            direccionMail
        });

        return res.status(200).json({
            message: "Proveedor actualizado exitosamente",
            data: provider
        });
    }catch(error){
        console.error("Error al actualizar el proveedor:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};

// Eliminar un proveedor por su numero de documento
export const deleteProviderById = async (req, res)=>{
    try{
        const {numDoc} = req.params;
        const provider = await Provider.findByPk(numDoc);
        if(!provider){
            return res.status(404).json({
                message: "Proveedor no encontrado"
            });
        }
        await provider.destroy();

        return res.status(200).json({
            message: "Proveedor eliminado exitosamente"
        });
    }catch(error){
        console.error("Error al eliminar el proveedor:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};
