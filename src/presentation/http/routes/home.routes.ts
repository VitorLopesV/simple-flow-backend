import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { homeController } from '../controllers/homeController'
import { authMiddleware } from '../middlewares/authMiddleware'

export const homeRoutes = Router()

homeRoutes.use(authMiddleware)
homeRoutes.get('/resumo', asyncHandler(homeController.resumo))
