import type { DiaDeRotinaNaFoto, FotoDoSprint, TarefaNaFoto } from '../../../domain/entities/PlacarDoSprint'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { ID, Paginated } from '../../../shared/types/common'

export interface SprintDoHistorico {
  sprintId: ID
  inicio: string
  fim: string
  fechadoEm: string | null
  total: number
  feitos: number
  percentual: number
  bonus: boolean
  /** Recompensa vigente no fechamento (gravada na foto); nula se não havia nenhuma. */
  recompensa: string | null
  /** Meta batida (≥ 90%) com uma recompensa em jogo. Sem recompensa não há o que conquistar. */
  recompensaConquistada: boolean
  rotina: FotoDoSprint['rotina'] & { dias: DiaDeRotinaNaFoto[] }
  tarefas: FotoDoSprint['tarefas'] & {
    /** Concluídas depois do prazo (já contadas em `concluidas`). */
    atrasadas: number
    naoConcluidas: number
    itens: TarefaNaFoto[]
  }
}

/** Monta a entrada do histórico só da foto gravada: segue completa mesmo após excluir ou arquivar tarefas. */
export function doHistorico(
  sprint: { id: ID; inicio: string; fim: string; fechadoEm: string | null },
  foto: FotoDoSprint,
): SprintDoHistorico {
  // Foto de antes do detalhe (#71) não tem `detalhe`/`recompensa`: tratada como vazia.
  const itens = foto.detalhe?.tarefas ?? []
  const recompensa = foto.recompensa ?? null
  return {
    sprintId: sprint.id,
    inicio: sprint.inicio,
    fim: sprint.fim,
    fechadoEm: sprint.fechadoEm,
    total: foto.total,
    feitos: foto.feitos,
    percentual: foto.percentual,
    bonus: foto.bonus,
    recompensa,
    recompensaConquistada: foto.bonus && recompensa !== null,
    rotina: { ...foto.rotina, dias: foto.detalhe?.rotina ?? [] },
    tarefas: {
      ...foto.tarefas,
      atrasadas: itens.filter((t) => t.situacao === 'ATRASADA').length,
      naoConcluidas: itens.filter((t) => t.situacao === 'NAO_CONCLUIDA').length,
      itens,
    },
  }
}

export class ListarHistoricoDeSprints {
  constructor(private readonly sprintRepository: SprintRepository) {}

  /** Sprints fechados, do mais recente ao mais antigo; página vazia quando não há nenhum. */
  async execute(userId: ID, page: number, pageSize: number): Promise<Paginated<SprintDoHistorico>> {
    const { sprints, total } = await this.sprintRepository.listarFechados(userId, page, pageSize)
    return {
      items: sprints.flatMap((sprint) => (sprint.foto ? [doHistorico(sprint, sprint.foto)] : [])),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    }
  }
}
