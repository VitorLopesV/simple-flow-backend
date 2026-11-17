import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { alertasController } from '../controllers/alertasController'
import { authMiddleware } from '../middlewares/authMiddleware'

export const alertasRoutes = Router()

alertasRoutes.use(authMiddleware)
alertasRoutes.get('/', asyncHandler(alertasController.listar))
