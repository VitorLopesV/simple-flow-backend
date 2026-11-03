import type { Saida, SaidaFiltroStatus } from '../../domain/entities/Saida'

/**
 * "Vencida" não é uma situação gravada: é uma saída `PENDENTE` cujo vencimento é anterior
 * a hoje (mesma regra de `isExpenseOverdue` no frontend). Sem vencimento nunca vence, e
 * paga continua paga. `hoje` em `YYYY-MM-DD`, no fuso do usuário — a comparação de
 * strings ISO basta.
 */
export function estaVencida(saida: Pick<Saida, 'status' | 'vencimento'>, hoje: string): boolean {
  return saida.status === 'PENDENTE' && Boolean(saida.vencimento) && saida.vencimento! < hoje
}

/**
 * Confere a situação do filtro de listagem. `PENDENTE` exclui as vencidas, para que
 * `PENDENTE`, `VENCIDO` e `PAGO` sejam grupos disjuntos.
 */
export function correspondeASituacao(
  saida: Pick<Saida, 'status' | 'vencimento'>,
  situacao: SaidaFiltroStatus,
  hoje: string,
): boolean {
  const vencida = estaVencida(saida, hoje)
  if (situacao === 'VENCIDO') return vencida
  if (situacao === 'PENDENTE') return saida.status === 'PENDENTE' && !vencida
  return saida.status === situacao
}
