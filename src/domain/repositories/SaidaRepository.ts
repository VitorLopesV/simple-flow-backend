import type { Saida, SaidaFiltroStatus, SaidaPayload, SaidaResumo } from '../entities/Saida'
import type { ControleDeSerie } from '../entities/Recorrencia'
import type { ID, Paginated, Periodo } from '../../shared/types/common'

export interface SaidaFiltro {
  periodo: Periodo
  categoriaId?: ID | null
  status?: SaidaFiltroStatus | null
  busca?: string
  page: number
  pageSize: number
}

export interface SaidaRepository {
  listar(userId: ID, filtro: SaidaFiltro): Promise<Paginated<Saida>>
  resumo(userId: ID, periodo: Periodo): Promise<SaidaResumo>
  /** Saídas do período + as faturas de cartão que vencem nele, sem paginação/filtro — usado pelo dashboard para montar a série de vários meses. */
  listarDoPeriodo(userId: ID, periodo: Periodo): Promise<Saida[]>
  /**
   * Saídas PENDENTES com vencimento entre `inicio` e `fim` (inclusive, `YYYY-MM-DD`), pelo vencimento e não pela
   * competência: uma conta de julho que vence em agosto entra. Inclui as faturas de cartão em aberto (saída derivada).
   * Do vencimento mais próximo ao mais distante.
   */
  listarPendentesVencendoEntre(userId: ID, inicio: string, fim: string): Promise<Saida[]>
  buscarPorId(userId: ID, id: ID): Promise<Saida | null>
  criar(userId: ID, payload: SaidaPayload, controle?: Partial<ControleDeSerie>): Promise<Saida>
  /** Campos de `controle` ausentes mantêm o valor gravado. */
  atualizar(userId: ID, id: ID, payload: SaidaPayload, controle?: Partial<ControleDeSerie>): Promise<Saida>
  remover(userId: ID, id: ID): Promise<void>
  /** Registros da série nos meses seguintes ao da `data` (do mais antigo para o mais novo). */
  listarSeguintesDaSerie(userId: ID, serieId: ID, data: string): Promise<Saida[]>
  removerVarios(userId: ID, ids: ID[]): Promise<void>
  /** Série encerrada não é continuada pelo job de geração do mês seguinte. */
  marcarSerieEncerrada(userId: ID, serieId: ID, encerrada: boolean): Promise<void>
}
