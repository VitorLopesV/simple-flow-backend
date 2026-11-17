import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { TarefasDoSprintRepository } from '../../../domain/repositories/TarefasDoSprintRepository'
import { tarefaAtrasada } from '../../../domain/services/atraso'
import { ehDiaUtil, tarefasPontuaveis } from '../../../domain/services/placarDoSprint'
import type { ID } from '../../../shared/types/common'
import { addDias, dataAtual, dataHoraAtual, segundaDaSemana } from '../../../shared/utils/periodo'
import type { ObterSprint } from '../sprints/ObterSprint'

export type TipoDeAlerta = 'TAREFA_ATRASADA' | 'ROTINA_INCOMPLETA' | 'RESULTADO_SPRINT'

/** Formato do `AppNotification` do frontend (id, título, descrição, data) mais o `tipo`, que o front pode usar para ícone/cor. */
export interface AlertaDoSino {
  /** Estável: o mesmo fato gera sempre o mesmo id, para o front saber o que já foi visto. */
  id: string
  tipo: TipoDeAlerta
  titulo: string
  /** Texto curto (o sino mostra no máximo duas linhas). */
  descricao: string
  /** YYYY-MM-DD (America/Sao_Paulo): o dia a que o alerta se refere. */
  data: string
}

export interface AlertasDoSino {
  /** YYYY-MM-DD, America/Sao_Paulo. */
  hoje: string
  alertas: AlertaDoSino[]
}

/** A partir desta hora (SP) a rotina do dia ainda incompleta vira alerta. */
export const HORA_DO_ALERTA_DE_ROTINA = '20:00'

const ORDEM_DO_TIPO: Record<TipoDeAlerta, number> = { RESULTADO_SPRINT: 0, ROTINA_INCOMPLETA: 1, TAREFA_ATRASADA: 2 }

function paraDdMm(dataIso: string): string {
  return `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`
}

/**
 * Alertas do módulo Organização para o sino, calculados sob demanda (nada é gravado). Reutiliza o sprint (e a reserva
 * de fechamento do `ObterSprint`), o atraso (`tarefaAtrasada`) e a foto do fechamento: nenhuma regra é duplicada.
 * Um alerta some sozinho quando a condição deixa de valer (tarefa concluída/replanejada, rotina cumprida, virada do dia).
 */
export class ObterAlertasDoSino {
  constructor(
    private readonly obterSprint: Pick<ObterSprint, 'execute'>,
    private readonly tarefasDoSprintRepository: TarefasDoSprintRepository,
    private readonly sprintRepository: Pick<SprintRepository, 'listarFechados'>,
  ) {}

  async execute(userId: ID, agora: Date = new Date()): Promise<AlertasDoSino> {
    const hoje = dataAtual(agora)
    const { sprint, ocorrencias, iniciado, previa } = await this.obterSprint.execute(userId, 'ATUAL', agora)
    const alertas: AlertaDoSino[] = []

    // Sprint fechado (sábado/domingo): as não concluídas já voltaram para a área e a rotina do dia útil acabou.
    if (sprint.situacao === 'ABERTO' && iniciado && !previa) {
      const tarefas = await this.tarefasDoSprintRepository.listar(userId, sprint.id, sprint.inicio, sprint.fim)
      for (const t of tarefasPontuaveis(tarefas, sprint.inicio, sprint.fim)) {
        if (t.concluida || !tarefaAtrasada(t, agora)) continue
        const prazo = t.hora === null ? paraDdMm(t.dia) : `${paraDdMm(t.dia)} às ${t.hora.slice(0, 5)}`
        alertas.push({
          id: `tarefa-atrasada:${t.id}:${t.dia}`,
          tipo: 'TAREFA_ATRASADA',
          titulo: 'Tarefa atrasada',
          descricao: `"${t.titulo}" venceu em ${prazo}. Concluir agora vale só 20% dos pontos.`,
          data: t.dia,
        })
      }

      const doDia = ocorrencias.filter((o) => o.data === hoje)
      const pendentes = doDia.filter((o) => o.concluidaEm === null).length
      if (ehDiaUtil(hoje) && pendentes > 0 && dataHoraAtual(agora).slice(11, 16) >= HORA_DO_ALERTA_DE_ROTINA) {
        alertas.push({
          id: `rotina-incompleta:${hoje}`,
          tipo: 'ROTINA_INCOMPLETA',
          titulo: 'Rotina de hoje incompleta',
          descricao: `Você concluiu ${doDia.length - pendentes} de ${doDia.length} itens da rotina. Cumpra a missão do dia para pontuar.`,
          data: hoje,
        })
      }
    }

    // O resultado fica no sino da semana que fechou (sábado/domingo) e da seguinte; depois disso é só histórico.
    const { sprints } = await this.sprintRepository.listarFechados(userId, 1, 1)
    const ultimo = sprints[0]
    if (ultimo?.foto && ultimo.inicio >= addDias(segundaDaSemana(hoje), -7)) {
      const { foto } = ultimo
      const recompensa = foto.recompensa ? ` Recompensa: ${foto.recompensa}.` : ''
      alertas.push({
        id: `resultado-sprint:${ultimo.id}`,
        tipo: 'RESULTADO_SPRINT',
        titulo: foto.bonus ? 'Bônus do sprint liberado' : 'Bônus do sprint não liberado',
        descricao: foto.bonus
          ? `Você fechou o sprint de ${paraDdMm(ultimo.inicio)} com ${foto.percentual}%.${recompensa}`
          : `O sprint de ${paraDdMm(ultimo.inicio)} fechou com ${foto.percentual}% (meta: 90%).`,
        data: ultimo.fechadoEm ? dataAtual(new Date(ultimo.fechadoEm)) : addDias(ultimo.fim, 1),
      })
    }

    alertas.sort(
      (a, b) => b.data.localeCompare(a.data) || ORDEM_DO_TIPO[a.tipo] - ORDEM_DO_TIPO[b.tipo] || a.id.localeCompare(b.id),
    )
    return { hoje, alertas }
  }
}
