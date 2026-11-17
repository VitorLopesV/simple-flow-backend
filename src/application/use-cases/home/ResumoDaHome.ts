import type { DashboardResumo } from '../../../domain/entities/Dashboard'
import type { Saida } from '../../../domain/entities/Saida'
import type { Tarefa } from '../../../domain/entities/Tarefa'
import type { SaidaRepository } from '../../../domain/repositories/SaidaRepository'
import type { TarefaRepository } from '../../../domain/repositories/TarefaRepository'
import type { TarefasDoSprintRepository } from '../../../domain/repositories/TarefasDoSprintRepository'
import { tarefaAtrasada } from '../../../domain/services/atraso'
import type { ID } from '../../../shared/types/common'
import { addDias, competenciaAtual, dataAtual, paraPeriodo, segundaDaSemana } from '../../../shared/utils/periodo'
import { estaVencida } from '../../../shared/utils/situacao'
import type { ResumoDashboard } from '../dashboard/ResumoDashboard'
import { ObterPlacarDoSprint } from '../sprints/ObterPlacarDoSprint'
import type { ObterSprint, OcorrenciaDoSprint } from '../sprints/ObterSprint'

export interface OcorrenciaNaHome {
  id: ID | null
  nome: string
  /** YYYY-MM-DD */
  data: string
  /** HH:MM; só ordena, nunca gera atraso. */
  hora: string | null
  concluida: boolean
  concluidaEm: string | null
}

export interface TarefaNaHome {
  id: ID
  titulo: string
  areaId: ID
  dia: string
  hora: string | null
  tempoEstimado: Tarefa['tempoEstimado']
  dificuldade: Tarefa['dificuldade']
  prioridade: Tarefa['prioridade']
  /** Está no sprint (pontua); `false` = só planejada para o dia. */
  noSprint: boolean
  concluida: boolean
  concluidaEm: string | null
  /** Concluída: fora do prazo (vale 20%). Pendente: o prazo já passou neste instante. Mesma regra, `tarefaAtrasada`. */
  atrasada: boolean
}

export interface ContaDaSemana {
  id: ID
  descricao: string
  valor: number
  /** YYYY-MM-DD */
  vencimento: string
  /** Pendente com vencimento antes de hoje (ainda dentro da semana). */
  vencida: boolean
  /** Fatura de cartão (derivada, não editável). */
  automatica: boolean
  categoriaId: ID
  formaPagamento: Saida['formaPagamento']
}

export interface ResumoDaHomeDados {
  /** YYYY-MM-DD, America/Sao_Paulo. */
  hoje: string
  /** Sábado ou domingo: o sprint "atual" é o que acabou de fechar. */
  fimDeSemana: boolean
  /** Segunda a domingo da semana de hoje (sábado e domingo pertencem à semana que acabou, como no sprint). */
  semana: { inicio: string; fim: string }
  missaoDoDia: { total: number; concluidas: number; ocorrencias: OcorrenciaNaHome[] }
  tarefasDeHoje: TarefaNaHome[]
  placar: {
    sprintId: ID
    inicio: string
    fim: string
    fechado: boolean
    fechadoEm: string | null
    total: number
    feitos: number
    percentual: number
    bonus: boolean
    recompensa: string | null
  }
  contasDaSemana: { total: number; quantidade: number; contas: ContaDaSemana[] }
  financas: Pick<
    DashboardResumo,
    'totalEntradas' | 'totalSaidas' | 'saldo' | 'totalFaturas' | 'variacaoEntradas' | 'variacaoSaidas' | 'serieEntradas' | 'serieSaidas'
  > & { competencia: string }
  lembretes: OcorrenciaNaHome[]
}

/** Hora (HH:MM) crescente, sem hora no fim; empates pela `chave` informada. */
function porHora<T extends { hora: string | null }>(a: T, b: T, desempate: (a: T, b: T) => number): number {
  if (a.hora !== b.hora) {
    if (a.hora === null) return 1
    if (b.hora === null) return -1
    return a.hora.localeCompare(b.hora)
  }
  return desempate(a, b)
}

function naHome(o: OcorrenciaDoSprint): OcorrenciaNaHome {
  return { id: o.id, nome: o.nome, data: o.data, hora: o.hora, concluida: o.concluidaEm !== null, concluidaEm: o.concluidaEm }
}

/**
 * Tudo o que a Home precisa numa chamada, só leitura. "Hoje" e "semana" em America/Sao_Paulo.
 * Fim de semana: o sprint atual é o recém-fechado, então a missão do dia fica vazia (a rotina do sprint é de segunda a
 * sexta), as tarefas de hoje trazem só as planejadas para o sábado/domingo (fora do sprint), o placar é a foto do
 * fechamento e os lembretes de rotina do fim de semana aparecem normalmente.
 */
