import type { ID, SeriePonto } from '../../shared/types/common'
import type { SaidaTipo } from './Saida'

/** O que aconteceu com o registro, conforme o histórico de atividades. */
export type AcaoAtividade = 'ADICIONADO' | 'ALTERADO' | 'REMOVIDO'

export interface TransacaoRecente {
  id: ID
  /** `CARTAO`: fatura de cartão ou compra lançada no cartão. */
  tipo: 'ENTRADA' | 'SAIDA' | 'CARTAO'
  acao: AcaoAtividade
  /** Instante (ISO) da ação — a lista vem ordenada por ele, da mais recente para a mais antiga. */
  ocorridoEm: string
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
   * em `totalFaturas` (mesmo mês de vencimento), então a soma bate com ele. A aba Saídas vê a fatura inteira como uma saída só; é aqui que
   * o dashboard enxerga o detalhe.
   */
  gastosCartoesPorTipo: { tipo: SaidaTipo; total: number }[]
  /** Mesmas transações de `gastosCartoesPorTipo`, agrupadas por categoria. */
  gastosCartoesPorCategoria: { nome: string; cor: string; total: number }[]
  transacoesRecentes: TransacaoRecente[]
}
