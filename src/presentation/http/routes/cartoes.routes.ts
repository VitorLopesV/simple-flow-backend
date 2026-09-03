import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { cartoesController } from '../controllers/cartoesController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import {
  cartaoIdParamSchema,
  cartaoPayloadSchema,
  faturaFiltroQuerySchema,
  transacaoCartaoParamsSchema,
  transacaoCartaoPayloadSchema,
} from '../schemas/cartao.schema'
import { idParamSchema } from '../schemas/common.schema'

export const cartoesRoutes = Router()

cartoesRoutes.use(authMiddleware)

// Segue o caminho real usado por frontend/src/services/cartaoService.ts (GET /cartoes/faturas
// com query competencia/cartaoId), não o /cartoes/:id/faturas documentado originalmente no README.
cartoesRoutes.get('/faturas', validate(faturaFiltroQuerySchema, 'query'), asyncHandler(cartoesController.listarComFaturas))
// Débitos do cartão: mesmo formato de uma saída, mas presos ao cartão — só por aqui
// eles podem ser criados, editados ou removidos (na aba Saídas a fatura é só leitura).
cartoesRoutes.post(
  '/:cartaoId/transacoes',
  validate(cartaoIdParamSchema, 'params'),
  validate(transacaoCartaoPayloadSchema),
  asyncHandler(cartoesController.criarTransacao),
)
cartoesRoutes.put(
  '/:cartaoId/transacoes/:id',
  validate(transacaoCartaoParamsSchema, 'params'),
  validate(transacaoCartaoPayloadSchema),
  asyncHandler(cartoesController.atualizarTransacao),
)
cartoesRoutes.delete(
  '/:cartaoId/transacoes/:id',
  validate(transacaoCartaoParamsSchema, 'params'),
  asyncHandler(cartoesController.removerTransacao),
)

cartoesRoutes.get('/', asyncHandler(cartoesController.listar))
cartoesRoutes.post('/', validate(cartaoPayloadSchema), asyncHandler(cartoesController.criar))
cartoesRoutes.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(cartaoPayloadSchema),
  asyncHandler(cartoesController.atualizar),
)
cartoesRoutes.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(cartoesController.remover))
