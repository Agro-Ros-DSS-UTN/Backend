/* eslint-disable */
import { Product } from '../models/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.middleware.js';

// Creación de un producto
export const createProduct = asyncHandler(async (req, res) => {
    const {
        nombre,
        ref,
        descripcion,
        tipoProducto,
        frecuenciaFacturacion,
        precioUnitario,
        costeUnidad,
        activo,
        imagenUrl,
        stockDisponible,
    } = req.body;

    // La validación de campos obligatorios ya la hace
    // validateCreateProduct (middleware)
    const newProduct = await Product.create({
        nombre,
        ref: ref || `SKU-${Date.now().toString().slice(-6)}`,
        descripcion,
        tipoProducto,
        frecuenciaFacturacion: frecuenciaFacturacion || 'Pago único',
        precioUnitario: Number(precioUnitario) || 0,
        costeUnidad: Number(costeUnidad) || 0,
        activo: activo !== undefined ? activo : true,
        imagenUrl: imagenUrl || null,
        stockDisponible: stockDisponible !== undefined ? Number(stockDisponible) : 0,
        fechaCreacion: new Date(),
    });

    return res.status(201).json({
        message: 'Producto creado exitosamente',
        data: newProduct
    });
});


// Obtener todos los productos
export const getAllProducts = asyncHandler(async (req, res) => {
    const products = await Product.findAll({
        order: [['id', 'DESC']]
    });

    return res.status(200).json({
        message: 'Productos obtenidos exitosamente',
        data: products
    });
});


// Obtener un producto por su id
export const getProductById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const product = await Product.findByPk(id);

    if (!product) {
        return res.status(404).json({
            message: 'Producto no encontrado'
        });
    }

    return res.status(200).json({
        message: 'Producto obtenido con éxito',
        data: product
    });
});


// Actualizar un producto por su id
export const updateProductById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        nombre,
        ref,
        descripcion,
        tipoProducto,
        frecuenciaFacturacion,
        precioUnitario,
        costeUnidad,
        activo,
        imagenUrl,
        stockDisponible,
    } = req.body;

    const product = await Product.findByPk(id);

    if (!product) {
        return res.status(404).json({
            message: 'Producto no encontrado',
        });
    }

    await product.update({
        nombre: nombre ?? product.nombre,
        ref: ref ?? product.ref,
        descripcion: descripcion ?? product.descripcion,
        tipoProducto: tipoProducto ?? product.tipoProducto,
        frecuenciaFacturacion: frecuenciaFacturacion ?? product.frecuenciaFacturacion,
        precioUnitario: precioUnitario !== undefined ? Number(precioUnitario) : product.precioUnitario,
        costeUnidad: costeUnidad !== undefined ? Number(costeUnidad) : product.costeUnidad,
        activo: activo !== undefined ? activo : product.activo,
        imagenUrl: imagenUrl !== undefined ? imagenUrl : product.imagenUrl,
        stockDisponible: stockDisponible !== undefined ? Number(stockDisponible) : product.stockDisponible,
    });

    return res.status(200).json({
        message: 'Producto actualizado exitosamente',
        data: product
    });
});


// Eliminar un producto por su id
export const deleteProductById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const product = await Product.findByPk(id);

    if (!product) {
        return res.status(404).json({
            message: 'Producto no encontrado'
        });
    }

    await product.destroy();

    return res.status(200).json({
        message: 'Producto eliminado exitosamente'
    });
});
