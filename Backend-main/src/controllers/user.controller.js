/* eslint-disable */
import User from '../models/user.model.js';

// Creacion de un usuario
export const createUser= async(req, res) => {
    try{
        const{numDoc, nombreApellido, direccionMail, antiguedad, direccion} = req.body;

        if(!numDoc || !nombreApellido || !direccion || !antiguedad){
            return res.status(400).json({
                message: "El numero de documento, nombre y apellido, direccion y antiguedad son obligatorios"
            });
        }

        const newUser= await User.create({
            numDoc,
            nombreApellido,
            direccionMail,
            antiguedad,
            direccion
        });

        return res.status(201).json({
            message:"Usuario creado exitosamente",
            data: newUser
        });

    }catch(error){
        console.error("Error al crear el usuario:", error);
        return res.status(500).json({
            message:"Hubo un error interno en el servidor",
            error: error.message
        });
        }};



// Obtener todos los usuarios
export const getAllUsers = async (req, res) => {
    try{
        const users = await User.findAll();

        return res.status(200).json({
            message: "Usuarios obtenidos exitosamente",
            data: users
        });
    }catch(error){
        console.error("Error al obtener los usuarios:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }};


// Obtener un usuario por su numero de documento

export const getUserById = async (req, res)=> {
    try{
            const {numDoc}= req.params;
            const user= await User.findByPk(numDoc);

            if(!user){
                return res.status(404).json({
                    message:"Usuario no encontrado"
                });
            }

            return res.status(200).json({
                message:"Usuario obtenido con exito",
                data:user
            });


    }catch(error){
            console.error("Error al obtener el usuario", error);
            return res.status(500).json({
                message:"Hubo un error interno en el servidor",
                error: error.message
            });
    }};


    // Actualizar un usuario por su numero de documento

export const updateUserById = async (req, res) => {
    try{
        const {numDoc}= req.params;
        const{nombreApellido, direccionMail, tipoClient, codigoPostal, nota}= req.body;

        const user= await User.findByPk(numDoc);

        if(!user){
            return res.status(404).json({
                message:"Usuario no encontrado",
            });    
        }

        await user.update({
            nombreApellido,
            direccionMail,
            tipoClient,
            codigoPostal,
            nota
        });

        return res.status(200).json({
            message:"Usuario actualizado exitosamente",
            data: user
        });

    }catch(error){
        console.error("Error al actualizar el usuario:", error);
        return res.status(500).json({
            message:"Hubo un error interno en el servidor",
            error: error.message
        });
    }};


// Eliminar un usuario por su numero de documento
export const deleteUserById= async (req, res) => {
    try{
        const{numDoc}= req.params;
        const user= await User.findByPk(numDoc);

        if(!user){
            return res.status(404).json({
                message:"Usuario no encontrado"
            });
        }

        await user.destroy();

        return res.status(200).json({
            message:"Usuario eliminado exitosamente"

        });


    }catch(error){
        console.error("Error al eliminar el usuario:", error);
        return res.status(500).json({
            messge:"Hubo un error interno en el servidor",
            error: error.message    
        })
    }};

    