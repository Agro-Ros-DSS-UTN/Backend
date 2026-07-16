import lineaProd from '../models/lineaProd.model.js';

// Creacion de una linea de producto
export const createLineaProd= async (req, res) => {
    try{
        const{codLinea, nombreLinea, categoria} = req.body;

        if(!codLinea || !nombreLinea){
            return res.status(400).json({
                message: "El codigo de linea y nombre de linea son obligatorios"
            });
            }
        

    const newLineaProd = await lineaProd.create({
        codLinea,
        nombreLinea,
        categoria
    });

    return res.status(201).json({
            message: "Linea de producto creada exitosamente",
            data: newLineaProd
        });

    } catch(error) {
        console.error("Error al crear la linea de producto:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Obtener todos las lineas de producto
export const getAllLineasProd = async (req, res) => {
    try{
        const lineasProd = await lineaProd.findAll();

        return res.status(200).json({
            message: "Lineas de producto obtenidas exitosamente",
            data: lineasProd
        });
    }catch(error){
        console.error("Error al obtener las lineas de producto:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }};


// Obtener un  por su numero de documento

export const getLineaProdById = async (req, res)=> {
    try{
            const {codLinea}= req.params;
            const lineaProd= await lineaProd.findByPk(codLinea);

            if(!lineaProd){
                return res.status(404).json({
                    message:"Linea de producto no encontrada"
                });
            }

            return res.status(200).json({
                message:"Linea de producto obtenida con exito",
                data:lineaProd
            });


    }catch(error){
            console.error("Error al obtener la linea de producto", error);
            return res.status(500).json({
                message:"Hubo un error interno en el servidor",
                error: error.message
            });
    }};


    // Actualizar un linea de producto por su codigo

export const updateLineaProdById = async (req, res) => {
    try{
        const {codLinea}= req.params;
        const{nombreLinea, categoria}= req.body;

        const lineaProd= await lineaProd.findByPk(codLinea);

        if(!lineaProd){
            return res.status(404).json({
                message:"Linea de producto no encontrada",
            });    
        }

        await lineaProd.update({
            nombreLinea,
            categoria
        });

        return res.status(200).json({
            message:"Linea de producto actualizada exitosamente",
            data: lineaProd
        });

    }catch(error){
        console.error("Error al actualizar la linea de producto:", error);
        return res.status(500).json({
            message:"Hubo un error interno en el servidor",
            error: error.message
        });
    }};


// Eliminar un linea de producto por su codigo
export const deleteLineaProdById= async (req, res) => {
    try{
        const{codLinea}= req.params;
        const lineaProd= await lineaProd.findByPk(codLinea);

        if(!lineaProd){
            return res.status(404).json({
                message:"Linea de producto no encontrada"
            });
        }

        await lineaProd.destroy();

        return res.status(200).json({
            message:"Linea de producto eliminada exitosamente"
        });


    }catch(error){
        console.error("Error al eliminar la linea de producto:", error);
        return res.status(500).json({
            message:"Hubo un error interno en el servidor",
            error: error.message    
        })
    }};

    