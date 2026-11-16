import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { areasController } from '../controllers/areasController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { areaPayloadSchema, removerAreaQuerySchema } from '../schemas/area.schema'
import { idParamSchema } from '../schemas/common.schema'

export const areasRoutes = Router()

areasRoutes.use(authMiddleware)

areasRoutes.get('/', asyncHandler(areasController.listar))
areasRoutes.post('/', validate(areaPayloadSchema), asyncHandler(areasController.criar))
areasRoutes.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(areaPayloadSchema),
  asyncHandler(areasController.atualizar),
)
areasRoutes.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(removerAreaQuerySchema, 'query'),
  asyncHandler(areasController.remover),
)
