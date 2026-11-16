import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { tarefasController } from '../controllers/tarefasController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { idParamSchema } from '../schemas/common.schema'
import {
  listarTarefasQuerySchema,
  moverTarefaSchema,
  tarefaEdicaoSchema,
  tarefaPayloadSchema,
} from '../schemas/tarefa.schema'

export const tarefasRoutes = Router()

tarefasRoutes.use(authMiddleware)

tarefasRoutes.get('/', validate(listarTarefasQuerySchema, 'query'), asyncHandler(tarefasController.listar))
tarefasRoutes.post('/', validate(tarefaPayloadSchema), asyncHandler(tarefasController.criar))
tarefasRoutes.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(tarefaEdicaoSchema),
  asyncHandler(tarefasController.atualizar),
)
tarefasRoutes.patch(
  '/:id/area',
  validate(idParamSchema, 'params'),
  validate(moverTarefaSchema),
  asyncHandler(tarefasController.mover),
)
tarefasRoutes.patch('/:id/arquivar', validate(idParamSchema, 'params'), asyncHandler(tarefasController.arquivar))
tarefasRoutes.patch('/:id/desarquivar', validate(idParamSchema, 'params'), asyncHandler(tarefasController.desarquivar))
tarefasRoutes.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(tarefasController.remover))
