import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { cartoesController } from '../controllers/cartoesController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { cartaoPayloadSchema, faturaFiltroQuerySchema } from '../schemas/cartao.schema'
import { idParamSchema } from '../schemas/common.schema'

export const cartoesRoutes = Router()

cartoesRoutes.use(authMiddleware)

// Segue o caminho real usado por frontend/src/services/cartaoService.ts (GET /cartoes/faturas
// com query competencia/cartaoId), não o /cartoes/:id/faturas documentado originalmente no README.
cartoesRoutes.get('/faturas', validate(faturaFiltroQuerySchema, 'query'), asyncHandler(cartoesController.listarComFaturas))
cartoesRoutes.get('/', asyncHandler(cartoesController.listar))
cartoesRoutes.post('/', validate(cartaoPayloadSchema), asyncHandler(cartoesController.criar))
cartoesRoutes.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(cartaoPayloadSchema),
  asyncHandler(cartoesController.atualizar),
)
cartoesRoutes.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(cartoesController.remover))
