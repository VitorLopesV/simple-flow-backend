import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { dashboardController } from '../controllers/dashboardController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { daCompetencia, limiteDeCompetencia } from '../middlewares/limiteDeCompetencia'
import { validate } from '../middlewares/validate'
import { resumoQuerySchema } from '../schemas/common.schema'

export const dashboardRoutes = Router()

dashboardRoutes.use(authMiddleware)
dashboardRoutes.get(
  '/resumo',
  validate(resumoQuerySchema, 'query'),
  limiteDeCompetencia(daCompetencia),
  asyncHandler(dashboardController.resumo),
)
