/* eslint-disable */

import { Sequelize } from 'sequelize';
import 'dotenv/config';

const sequelize = new Sequelize(
  process.env.DB_NAME ,
  process.env.DB_USER ,
  process.env.DB_PASS ,
  {
    host: process.env.DB_HOST ,
    port: process.env.DB_PORT , // 👈 Le pasamos el puerto de Aiven
    dialect: 'mysql',
    logging: false, 
    dialectOptions: {
      ssl: {
        rejectUnauthorized: false // 👈 Esto permite conectar de forma segura sin descargar el archivo .pem
      }
    },
    define: {
      timestamps: false,
      underscored: true, 
    }
  }
);

export default sequelize;