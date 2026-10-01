import type { ControleDeSerie } from '../../../domain/entities/Recorrencia'

/**
 * Campos de controle da série em snake_case — só os informados, para que um update
 * não sobrescreva os demais (no insert, o que faltar fica com o default do banco).
 */
export function paraLinhaDeControle(controle: Partial<ControleDeSerie> = {}) {
  return {
    ...(controle.serieId !== undefined ? { serie_id: controle.serieId } : {}),
    ...(controle.editadoManualmente !== undefined ? { editado_manualmente: controle.editadoManualmente } : {}),
  }
}
