import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { keepaliveController } from '../controllers/keepaliveController'
import { cronMiddleware } from '../middlewares/cronMiddleware'

export const keepaliveRoutes = Router()

keepaliveRoutes.use(cronMiddleware)
keepaliveRoutes.get('/', asyncHandler(keepaliveController.verificar))
