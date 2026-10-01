import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { entradasController } from '../controllers/entradasController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { confirmacaoQuerySchema, idParamSchema, resumoQuerySchema } from '../schemas/common.schema'
import { entradaPayloadSchema, listarEntradasQuerySchema } from '../schemas/entrada.schema'

export const entradasRoutes = Router()

entradasRoutes.use(authMiddleware)

entradasRoutes.get('/resumo', validate(resumoQuerySchema, 'query'), asyncHandler(entradasController.resumo))
entradasRoutes.get('/', validate(listarEntradasQuerySchema, 'query'), asyncHandler(entradasController.listar))
entradasRoutes.post('/', validate(entradaPayloadSchema), asyncHandler(entradasController.criar))
entradasRoutes.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(confirmacaoQuerySchema, 'query'),
  validate(entradaPayloadSchema),
  asyncHandler(entradasController.atualizar),
)
entradasRoutes.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(confirmacaoQuerySchema, 'query'),
  asyncHandler(entradasController.remover),
)
