import { dataHoraAtual } from '../../shared/utils/periodo'

export const MENSAGEM_SPRINT_FECHADO = 'O sprint dessa semana já foi fechado (sexta 23:59): ele não pode mais ser alterado.'

/**
 * Sprint que já passou do fechamento: sexta 23:59:00 em America/Sao_Paulo (= sábado 02:59 UTC, o instante
 * do job `fechar-sprints-vencidos`). Compara o relógio de parede de SP com o `fim` do sprint (`YYYY-MM-DD`).
 */
export function sprintVencido(fim: string, agora: Date): boolean {
  return dataHoraAtual(agora) >= `${fim}T23:59:00`
}
