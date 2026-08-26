/* eslint-disable */
import { ProductLine } from '../models/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Creacion de una linea de producto
export const createLineaProd = asyncHandler(async (req, res) => {
    const { lineaProducto } = req.body;

    // La validación de campos obligatorios ya la hace
    // validateCreateProductLine (middleware)
    const newLineaProd = await ProductLine.create({
        lineaProducto
    });

    return res.status(201).json({
        message: "Linea de producto creada exitosamente",
        data: newLineaProd
    });
});


// Obtener todas las lineas de producto
export const getAllLineasProd = asyncHandler(async (req, res) => {
    const lineasProd = await ProductLine.findAll();

    return res.status(200).json({
        message: "Lineas de producto obtenidas exitosamente",
        data: lineasProd
    });
});


// Obtener una linea de producto por su id
export const getLineaProdById = asyncHandler(async (req, res) => {
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
});


// Actualizar una linea de producto por su id
export const updateLineaProdById = asyncHandler(async (req, res) => {
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
});


// Eliminar una linea de producto por su id
export const deleteLineaProdById = asyncHandler(async (req, res) => {
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
});
