/* eslint-disable */
import express from 'express'
import cors from 'cors'
import { 
  sequelize, 
  Client, 
  Opportunity, 
  activityForm, 
  User, 
  ProductLine 
} from './src/models/index.js'
import 'dotenv/config'
import clientRoutes from './src/routes/client.route.js'
import userRoutes from './src/routes/user.route.js'
import cityRoutes from './src/routes/locality.route.js'
import productLineRoutes from './src/routes/productLine.route.js'
import productRoutes from './src/routes/product.route.js'
import serviceRoutes from './src/routes/service.route.js'
import activityFormRoutes from './src/routes/activityForm.route.js'
import clientCompanyRoutes from './src/routes/clientCompany.route.js'
import opportunityRoutes from './src/routes/opportunity.route.js'
import taskRoutes from './src/routes/task.route.js'
import roadmapRoutes from './src/routes/roadmap.route.js'
import internalNoteRoutes from './src/routes/internalNote.route.js'
import targetRoutes from './src/routes/objective.route.js'
import promotionRoutes from './src/routes/promotion.route.js'
import { notFoundHandler, errorHandler } from './src/middlewares/errorHandler.middleware.js'

const port = process.env.PORT || 3000
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

const app = express()

app.use(cors({ origin: frontendUrl, credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

app.use(clientRoutes)
app.use(userRoutes) 
app.use(cityRoutes)
app.use(productLineRoutes)
app.use('/productos', productRoutes)
app.use(serviceRoutes)
app.use(activityFormRoutes)
app.use('/clientCompany', clientCompanyRoutes)
app.use(opportunityRoutes)
app.use(taskRoutes)
app.use(roadmapRoutes)
app.use(internalNoteRoutes)
app.use(targetRoutes)
app.use(promotionRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/dashboard', async (req, res, next) => {
  try {
    const [clients, opportunities, activities, sellers, productLines] = await Promise.all([
      Client ? Client.findAll() : [],
      Opportunity ? Opportunity.findAll() : [],
      activityForm ? activityForm.findAll() : [],
      User ? User.findAll({ where: { role: 'vendedor' } }) : [],
      ProductLine ? ProductLine.findAll() : []
    ]);

    res.json({
      clients,
      opportunities,
      activities,
      sellers,
      objectives: [],
      monthlySales: [],
      productLines
    });
  } catch (error) {
    next(error);
  }
});

app.use(notFoundHandler)
app.use(errorHandler)

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