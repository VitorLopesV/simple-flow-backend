import type { ID } from '../../shared/types/common'

/**
 * Campos de controle de uma série recorrente, comuns a entrada, saída e transação de
 * cartão. Nunca vêm do payload do cliente — só a aplicação os define.
 *
 * Cada mês de uma série é um registro real e independente (editar um não muda os
 * outros); o que os liga é só o `serieId`. O registro do mês seguinte nasce junto com
 * o lançamento e, depois, pelo job diário `gerar_recorrencias_mes_seguinte` (pg_cron).
 */
export interface ControleDeSerie {
  /** Série a que o registro pertence; null = lançamento avulso. */
  serieId: ID | null
  /**
   * true depois que o usuário altera o registro (inclusive marcar como PAGO): encerrar
   * a série a partir de um mês anterior exige confirmação antes de removê-lo.
   */
  editadoManualmente: boolean
}
