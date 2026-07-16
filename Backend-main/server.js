/* eslint-disable */
import express from 'express'
import cors from 'cors'
import { sequelize } from './src/models/index.js'
import 'dotenv/config'
import clientRoutes from './src/routes/client.route.js'
import userRoutes from './src/routes/user.route.js'
import providerRoutes from './src/routes/provider.route.js'

const port = process.env.PORT || 3000
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

const app = express()

app.use(cors({ origin: frontendUrl, credentials: true }))
app.use(express.json())
app.use(clientRoutes)
app.use(userRoutes) 
app.use(providerRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

async function startServer() {
  try {
    await sequelize.sync({ alter: true })
    console.log('---------------------------------------------------------')
    console.log('     ¡Conexión a MySQL exitosa y tablas sincronizadas!  ')
    console.log('---------------------------------------------------------')

    app.listen(port, () => {
      console.log(`API corriendo en http://localhost:${port}`)
    })
  } catch (error) {
    console.error('❌ ERROR CRÍTICO al conectar la base de datos:', error)
    process.exit(1)
  }
}

startServer()
