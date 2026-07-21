/* eslint-disable */
import formularioActividad from '../models/activityForm.js';

// Creacion de un formulario de actividad
export const createFormularioActividad= async (req, res) => {
    try{
        const{idFormulario,tipoContacto,descripcion,montoVenta,fechaHora} = req.body;

        if(!idFormulario || !tipoContacto || !fechaHora){
            return res.status(400).json({
                message: "El ID del formulario de actividad, tipo de contacto y fecha/hora son obligatorios"
            });
            }
        

    const newClient = await formularioActividad.create({
        idFormulario,
        tipoContacto,
        descripcion,
        montoVenta,
        fechaHora 
    });

    return res.status(201).json({
        message: "Formulario de actividad creado exitosamente",
        data: newClient
    });

}catch(error){
console.error("Error al crear el formulario de actividad:", error);
return res.status(500).json({
    message:"Hubo un error interno en el servidor",
    error: error.message
});

}};


// Obtener todos los formularios de actividad
export const getAllFormulariosActividad = async (req, res) => {
    try{
        const formularios = await formularioActividad.findAll();

        return res.status(200).json({
            message: "Formularios de actividad obtenidos exitosamente",
            data:formularios
        });
    }catch(error){
        console.error("Error al obtener los formularios de actividad:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }};


// Obtener un formulario de actividad por su ID

export const getFormularioActividadById = async (req, res)=> {
    try{
            const {idFormulario}= req.params;
            const FormularioActividad= await formularioActividad.findByPk(idFormulario);

            if(!formularioActividad){
                return res.status(404).json({
                    message:"Formulario de actividad no encontrado"
                });
            }

            return res.status(200).json({
                message:"Formulario de actividad obtenido con exito",
                data:formularioActividad
            });


    }catch(error){
            console.error("Error al obtener el formulario de actividad", error);
            return res.status(500).json({
                message:"Hubo un error interno en el servidor",
                error: error.message
            });
    }};


    // Actualizar un formulario de actividad por su ID

export const updateFormularioActividadById = async (req, res) => {
    try{
        const {idFormulario}= req.params;
        const{tipoContacto, descripcion, montoVenta, fechaHora}= req.body;

        const formularioActividad= await formularioActividad.findByPk(idFormulario);

        if(!formularioActividad){
            return res.status(404).json({
                message:"Formulario de actividad no encontrado",
            });    
        }

        await formularioActividad.update({
            tipoContacto,
            descripcion,
            montoVenta,
            fechaHora
        });

        return res.status(200).json({
            message:"Formulario de actividad actualizado exitosamente",
            data: formularioActividad
        });

    }catch(error){
        console.error("Error al actualizar el formulario de actividad:", error);
        return res.status(500).json({
            message:"Hubo un error interno en el servidor",
            error: error.message
        });
    }};


// Eliminar un formulario de actividad por su ID
export const deleteFormularioActividadById= async (req, res) => {
    try{
        const{idFormulario}= req.params;
        const formularioActividad= await formularioActividad.findByPk(idFormulario);

        if(!formularioActividad){
            return res.status(404).json({
                message:"Formulario de actividad no encontrado"
            });
        }

        await formularioActividad.destroy();

        return res.status(200).json({
            message:"Formulario de actividad eliminado exitosamente"

        });


    }catch(error){
        console.error("Error al eliminar el formulario de actividad:", error);
        return res.status(500).json({
            message:"Hubo un error interno en el servidor",
            error: error.message    
        })
    }};

    