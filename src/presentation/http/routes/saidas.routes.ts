import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { saidasController } from '../controllers/saidasController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { confirmacaoQuerySchema, idParamSchema, resumoQuerySchema } from '../schemas/common.schema'
import { listarSaidasQuerySchema, saidaPayloadSchema } from '../schemas/saida.schema'

export const saidasRoutes = Router()

saidasRoutes.use(authMiddleware)

saidasRoutes.get('/resumo', validate(resumoQuerySchema, 'query'), asyncHandler(saidasController.resumo))
saidasRoutes.get('/', validate(listarSaidasQuerySchema, 'query'), asyncHandler(saidasController.listar))
saidasRoutes.post('/', validate(saidaPayloadSchema), asyncHandler(saidasController.criar))
saidasRoutes.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(confirmacaoQuerySchema, 'query'),
  validate(saidaPayloadSchema),
  asyncHandler(saidasController.atualizar),
)
saidasRoutes.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(confirmacaoQuerySchema, 'query'),
  asyncHandler(saidasController.remover),
)
