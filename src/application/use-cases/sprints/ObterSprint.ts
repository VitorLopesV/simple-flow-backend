import type { OcorrenciaPlanejada, OcorrenciaRotina } from '../../../domain/entities/OcorrenciaRotina'
import type { Sprint } from '../../../domain/entities/Sprint'
import type { ItemRotinaRepository } from '../../../domain/repositories/ItemRotinaRepository'
import type { OcorrenciaRotinaRepository } from '../../../domain/repositories/OcorrenciaRotinaRepository'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import { calcularOcorrenciasDoSprint } from '../../../domain/services/ocorrenciasDoSprint'
import type { ID } from '../../../shared/types/common'
import { addDias, dataAtual, segundaDaSemana } from '../../../shared/utils/periodo'

export type AlvoDoSprint = 'ATUAL' | 'PROXIMO'

/** Ocorrência no formato de resposta; `id` nulo na prévia (ainda não gravada). */
export interface OcorrenciaDoSprint extends OcorrenciaPlanejada {
  id: ID | null
  concluidaEm: string | null
}

export interface SprintComRotina {
  sprint: Sprint
  /** Já chegou a segunda 00:00 do sprint. */
  iniciado: boolean
  /** `true` = rotina calculada da configuração atual, ainda não congelada no sprint. */
  previa: boolean
  ocorrencias: OcorrenciaDoSprint[]
  /** Sábado/domingo do modo "a cada N dias": fora do sprint e sem pontos. */
  lembretes: OcorrenciaDoSprint[]
}

function daPrevia(lista: OcorrenciaPlanejada[]): OcorrenciaDoSprint[] {
  return lista.map((ocorrencia) => ({ ...ocorrencia, id: null, concluidaEm: null }))
}

function gravada(ocorrencia: OcorrenciaRotina): OcorrenciaDoSprint {
  return {
    id: ocorrencia.id,
    itemId: ocorrencia.itemId,
    nome: ocorrencia.nome,
    data: ocorrencia.data,
    hora: ocorrencia.hora,
    indice: ocorrencia.indice,
    ordem: ocorrencia.ordem,
    concluidaEm: ocorrencia.concluidaEm,
  }
}

export class ObterSprint {
  constructor(
    private readonly sprintRepository: SprintRepository,
    private readonly ocorrenciaRepository: OcorrenciaRotinaRepository,
    private readonly itemRotinaRepository: ItemRotinaRepository,
  ) {}

  /**
   * Sprint da semana de hoje (America/Sao_Paulo) ou da seguinte, criado se não existir.
   * A rotina é gravada uma única vez, no primeiro acesso a partir da segunda 00:00 (SP); antes
   * disso o planejamento recebe só uma prévia calculada da configuração atual.
   */
  async execute(userId: ID, alvo: AlvoDoSprint, agora: Date = new Date()): Promise<SprintComRotina> {
    const hoje = dataAtual(agora)
    const segunda = segundaDaSemana(hoje)
    const inicio = alvo === 'ATUAL' ? segunda : addDias(segunda, 7)

    let sprint = await this.sprintRepository.garantir(userId, inicio, addDias(inicio, 4))
    const iniciado = hoje >= inicio

    if (sprint.rotinaGeradaEm === null) {
      const itens = await this.itemRotinaRepository.listar(userId)
      const { ocorrencias, lembretes } = calcularOcorrenciasDoSprint(itens, inicio)

      if (!iniciado) {
        return { sprint, iniciado, previa: true, ocorrencias: daPrevia(ocorrencias), lembretes: daPrevia(lembretes) }
      }

      // Idempotente por chave única: um acesso concorrente ou uma falha antes do marcar não duplica.
      await this.ocorrenciaRepository.inserirVarias(userId, sprint.id, ocorrencias, lembretes)
      const quando = agora.toISOString()
      await this.sprintRepository.marcarRotinaGerada(userId, sprint.id, quando)
      sprint = { ...sprint, rotinaGeradaEm: quando }
    }

    const gravadas = await this.ocorrenciaRepository.listarDoSprint(userId, sprint.id)
    return {
      sprint,
      iniciado,
      previa: false,
      ocorrencias: gravadas.filter((o) => !o.lembrete).map(gravada),
      lembretes: gravadas.filter((o) => o.lembrete).map(gravada),
    }
  }
}
