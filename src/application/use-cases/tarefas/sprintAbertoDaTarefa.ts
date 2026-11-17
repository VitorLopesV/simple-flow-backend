import type { Tarefa } from '../../../domain/entities/Tarefa'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { ID } from '../../../shared/types/common'

export const MENSAGEM_CONCLUIDA_NO_SPRINT_ABERTO_NAO_EXCLUI =
  'Esta tarefa concluída faz parte do sprint aberto e não pode ser excluída: espere o sprint fechar (sexta, 23:59) e então arquive-a.'

export const MENSAGEM_CONCLUIDA_NO_SPRINT_ABERTO_NAO_ARQUIVA =
  'Esta tarefa concluída faz parte do sprint aberto: ela só pode ser arquivada depois que o sprint fechar (sexta, 23:59).'

/**
 * A tarefa está num sprint que ainda não fechou? Depois do fechamento só as não concluídas saem do sprint (#71);
 * a concluída continua apontando para ele, então vale a situação do sprint. Concluída sem sprint (concluída num
 * fim de semana, por exemplo) não está em nenhum sprint aberto.
 */
export async function tarefaNoSprintAberto(
  sprintRepository: SprintRepository,
  userId: ID,
  tarefa: Pick<Tarefa, 'sprintId'>,
): Promise<boolean> {
  if (!tarefa.sprintId) return false
  const sprint = await sprintRepository.buscarPorId(userId, tarefa.sprintId)
  return sprint?.situacao === 'ABERTO'
}
