import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { cartoesController } from '../controllers/cartoesController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { idParamSchema } from '../schemas/common.schema'

export const faturasRoutes = Router()

faturasRoutes.use(authMiddleware)

faturasRoutes.patch('/:id/pagar', validate(idParamSchema, 'params'), asyncHandler(cartoesController.pagarFatura))
