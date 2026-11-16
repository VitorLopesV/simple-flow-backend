import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { rotinasController } from '../controllers/rotinasController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { idParamSchema } from '../schemas/common.schema'
import { rotinaPayloadSchema } from '../schemas/rotina.schema'

export const rotinasRoutes = Router()

rotinasRoutes.use(authMiddleware)

rotinasRoutes.get('/', asyncHandler(rotinasController.listar))
rotinasRoutes.post('/', validate(rotinaPayloadSchema), asyncHandler(rotinasController.criar))
rotinasRoutes.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(rotinaPayloadSchema),
  asyncHandler(rotinasController.atualizar),
)
rotinasRoutes.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(rotinasController.remover))
