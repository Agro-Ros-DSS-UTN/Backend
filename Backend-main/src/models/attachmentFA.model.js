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
<<<<<<< HEAD
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
        model: 'formularios_actividad',
        key: 'id_formulario'
    }
}
=======
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'formularios_actividad',
            key: 'idFormulario'
        }
    }
>>>>>>> a5eda5031eb10e2d9e70b5acbdc2a3282ec2364d
}, {
    tableName: 'archivos_adjuntos',
    timestamps: false
});

export default archivoAdjuntoFA;