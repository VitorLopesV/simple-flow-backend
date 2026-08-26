import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { dashboardController } from '../controllers/dashboardController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { resumoQuerySchema } from '../schemas/common.schema'

export const dashboardRoutes = Router()

dashboardRoutes.use(authMiddleware)
dashboardRoutes.get('/resumo', validate(resumoQuerySchema, 'query'), asyncHandler(dashboardController.resumo))
