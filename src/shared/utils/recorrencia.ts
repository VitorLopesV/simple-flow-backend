import type { Categoria } from '../../domain/entities/Categoria'

/**
 * Só Renda Fixa e Despesa Fixa aceitam lançamento recorrente — o que varia todo mês
 * (despesa variável, investimento, freelance...) não faz sentido repetir sozinho.
 */
export function categoriaPermiteRecorrencia(categoria: Pick<Categoria, 'tipo'>): boolean {
  return categoria.tipo === 'CONTA_FIXA' || categoria.tipo === 'RENDA_FIXA'
}

/**
 * Mesma data no mês seguinte, com o dia limitado ao último dia do mês (31/01 → 28/02).
 * Espelha o cálculo da function SQL `gerar_recorrencias_mes_seguinte`.
 */
export function mesmoDiaNoMesSeguinte(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number) as [number, number, number]
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia))).toISOString().slice(0, 10)
}

/** true se algum campo de `dados` difere do registro atual (ausente e `null` contam como iguais). */
export function houveAlteracao<T extends object>(atual: T, dados: Partial<T>): boolean {
  return (Object.keys(dados) as (keyof T)[]).some((campo) => (atual[campo] ?? null) !== (dados[campo] ?? null))
}
