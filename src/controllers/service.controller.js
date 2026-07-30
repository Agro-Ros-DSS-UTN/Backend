import Service from '../models/service.model.js';

// Cracion de un servicio 
export const createService = async (req, res)=>{
    try{
        const {tipoServicio, desc, formularioActividadId,id} = req.body;

        if(!tipoServicio || !formularioActividadId){
            return res.status(400).json({
                message: "El tipo de servicio y el formulario de actividad son obligatorios"
            });
        }

        const newService = await Service.create({
            tipoServicio,
            desc,
            formularioActividadId
        });

        return res.status(201).json({
            message: "Servicio creado exitosamente",
            data: newService
        });
    }catch(error){
        console.error("Error al crear el servicio:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
}

// Obtener todos los servicios
export const getAllServices= async (req, res)=>{
    try{
        const services = await Service.findAll();

        return res.status(200).json({
            message: "Servicios obtenidos exitosamente",
            data: services
        });
    }catch(error){
        console.error("Error al obtener los servicios:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
        
    };

// Obtener un servicio por su ID
export const getServiceById = async (req, res)=>{
    try{
        const {id} = req.params;
        const service= await Service.findByPk(id);

        if(!service){
            return res.status(404).json({
                message: "Servicio no encontrado"
            });
        }

        return res.status(200).json({
            message: "Servicio obtenido exitosamente",
            data: service
        });
    }catch(error){
        console.error("Error al obtener el servicio:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};

// Actualizar un servicio por su ID
export const updateServiceById = async (req, res)=>{
    try{
        const {id} = req.params;
        const {tipoServicio, desc, formularioActividadId} = req.body;

        const service = await Service.findByPk(id);

        if(!service){
            return res.status(404).json({
                message: "Servicio no encontrado"
            });
        }
        await service.update({
            tipoServicio,
            desc,
            formularioActividadId
        });

        return res.status(200).json({
            message: "Servicio actualizado exitosamente",
            data: service
        });
    }catch(error){
        console.error("Error al actualizar el servicio:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};

// Eliminar un servicio por su ID
export const deleteServiceById = async (req, res)=>{
    try{
        const {id} = req.params;
        const service = await Service.findByPk(id);
        if(!service){
            return res.status(404).json({
                message: "Servicio no encontrado"
            });
        }
        await service.destroy();

        return res.status(200).json({
            message: "Servicio eliminado exitosamente"
        });
    }catch(error){
        console.error("Error al eliminar el servicio:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};
