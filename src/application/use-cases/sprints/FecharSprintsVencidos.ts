import type { Sprint } from '../../../domain/entities/Sprint'
import type { OcorrenciaRotinaRepository } from '../../../domain/repositories/OcorrenciaRotinaRepository'
import type { SprintRepository } from '../../../domain/repositories/SprintRepository'
import type { TarefasDoSprintRepository } from '../../../domain/repositories/TarefasDoSprintRepository'
import { sprintVencido } from '../../../domain/services/fechamentoDoSprint'
import { calcularPlacar } from '../../../domain/services/placarDoSprint'
import type { ID } from '../../../shared/types/common'
import { addDias, dataAtual } from '../../../shared/utils/periodo'

/**
 * Reserva do job `fechar-sprints-vencidos` (pg_cron, sábado 02:59 UTC = sexta 23:59 SP): fecha os sprints do usuário
 * que já passaram do fechamento, no primeiro acesso dele. Espelha em TypeScript a função SQL `fechar_sprint`
 * (mesma fórmula do placar: `calcularPlacar`); mudou a regra num lado, mude no outro.
 *
 * Ordem obrigatória por sprint:
 *  1. a foto (total, feitos, %, bônus) é tirada com as tarefas não concluídas AINDA no total e gravada
 *     junto com `FECHADO`, uma única vez (o repositório só fecha sprint ABERTO: a foto é imutável);
 *  2. só então as tarefas não concluídas saem do sprint, voltam à área e ganham a marca do sprint de origem;
 *  3. as ocorrências de rotina não concluídas não são tocadas: ficam sem conclusão, valendo zero, e o sprint
 *     fechado não aceita mais conclusão delas;
 *  4. o próximo sprint é criado se ainda não existir.
 * Cada passo é idempotente e `fechamentoAplicadoEm` só é gravado no fim: se uma execução cair no meio, a
 * seguinte retoma de onde parou, sem regravar a foto.
 */
export class FecharSprintsVencidos {
  constructor(
    private readonly sprintRepository: SprintRepository,
    private readonly ocorrenciaRepository: OcorrenciaRotinaRepository,
    private readonly tarefasRepository: TarefasDoSprintRepository,
  ) {}

  /** Devolve quantos sprints esta chamada fechou de fato (os que o job já tinha fechado não contam). */
  async execute(userId: ID, agora: Date = new Date()): Promise<number> {
    const pendentes = await this.sprintRepository.listarPendentesDeFechamento(userId, dataAtual(agora))
    let fechados = 0
    for (const sprint of pendentes) {
      if (!sprintVencido(sprint.fim, agora)) continue
      if (await this.fechar(userId, sprint, agora)) fechados += 1
    }
    return fechados
  }

  private async fechar(userId: ID, sprint: Sprint, agora: Date): Promise<boolean> {
    const quando = agora.toISOString()
    let fechou = false

    if (sprint.situacao === 'ABERTO') {
      const [ocorrencias, tarefas] = await Promise.all([
        this.ocorrenciaRepository.listarDoSprint(userId, sprint.id),
        this.tarefasRepository.listar(userId, sprint.id, sprint.inicio, sprint.fim),
      ])
      // Lembretes (sábado/domingo) não pontuam, como no placar ao vivo.
      const foto = calcularPlacar(ocorrencias.filter((o) => !o.lembrete), tarefas, sprint.inicio, sprint.fim)
      fechou = await this.sprintRepository.fechar(userId, sprint.id, foto, quando)
    }

    await this.tarefasRepository.devolverNaoConcluidas(userId, sprint.id, sprint.inicio)
    await this.sprintRepository.garantir(userId, addDias(sprint.inicio, 7), addDias(sprint.fim, 7))
    await this.sprintRepository.marcarFechamentoAplicado(userId, sprint.id, quando)
    return fechou
  }
}
