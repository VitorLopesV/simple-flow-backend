import type { ID, SeriePonto } from '../../shared/types/common'
import type { SaidaTipo } from './Saida'

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
  /**
   * Quanto de cada ponto de `serieSaidas` é fatura de cartão — mesma regra de
   * `totalFaturas` (o último ponto é igual a ele). É um recorte, não um conjunto à
   * parte: as faturas continuam somadas em `serieSaidas`.
   */
  serieFaturas: SeriePonto[]
  /** Distribuição das saídas por categoria no período. */
  gastosPorCategoria: { nome: string; cor: string; total: number }[]
  /** Distribuição das entradas por categoria no período. */
  entradasPorCategoria: { nome: string; cor: string; total: number }[]
  /**
   * Transações lançadas nos cartões, agrupadas por tipo — só as das faturas que entram
   * em `totalFaturas` (mesmo mês de vencimento), com as recorrências projetadas, então
   * a soma bate com ele. A aba Saídas vê a fatura inteira como uma saída só; é aqui que
   * o dashboard enxerga o detalhe.
   */
  gastosCartoesPorTipo: { tipo: SaidaTipo; total: number }[]
  /** Mesmas transações de `gastosCartoesPorTipo`, agrupadas por categoria. */
  gastosCartoesPorCategoria: { nome: string; cor: string; total: number }[]
  transacoesRecentes: TransacaoRecente[]
}
