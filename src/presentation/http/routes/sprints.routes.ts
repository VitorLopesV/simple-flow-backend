import { Router } from 'express'

import { asyncHandler } from '../../../shared/utils/asyncHandler'
import { sprintsController } from '../controllers/sprintsController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { idParamSchema } from '../schemas/common.schema'
import {
  adicionarTarefaAoSprintSchema,
  historicoQuerySchema,
  moverTarefaNoSprintSchema,
  recompensaDoSprintSchema,
  recompensaPadraoSchema,
} from '../schemas/sprint.schema'

export const sprintsRoutes = Router()

sprintsRoutes.use(authMiddleware)

sprintsRoutes.get('/atual', asyncHandler(sprintsController.atual))
sprintsRoutes.get('/proximo', asyncHandler(sprintsController.proximo))
sprintsRoutes.get('/atual/placar', asyncHandler(sprintsController.placarAtual))
sprintsRoutes.get('/proximo/placar', asyncHandler(sprintsController.placarProximo))

// Recompensa real (#72): a do sprint (atual ou próximo, só enquanto aberto) e a padrão do usuário.
sprintsRoutes.put('/atual/recompensa', validate(recompensaDoSprintSchema), asyncHandler(sprintsController.recompensaAtual))
sprintsRoutes.put('/proximo/recompensa', validate(recompensaDoSprintSchema), asyncHandler(sprintsController.recompensaProximo))
sprintsRoutes.get('/recompensa-padrao', asyncHandler(sprintsController.obterRecompensaPadrao))
sprintsRoutes.put('/recompensa-padrao', validate(recompensaPadraoSchema), asyncHandler(sprintsController.definirRecompensaPadrao))

// Histórico paginado dos sprints fechados (a partir da foto gravada no fechamento).
sprintsRoutes.get('/historico', validate(historicoQuerySchema, 'query'), asyncHandler(sprintsController.historico))

// Rotina: concluir a ocorrência (só no próprio dia).
sprintsRoutes.patch('/ocorrencias/:id/concluir', validate(idParamSchema, 'params'), asyncHandler(sprintsController.concluirOcorrencia))

// Tarefas no sprint: o dia vem do corpo e o sprint (atual ou próximo) é deduzido dele.
sprintsRoutes.post('/tarefas', validate(adicionarTarefaAoSprintSchema), asyncHandler(sprintsController.adicionarTarefa))
sprintsRoutes.patch(
  '/tarefas/:id/dia',
  validate(idParamSchema, 'params'),
  validate(moverTarefaNoSprintSchema),
  asyncHandler(sprintsController.moverTarefa),
)
sprintsRoutes.delete('/tarefas/:id', validate(idParamSchema, 'params'), asyncHandler(sprintsController.removerTarefa))
