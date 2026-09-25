import type { Saida, SaidaResumo } from '../../domain/entities/Saida'

/**
 * Tipos sem saídas no período ficam de fora (em vez de virar total 0): o gráfico do
 * front só precisa das fatias existentes, e a soma continua batendo com o total.
 */
export function agruparPorTipo(saidas: Pick<Saida, 'tipo' | 'valor'>[]): SaidaResumo['porTipo'] {
  const agrupado = new Map<Saida['tipo'], number>()
  for (const saida of saidas) {
    agrupado.set(saida.tipo, (agrupado.get(saida.tipo) ?? 0) + saida.valor)
  }

  return [...agrupado.entries()].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total)
}