export class ResumoDaHome {
  constructor(
    private readonly obterSprint: Pick<ObterSprint, 'execute'>,
    private readonly tarefasDoSprintRepository: TarefasDoSprintRepository,
    private readonly tarefaRepository: TarefaRepository,
    private readonly saidaRepository: SaidaRepository,
    private readonly resumoDashboard: Pick<ResumoDashboard, 'execute'>,
  ) {}

  async execute(userId: ID, agora: Date = new Date()): Promise<ResumoDaHomeDados> {
    const hoje = dataAtual(agora)
    const inicioDaSemana = segundaDaSemana(hoje)
    const fimDaSemana = addDias(inicioDaSemana, 6)
    const competencia = competenciaAtual(agora)

    // `ObterSprint` fecha o sprint vencido (reserva do job) antes de montar; uma só leitura serve ao placar e à rotina.
    const dadosDoSprint = await this.obterSprint.execute(userId, 'ATUAL', agora)
    const placar = await new ObterPlacarDoSprint({ execute: async () => dadosDoSprint }, this.tarefasDoSprintRepository).execute(
      userId,
      'ATUAL',
      agora,
    )

    const [tarefas, contas, dashboard] = await Promise.all([
      this.tarefaRepository.listarDoDia(userId, hoje),
      this.saidaRepository.listarPendentesVencendoEntre(userId, inicioDaSemana, fimDaSemana),
      this.resumoDashboard.execute(userId, paraPeriodo(competencia)),
    ])

    const ocorrencias = dadosDoSprint.ocorrencias
      .filter((o) => o.data === hoje)
      .sort((a, b) => porHora(a, b, (x, y) => x.ordem - y.ordem))
      .map(naHome)

    const tarefasDeHoje: TarefaNaHome[] = tarefas
      .map((t) => ({
        id: t.id,
        titulo: t.titulo,
        areaId: t.areaId,
        dia: hoje,
        hora: t.hora,
        tempoEstimado: t.tempoEstimado,
        dificuldade: t.dificuldade,
        prioridade: t.prioridade,
        noSprint: t.sprintId !== null,
        concluida: t.concluida,
        concluidaEm: t.concluidaEm,
        atrasada: t.concluida ? t.atrasada : tarefaAtrasada({ dia: t.dia, hora: t.hora, tempoEstimado: t.tempoEstimado }, agora),
      }))
      .sort((a, b) => porHora(a, b, (x, y) => x.titulo.localeCompare(y.titulo)))

    const contasDaSemana: ContaDaSemana[] = contas.map((s) => ({
      id: s.id,
      descricao: s.descricao,
      valor: s.valor,
      vencimento: s.vencimento!,
      vencida: estaVencida(s, hoje),
      automatica: s.automatica,
      categoriaId: s.categoriaId,
      formaPagamento: s.formaPagamento,
    }))

    return {
      hoje,
      fimDeSemana: hoje > dadosDoSprint.sprint.fim,
      semana: { inicio: inicioDaSemana, fim: fimDaSemana },
      missaoDoDia: { total: ocorrencias.length, concluidas: ocorrencias.filter((o) => o.concluida).length, ocorrencias },
      tarefasDeHoje,
      placar: {
        sprintId: placar.sprintId,
        inicio: placar.inicio,
        fim: placar.fim,
        fechado: placar.fechado,
        fechadoEm: placar.fechadoEm,
        total: placar.placar.total,
        feitos: placar.placar.feitos,
        percentual: placar.placar.percentual,
        bonus: placar.placar.bonus,
        recompensa: placar.recompensa,
      },
      contasDaSemana: {
        total: Math.round(contasDaSemana.reduce((soma, c) => soma + c.valor, 0) * 100) / 100,
        quantidade: contasDaSemana.length,
        contas: contasDaSemana,
      },
      financas: {
        competencia,
        totalEntradas: dashboard.totalEntradas,
        totalSaidas: dashboard.totalSaidas,
        saldo: dashboard.saldo,
        totalFaturas: dashboard.totalFaturas,
        variacaoEntradas: dashboard.variacaoEntradas,
        variacaoSaidas: dashboard.variacaoSaidas,
        serieEntradas: dashboard.serieEntradas,
        serieSaidas: dashboard.serieSaidas,
      },
      lembretes: [...dadosDoSprint.lembretes]
        .sort((a, b) => a.data.localeCompare(b.data) || porHora(a, b, (x, y) => x.ordem - y.ordem))
        .map(naHome),
    }
  }
}
