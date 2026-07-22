import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const archivoAdjuntoFA = sequelize.define('ArchivoAdjunto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    rutaArchivo: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    
    formularioActividadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
        model: 'formularios_actividad',
        key: 'id_formulario'
    }
}
}, {
    tableName: 'archivos_adjuntos',
    timestamps: false
});

export default archivoAdjuntoFA;