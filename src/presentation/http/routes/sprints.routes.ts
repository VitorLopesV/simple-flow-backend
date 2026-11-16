import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { sprintsController } from '../controllers/sprintsController'
import { authMiddleware } from '../middlewares/authMiddleware'

export const sprintsRoutes = Router()

sprintsRoutes.use(authMiddleware)

sprintsRoutes.get('/atual', asyncHandler(sprintsController.atual))
sprintsRoutes.get('/proximo', asyncHandler(sprintsController.proximo))
sprintsRoutes.get('/atual/placar', asyncHandler(sprintsController.placarAtual))
sprintsRoutes.get('/proximo/placar', asyncHandler(sprintsController.placarProximo))
