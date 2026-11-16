import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { superTasksController } from '../controllers/superTasksController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { idParamSchema } from '../schemas/common.schema'
import {
  adicionarFilhaSchema,
  converterEmSuperTaskSchema,
  filhaParamsSchema,
  listarSuperTasksQuerySchema,
  moverSuperTaskSchema,
  removerSuperTaskQuerySchema,
  superTaskEdicaoSchema,
  superTaskPayloadSchema,
} from '../schemas/superTask.schema'

export const superTasksRoutes = Router()

superTasksRoutes.use(authMiddleware)

superTasksRoutes.get('/', validate(listarSuperTasksQuerySchema, 'query'), asyncHandler(superTasksController.listar))
superTasksRoutes.post('/', validate(superTaskPayloadSchema), asyncHandler(superTasksController.criar))
// Antes das rotas com `/:id`, para "converter" nunca ser lido como identificador.
superTasksRoutes.post('/converter', validate(converterEmSuperTaskSchema), asyncHandler(superTasksController.converter))
superTasksRoutes.get('/:id', validate(idParamSchema, 'params'), asyncHandler(superTasksController.obter))
superTasksRoutes.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(superTaskEdicaoSchema),
  asyncHandler(superTasksController.atualizar),
)
superTasksRoutes.patch(
  '/:id/area',
  validate(idParamSchema, 'params'),
  validate(moverSuperTaskSchema),
  asyncHandler(superTasksController.mover),
)
superTasksRoutes.patch('/:id/concluir', validate(idParamSchema, 'params'), asyncHandler(superTasksController.concluir))
superTasksRoutes.delete('/:id/conclusao', validate(idParamSchema, 'params'), asyncHandler(superTasksController.desmarcarConclusao))
superTasksRoutes.patch('/:id/arquivar', validate(idParamSchema, 'params'), asyncHandler(superTasksController.arquivar))
superTasksRoutes.patch('/:id/desarquivar', validate(idParamSchema, 'params'), asyncHandler(superTasksController.desarquivar))
superTasksRoutes.post(
  '/:id/tarefas',
  validate(idParamSchema, 'params'),
  validate(adicionarFilhaSchema),
  asyncHandler(superTasksController.adicionarFilha),
)
superTasksRoutes.delete('/:id/tarefas/:tarefaId', validate(filhaParamsSchema, 'params'), asyncHandler(superTasksController.retirarFilha))
superTasksRoutes.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(removerSuperTaskQuerySchema, 'query'),
  asyncHandler(superTasksController.remover),
)
