import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { categoriasController } from '../controllers/categoriasController'
import { authMiddleware } from '../middlewares/authMiddleware'

export const categoriasRoutes = Router()

categoriasRoutes.use(authMiddleware)
categoriasRoutes.get('/', asyncHandler(categoriasController.listar))
