import { Router } from 'express'

import { authRoutes } from './auth.routes'
import { cartoesRoutes } from './cartoes.routes'
import { categoriasRoutes } from './categorias.routes'
import { dashboardRoutes } from './dashboard.routes'
import { entradasRoutes } from './entradas.routes'
import { faturasRoutes } from './faturas.routes'
import { saidasRoutes } from './saidas.routes'

export const routes = Router()

routes.get('/health', (_req, res) => res.json({ status: 'ok' }))
routes.use('/auth', authRoutes)
routes.use('/categorias', categoriasRoutes)
routes.use('/entradas', entradasRoutes)
routes.use('/saidas', saidasRoutes)
routes.use('/cartoes', cartoesRoutes)
routes.use('/faturas', faturasRoutes)
routes.use('/dashboard', dashboardRoutes)
