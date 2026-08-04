import { ProductLine } from '../models/index.js';

// Creacion de una linea de producto
export const createLineaProd = async (req, res) => {
    try {
        const { lineaProducto } = req.body;

        if (!lineaProducto) {
            return res.status(400).json({
                message: "El nombre de la linea de producto es obligatorio"
            });
        }

        const newLineaProd = await ProductLine.create({
            lineaProducto
        });

        return res.status(201).json({
            message: "Linea de producto creada exitosamente",
            data: newLineaProd
        });

    } catch (error) {
        console.error("Error al crear la linea de producto:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Obtener todas las lineas de producto
export const getAllLineasProd = async (req, res) => {
    try {
        const lineasProd = await ProductLine.findAll();

        return res.status(200).json({
            message: "Lineas de producto obtenidas exitosamente",
            data: lineasProd
        });
    } catch (error) {
        console.error("Error al obtener las lineas de producto:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Obtener una linea de producto por su id
export const getLineaProdById = async (req, res) => {
    try {
        const { id } = req.params;
        const linea = await ProductLine.findByPk(id);

        if (!linea) {
            return res.status(404).json({
                message: "Linea de producto no encontrada"
            });
        }

        return res.status(200).json({
            message: "Linea de producto obtenida con exito",
            data: linea
        });

    } catch (error) {
        console.error("Error al obtener la linea de producto", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Actualizar una linea de producto por su id
export const updateLineaProdById = async (req, res) => {
    try {
        const { id } = req.params;
        const { lineaProducto } = req.body;

        const linea = await ProductLine.findByPk(id);

        if (!linea) {
            return res.status(404).json({
                message: "Linea de producto no encontrada",
            });
        }

        await linea.update({
            lineaProducto
        });

        return res.status(200).json({
            message: "Linea de producto actualizada exitosamente",
            data: linea
        });

    } catch (error) {
        console.error("Error al actualizar la linea de producto:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};


// Eliminar una linea de producto por su id
export const deleteLineaProdById = async (req, res) => {
    try {
        const { id } = req.params;
        const linea = await ProductLine.findByPk(id);

        if (!linea) {
            return res.status(404).json({
                message: "Linea de producto no encontrada"
            });
        }

        await linea.destroy();

        return res.status(200).json({
            message: "Linea de producto eliminada exitosamente"
        });

    } catch (error) {
        console.error("Error al eliminar la linea de producto:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};
