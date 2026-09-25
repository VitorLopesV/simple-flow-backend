import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../src/infrastructure/supabase/database.types'

export interface RespostaSupabase {
  data: unknown
  error: unknown
}

/** Uma query montada via `from(tabela)`, com cada método encadeado e seus argumentos, na ordem. */
export interface ConsultaRegistrada {
  tabela: string
  chamadas: [string, ...unknown[]][]
}

/**
 * Fila de respostas consumida na ordem em que as queries da tabela são aguardadas, ou
 * uma função que decide a resposta olhando a query montada (útil quando a mesma tabela
 * é consultada várias vezes em paralelo com filtros diferentes, como no dashboard).
 */
type Resolvedor = RespostaSupabase[] | ((consulta: ConsultaRegistrada) => RespostaSupabase)

/**
 * Client Supabase falso para testar os repositórios sem rede: todo método do query
 * builder é encadeável e só registra a chamada; a resposta sai quando a query é
 * aguardada. Sem resposta configurada, devolve lista vazia (ou `null` para
 * `single`/`maybeSingle`), como o PostgREST faria sem linhas.
 */
export function criarSupabaseFake(respostas: Record<string, Resolvedor> = {}) {
  const consultas: ConsultaRegistrada[] = []
  const filas = new Map<string, Resolvedor>(
    Object.entries(respostas).map(([tabela, resolvedor]) => [
      tabela,
      Array.isArray(resolvedor) ? [...resolvedor] : resolvedor,
    ]),
  )

  function responder(consulta: ConsultaRegistrada): RespostaSupabase {
    const resolvedor = filas.get(consulta.tabela)
    if (typeof resolvedor === 'function') return resolvedor(consulta)

    const unica = consulta.chamadas.some(([metodo]) => metodo === 'single' || metodo === 'maybeSingle')
    return resolvedor?.shift() ?? { data: unica ? null : [], error: null }
  }

  function from(tabela: string) {
    const consulta: ConsultaRegistrada = { tabela, chamadas: [] }
    consultas.push(consulta)
    let resposta: Promise<RespostaSupabase> | undefined

    const builder: unknown = new Proxy(
      {},
      {
        get(_alvo, metodo) {
          if (metodo === 'then') {
            return (aoResolver: (valor: RespostaSupabase) => unknown, aoRejeitar: (erro: unknown) => unknown) => {
              resposta ??= Promise.resolve().then(() => responder(consulta))
              return resposta.then(aoResolver, aoRejeitar)
            }
          }
          return (...argumentos: unknown[]) => {
            consulta.chamadas.push([String(metodo), ...argumentos])
            return builder
          }
        },
      },
    )

    return builder
  }

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    consultas,
    /** Consultas feitas a uma tabela, na ordem em que foram montadas. */
    consultasDe(tabela: string) {
      return consultas.filter((consulta) => consulta.tabela === tabela)
    },
  }
}

/** Argumentos da primeira chamada de `metodo` na consulta (ex.: `argumentos(c, 'gte')` → `['data', '2026-08-01']`). */
export function argumentos(consulta: ConsultaRegistrada, metodo: string): unknown[] | undefined {
  return consulta.chamadas.find(([nome]) => nome === metodo)?.slice(1)
}

/** Todas as chamadas de `metodo` na consulta, cada uma com seus argumentos. */
export function todasAsChamadas(consulta: ConsultaRegistrada, metodo: string): unknown[][] {
  return consulta.chamadas.filter(([nome]) => nome === metodo).map(([, ...resto]) => resto)
}

export function ok(data: unknown): RespostaSupabase {
  return { data, error: null }
}

export function falha(error: unknown): RespostaSupabase {
  return { data: null, error }
}
