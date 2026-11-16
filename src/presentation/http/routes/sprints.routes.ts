import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { sprintsController } from '../controllers/sprintsController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { idParamSchema } from '../schemas/common.schema'
import { adicionarTarefaAoSprintSchema, moverTarefaNoSprintSchema } from '../schemas/sprint.schema'

export const sprintsRoutes = Router()

sprintsRoutes.use(authMiddleware)

sprintsRoutes.get('/atual', asyncHandler(sprintsController.atual))
sprintsRoutes.get('/proximo', asyncHandler(sprintsController.proximo))
sprintsRoutes.get('/atual/placar', asyncHandler(sprintsController.placarAtual))
sprintsRoutes.get('/proximo/placar', asyncHandler(sprintsController.placarProximo))

// Tarefas no sprint: o dia vem do corpo e o sprint (atual ou próximo) é deduzido dele.
sprintsRoutes.post('/tarefas', validate(adicionarTarefaAoSprintSchema), asyncHandler(sprintsController.adicionarTarefa))
sprintsRoutes.patch(
  '/tarefas/:id/dia',
  validate(idParamSchema, 'params'),
  validate(moverTarefaNoSprintSchema),
  asyncHandler(sprintsController.moverTarefa),
)
sprintsRoutes.delete('/tarefas/:id', validate(idParamSchema, 'params'), asyncHandler(sprintsController.removerTarefa))
