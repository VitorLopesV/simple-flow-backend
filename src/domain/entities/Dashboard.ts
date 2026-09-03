import type { ID, SeriePonto } from '../../shared/types/common'

export interface TransacaoRecente {
  id: ID
  tipo: 'ENTRADA' | 'SAIDA'
  descricao: string
  valor: number
  data: string
  categoriaNome: string
  categoriaCor: string
}

export interface DashboardResumo {
  totalEntradas: number
  totalSaidas: number
  saldo: number
  /**
   * Quanto de `totalSaidas` é fatura de cartão — recorte do mesmo conjunto, pelo
   * mês de vencimento da fatura, não pela competência.
   */
  totalFaturas: number
  variacaoEntradas: number
  variacaoSaidas: number
  /** Últimos 6 meses de entradas e saídas. */
  serieEntradas: SeriePonto[]
  serieSaidas: SeriePonto[]
  /** Distribuição das saídas por categoria no período. */
  gastosPorCategoria: { nome: string; cor: string; total: number }[]
  transacoesRecentes: TransacaoRecente[]
}
