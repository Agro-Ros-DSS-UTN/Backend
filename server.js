/* eslint-disable */
import fs from 'node:fs/promises'
import express from 'express'
// 👇 1. IMPORTAMOS LA CONEXIÓN CENTRALIZADA Y LOS MODELOS
import { sequelize } from './src/models/index.js'
import 'dotenv/config' // Asegura que lea el archivo .env

// Constants
const isProduction = process.env.NODE_ENV === 'production'
// 👇 Modificamos para que use el PORT del .env si existe, o el 5173 por defecto
const port = process.env.PORT 
const base = process.env.BASE || '/'

// Cached production assets
const templateHtml = isProduction
  ? fs.readFile('./dist/client/index.html', 'utf-8')
  : ''

// Create http server
const app = express()

// 👇 2. MIDDLEWARE PARA ENVENTAR RECIBIR JSON (Crucial para tus futuras rutas de la API)
app.use(express.json())

// Add Vite or respective production middlewares
/** @type {import('vite').ViteDevServer | undefined} */
let vite
if (!isProduction) {
  const { createServer } = await import('vite')
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    base,
  })
  app.use(vite.middlewares)
} else {
  const compression = (await import('compression')).default
  const sirv = (await import('sirv')).default
  app.use(compression())
  app.use(base, sirv('./dist/client', { extensions: [] }))
}

// ==========================================
// 💡 AQUÍ ADENTRO IRÁN TUS RUTAS DE LA API MÁS ADELANTE
// Ejemplo: app.use('/api/clientes', clienteRoutes)
// ==========================================

// Serve HTML
app.use('*all', async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, '')

    /** @type {string} */
    let template
    /** @type {import('./src/entry-server.js').render} */
    let render
    if (!isProduction) {
      // Always read fresh template in development
      template = await fs.readFile('./index.html', 'utf-8')
      template = await vite.transformIndexHtml(url, template)
      render = (await vite.ssrLoadModule('/src/entry-server.js')).render
    } else {
      template = templateHtml
      render = (await import('./dist/server/entry-server.js')).render
    }

    const rendered = await render(url)

    const html = template
      .replace(``, rendered.head ?? '')
      .replace(``, rendered.html ?? '')

    res.status(200).set({ 'Content-Type': 'text/html' }).send(html)
  } catch (e) {
    vite?.ssrFixStacktrace(e)
    console.log(e.stack)
    res.status(500).end(e.stack)
  }
})

// 👇 3. REEMPLAZAMOS EL APP.LISTEN VIEJO POR ESTA FUNCIÓN ASÍNCRONA
async function startServer() {
  try {
    // Autentica y sincroniza los modelos (Persona, Cliente, Usuario) con MySQL
    await sequelize.sync({ alter: true });
    console.log('---------------------------------------------------------');
    console.log('     ¡Conexión a MySQL exitosa y tablas sincronizadas!  ');
    console.log('---------------------------------------------------------');

    // Una vez que la base de datos respondió bien, recién ahí levantamos Express
    app.listen(port, () => {
      console.log(`Server started at http://localhost:${port}`)
    })
  } catch (error) {
    console.error('❌ ERROR CRÍTICO Al conectar la base de datos:', error);
    process.exit(1); // Detiene la app si no se pudo conectar a MySQL
  }
}

// Ejecutamos el arranque
startServer()