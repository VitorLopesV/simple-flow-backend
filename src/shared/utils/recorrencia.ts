import type { ID, Periodo } from '../types/common'
import { limitesDoMes, paraCompetencia, paraPeriodo } from './periodo'

interface ItemRecorrente {
  id: ID
  data: string
  descricao: string
  categoriaId: ID
  recorrente: boolean
  automatica?: boolean
  /** Só existe em Saida — quando presente, precisa avançar mês a mês junto com `data`. */
  vencimento?: string | null
}

function ordinalDoPeriodo(periodo: Periodo): number {
  return periodo.ano * 12 + periodo.mes
}

function periodoDaData(dataIso: string): Periodo {
  return paraPeriodo(dataIso.slice(0, 7))
}

function chaveDaSerie(item: Pick<ItemRecorrente, 'descricao' | 'categoriaId'>): string {
  return `${item.descricao}::${item.categoriaId}`
}

function diaDoPeriodo(periodo: Periodo, dia: number): string {
  const ultimoDia = Number(limitesDoMes(periodo).fim.slice(8, 10))
  return `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`
}

/** Chave usada para casar uma ocorrência real do período com sua série recorrente. */
export function chaveDaSerieDoItem(item: Pick<ItemRecorrente, 'descricao' | 'categoriaId'>): string {
  return chaveDaSerie(item)
}

const REGEX_ID_PROJETADO = /^(.+)_(\d{4}-\d{2})$/

/**
 * Reconhece o id sintético de uma ocorrência projetada (`${origemId}_${competencia}`,
 * ver `projetarRecorrencias`) e extrai o id do lançamento original. Usado para
 * materializar a ocorrência como uma linha própria ao ser editada, em vez de tratá-la
 * como um espelho do original.
 */
export function origemDoIdProjetado(id: ID): { origemId: ID; competencia: string } | null {
  const encontrado = id.match(REGEX_ID_PROJETADO)
  return encontrado ? { origemId: encontrado[1]!, competencia: encontrado[2]! } : null
}

/**
 * Projeta, para o período alvo, a ocorrência mais recente de cada série recorrente
 * (agrupada por descrição + categoria) que ainda não tem lançamento real nesse mês —
 * nunca persiste, recalcula a cada leitura a partir da ocorrência real mais recente
 * anterior ao período. Assim, desligar `recorrente` no original (ou editar seu valor)
 * já reflete nos meses seguintes sozinho, e um mês que já tem lançamento próprio
 * (histórico real, ou editado à mão) não é duplicado.
 *
 * Espelha `comRecorrencias` do mock do frontend (frontend/src/services/mock/db.ts) —
 * até esta função existir, o backend real não projetava nada: `recorrente` era só uma
 * flag numa única linha, e um lançamento de agosto nunca aparecia em setembro.
 */
export function projetarRecorrencias<T extends ItemRecorrente>(
  candidatasAnterioresAoPeriodo: T[],
  chavesJaLancadasNoPeriodo: Set<string>,
  periodoAlvo: Periodo,
): (T & { origemRecorrenciaId: ID })[] {
  const alvo = ordinalDoPeriodo(periodoAlvo)
  const maisRecentePorSerie = new Map<string, T>()

  for (const item of candidatasAnterioresAoPeriodo) {
    if (!item.recorrente || item.automatica) continue
    if (ordinalDoPeriodo(periodoDaData(item.data)) >= alvo) continue

    const chave = chaveDaSerie(item)
    const atual = maisRecentePorSerie.get(chave)
    if (!atual || item.data > atual.data) maisRecentePorSerie.set(chave, item)
  }

  return [...maisRecentePorSerie.entries()]
    .filter(([chave]) => !chavesJaLancadasNoPeriodo.has(chave))
    .map(([, origem]) => ({
      ...origem,
      id: `${origem.id}_${paraCompetencia(periodoAlvo)}`,
      data: diaDoPeriodo(periodoAlvo, Number(origem.data.slice(8, 10))),
      // Some junto com `data`: sem isso, o formulário de saída (que usa o vencimento
      // como competência quando ele existe — ver TransactionForm.vue) reenviaria a
      // ocorrência para o mês do vencimento original ao editá-la, em vez do mês projetado.
      ...(origem.vencimento ? { vencimento: diaDoPeriodo(periodoAlvo, Number(origem.vencimento.slice(8, 10))) } : {}),
      origemRecorrenciaId: origem.id,
    }))
}
