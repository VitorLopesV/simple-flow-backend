import type { Dificuldade, Prioridade, TempoEstimado } from '../entities/Tarefa'
import { addDias, segundaDaSemana } from '../../shared/utils/periodo'
import { MENSAGEM_SPRINT_FECHADO, sprintVencido } from './fechamentoDoSprint'

/** Campos da tarefa que decidem se ela pode estar no sprint. */
export interface DadosParaSprint {
  dia: string | null
  tempoEstimado: TempoEstimado | null
  dificuldade: Dificuldade | null
  prioridade: Prioridade | null
}

export const MENSAGEM_TAREFA_TRAVADA = 'Esta tarefa é de um dia que já passou: ela só pode ser concluída.'

/** Sábado (6) e domingo (0) nunca entram no sprint. */
export function ehDiaUtil(dataIso: string): boolean {
  const dia = new Date(`${dataIso}T00:00:00Z`).getUTCDay()
  return dia >= 1 && dia <= 5
}

/** Segunda-feira do sprint ao qual o dia pertenceria (a semana do próprio dia). */
export function inicioDoSprintDoDia(dia: string): string {
  return segundaDaSemana(dia)
}

/** Primeira sexta-feira do sprint cujo início é `inicio`. */
export function fimDoSprint(inicio: string): string {
  return addDias(inicio, 4)
}

/** Pontuação exige tempo, dificuldade e prioridade (a hora é opcional). */
export function camposFaltantes(tarefa: Pick<DadosParaSprint, 'tempoEstimado' | 'dificuldade' | 'prioridade'>): string[] {
  const faltantes: string[] = []
  if (tarefa.tempoEstimado === null) faltantes.push('tempo estimado')
  if (tarefa.dificuldade === null) faltantes.push('dificuldade')
  if (tarefa.prioridade === null) faltantes.push('prioridade')
  return faltantes
}

/**
 * Motivo (mensagem pronta para o usuário) pelo qual a tarefa não pode ficar no sprint no dia
 * dela, ou `null` se pode. `hoje` é a data de São Paulo. Só o sprint atual e o próximo aceitam
 * tarefas, e só do dia de hoje em diante: dia passado está travado. Com `agora`, também recusa o
 * sprint que já passou de sexta 23:59 (SP): o fechamento (#71) já tirou, ou vai tirar, tudo dele.
 */
export function motivoDeRecusa(tarefa: DadosParaSprint, hoje: string, agora?: Date): string | null {
  if (tarefa.dia === null) return 'Escolha um dia, de segunda a sexta, para a tarefa entrar no sprint.'
  if (!ehDiaUtil(tarefa.dia)) return 'Sábado e domingo ficam fora do sprint: escolha um dia de segunda a sexta.'
  if (tarefa.dia < hoje) return 'Esse dia já passou: só dá para colocar no sprint tarefas de hoje em diante.'

  const inicioAtual = segundaDaSemana(hoje)
  const inicioDoDia = inicioDoSprintDoDia(tarefa.dia)
  if (inicioDoDia !== inicioAtual && inicioDoDia !== addDias(inicioAtual, 7)) {
    return 'Só dá para planejar o sprint desta semana e o da próxima.'
  }

  if (agora && sprintVencido(fimDoSprint(inicioDoDia), agora)) return MENSAGEM_SPRINT_FECHADO

  const faltantes = camposFaltantes(tarefa)
  if (faltantes.length > 0) return `Para entrar no sprint, defina antes: ${faltantes.join(', ')}.`
  return null
}

/** Tarefa no sprint cujo dia já passou: não remove, não muda de dia, não edita, só conclui. */
export function tarefaTravada(tarefa: { sprintId: string | null; dia: string | null }, hoje: string): boolean {
  return tarefa.sprintId !== null && tarefa.dia !== null && tarefa.dia < hoje
}

export const MENSAGEM_TAREFA_CONCLUIDA =
  'Esta tarefa já foi concluída e a conclusão é definitiva: ela não pode ser desmarcada nem alterada.'
