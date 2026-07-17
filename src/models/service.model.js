import { DataTypes } from 'sequelize';
import { sequelize } from './index.js'; // O la ruta correspondiente a tu conexión de Sequelize

const Servicio = sequelize.define('Servicio', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
        
    },
    tipoServicio: {
        type: DataTypes.STRING,
        allowNull: false
    },
    desc: {
        type: DataTypes.STRING,
        allowNull: true // Puede ser opcional la descripción
    },
    // CLAVE FORÁNEA: Aquí forzamos la dependencia fuerte hacia FormularioActividad
    formularioActividadId: {
        type: DataTypes.INTEGER,
        allowNull: false, // NO puede ser nulo, garantizando que sea entidad débil
        references: {
            model: 'FormularioActividad', // Debe coincidir con el nombre de la tabla de formularios
            key: 'idFormulario'           // Debe coincidir con la clave primaria de ese modelo
        }
    }
}, {
    tableName: 'services',
    timestamps: true
});

export default Servicio;