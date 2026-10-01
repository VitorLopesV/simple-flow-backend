/** Intervalo de competências (YYYY-MM, inclusivo) que o usuário pode consultar. */
export interface LimitesNavegacao {
  /** Mês mais antigo com dados do usuário (entradas, saídas ou cartões); sem dados, o mês atual. */
  primeiroMes: string
  /** Mês atual + 1 — dinâmico, calculado a cada requisição. */
  ultimoMes: string
}
