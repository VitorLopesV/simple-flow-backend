import { Router } from 'express'

import { areasRoutes } from './areas.routes'
import { authRoutes } from './auth.routes'
import { cartoesRoutes } from './cartoes.routes'
import { categoriasRoutes } from './categorias.routes'
import { dashboardRoutes } from './dashboard.routes'
import { entradasRoutes } from './entradas.routes'
import { faturasRoutes } from './faturas.routes'
import { keepaliveRoutes } from './keepalive.routes'
import { navegacaoRoutes } from './navegacao.routes'
import { rotinasRoutes } from './rotinas.routes'
import { saidasRoutes } from './saidas.routes'
import { sprintsRoutes } from './sprints.routes'
import { tarefasRoutes } from './tarefas.routes'

export const routes = Router()

routes.get('/health', (_req, res) => res.json({ status: 'ok' }))
routes.use('/keepalive', keepaliveRoutes)
routes.use('/auth', authRoutes)
routes.use('/areas', areasRoutes)
routes.use('/categorias', categoriasRoutes)
routes.use('/tarefas', tarefasRoutes)
routes.use('/rotinas', rotinasRoutes)
routes.use('/sprints', sprintsRoutes)
routes.use('/entradas', entradasRoutes)
routes.use('/saidas', saidasRoutes)
routes.use('/cartoes', cartoesRoutes)
routes.use('/faturas', faturasRoutes)
routes.use('/dashboard', dashboardRoutes)
routes.use('/navegacao', navegacaoRoutes)
