import type { EstadoSuperTask, SuperTask } from '../entities/SuperTask'
import type { Tarefa } from '../entities/Tarefa'

export interface ProgressoDaSuperTask {
  totalFilhas: number
  filhasConcluidas: number
  progresso: number
  estado: EstadoSuperTask
  vencida: boolean
  podeConcluir: boolean
}

/** Todas as filhas concluídas (e há pelo menos uma): é o que autoriza a conclusão da Super task. */
export function todasConcluidas(filhas: Pick<Tarefa, 'concluida'>[]): boolean {
  return filhas.length > 0 && filhas.every((filha) => filha.concluida)
}

/**
 * Progresso e estado derivados das filhas, nunca marcados à mão. Filha arquivada concluída conta como
 * feita; filha excluída nem chega aqui (sai da conta). Sem filhas: 0% e não iniciada. A Super task
 * reaberta ainda em 100% fica "em andamento" até ser marcada de novo; `hoje` é a data de São Paulo.
 */
export function calcularProgresso(
  superTask: Pick<SuperTask, 'concluida' | 'dataTermino'>,
  filhas: Pick<Tarefa, 'concluida'>[],
  hoje: string,
): ProgressoDaSuperTask {
  const totalFilhas = filhas.length
  const filhasConcluidas = filhas.filter((filha) => filha.concluida).length
  const progresso = totalFilhas === 0 ? 0 : Math.floor((filhasConcluidas * 100) / totalFilhas)

  let estado: EstadoSuperTask = 'EM_ANDAMENTO'
  if (superTask.concluida) estado = 'CONCLUIDA'
  else if (filhasConcluidas === 0) estado = 'NAO_INICIADA'

  return {
    totalFilhas,
    filhasConcluidas,
    progresso,
    estado,
    vencida: !superTask.concluida && superTask.dataTermino !== null && superTask.dataTermino < hoje,
    podeConcluir: !superTask.concluida && todasConcluidas(filhas),
  }
}
