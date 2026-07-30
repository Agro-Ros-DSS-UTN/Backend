/* eslint-disable */

import Locality from '../models/locality.model.js';

// Creacion de una localidad
export const createLocality = async (req, res) => {
    try {
        const { codPostal, nomLocalidad } = req.body;

        if (!codPostal || !nomLocalidad) {
            return res.status(400).json({
                message: "El codigo postal y el nombre de la localidad son obligatorios"
            });
        }

        const newLocality = await Locality.create({
            codPostal,
            nomLocalidad
        });

        return res.status(201).json({
            message: "Localidad creada exitosamente",
            data: newLocality
        });

    } catch (error) {
        console.error("Error al crear la localidad:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};

// Obtener todas las localidades
export const getAllLocalities = async (req, res) => {
    try {
        const localities = await Locality.findAll();

        return res.status(200).json({
            message: "Localidades obtenidas exitosamente",
            data: localities
        });
    } catch (error) {
        console.error("Error al obtener las localidades:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};

// Obtener una localidad por su codigo postal
export const getLocalityById = async (req, res) => {
    try {
        const { codPostal } = req.params;
        const locality = await Locality.findByPk(codPostal);

        if (!locality) {
            return res.status(404).json({
                message: "Localidad no encontrada"
            });
        }

        return res.status(200).json({
            message: "Localidad obtenida exitosamente",
            data: locality
        });

    } catch (error) {
        console.error("Error al obtener la localidad:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};

// Actualizar una localidad por su codigo postal
export const updateLocality = async (req, res) => {
    try {
        const { codPostal } = req.params;
        const { nomLocalidad } = req.body;

        const locality = await Locality.findByPk(codPostal);

        if (!locality) {
            return res.status(404).json({
                message: "Localidad no encontrada"
            });
        }

        await locality.update({
            nomLocalidad
        });

        return res.status(200).json({
            message: "Localidad actualizada exitosamente",
            data: locality
        });

    } catch (error) {
        console.error("Error al actualizar la localidad:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};

// Eliminar una localidad por su codigo postal
export const deleteLocality = async (req, res) => {
    try {
        const { codPostal } = req.params;
        const locality = await Locality.findByPk(codPostal);

        if (!locality) {
            return res.status(404).json({
                message: "Localidad no encontrada"
            });
        }

        await locality.destroy();

        return res.status(200).json({
            message: "Localidad eliminada exitosamente"
        });

    } catch (error) {
        console.error("Error al eliminar la localidad:", error);
        return res.status(500).json({
            message: "Hubo un error interno en el servidor",
            error: error.message
        });
    }
};