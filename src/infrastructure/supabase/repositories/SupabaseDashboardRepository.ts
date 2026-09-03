import type { SupabaseClient } from '@supabase/supabase-js'

import type { Entrada } from '../../../domain/entities/Entrada'
import type { DashboardResumo, TransacaoRecente } from '../../../domain/entities/Dashboard'
import type { Saida } from '../../../domain/entities/Saida'
import type { DashboardRepository } from '../../../domain/repositories/DashboardRepository'
import type { ID, Periodo, SeriePonto } from '../../../shared/types/common'
import { labelCurtoPeriodo, ultimosPeriodos } from '../../../shared/utils/periodo'
import { calcularVariacao } from '../../../shared/utils/variacao'
import type { Database } from '../database.types'
import { SupabaseEntradaRepository } from './SupabaseEntradaRepository'
import { SupabaseSaidaRepository } from './SupabaseSaidaRepository'

const MESES_NO_GRAFICO = 6

function somar(registros: { valor: number }[]): number {
  return registros.reduce((soma, item) => soma + item.valor, 0)
}

/**
 * Recebe um client Supabase escopado no JWT do usuário — o RLS já restringe as
 * queries ao próprio usuário; o filtro explícito por userId é defesa em profundidade.
 */
export class SupabaseDashboardRepository implements DashboardRepository {
  private readonly entradaRepository: SupabaseEntradaRepository
  private readonly saidaRepository: SupabaseSaidaRepository

  constructor(private readonly supabase: SupabaseClient<Database>) {
    this.entradaRepository = new SupabaseEntradaRepository(supabase)
    this.saidaRepository = new SupabaseSaidaRepository(supabase)
  }

  async resumo(userId: ID, periodo: Periodo): Promise<DashboardResumo> {
    const periodos = ultimosPeriodos(periodo, MESES_NO_GRAFICO)

    // Cada mês da janela já vem com a projeção de recorrências aplicada (mesma
    // lógica de `listar`/`resumo` de entradas/saídas) — assim o gráfico e o card
    // "no período" nunca divergem do que aparece nas telas de Entradas/Saídas.
    const [entradasPorPeriodo, saidasPorPeriodo, categoriasRes] = await Promise.all([
      Promise.all(periodos.map((p) => this.entradaRepository.listarComProjecao(userId, p))),
      Promise.all(periodos.map((p) => this.saidaRepository.listarComProjecao(userId, p))),
      this.supabase.from('categorias').select('id, nome, cor'),
    ])

    if (categoriasRes.error) throw categoriasRes.error

    const categoriaPorId = new Map(categoriasRes.data.map((categoria) => [categoria.id, categoria]))

    const indiceAtual = periodos.length - 1
    const entradasDoMes: Entrada[] = entradasPorPeriodo[indiceAtual]!
    const saidasDoMes: Saida[] = saidasPorPeriodo[indiceAtual]!

    const totalEntradas = somar(entradasDoMes)
    const totalSaidas = somar(saidasDoMes)
    // Quanto das saídas do mês é fatura de cartão. Sai do mesmo conjunto que alimenta
    // `totalSaidas` (as saídas derivadas de fatura, ver `paraSaidaDeFatura`) — antes era
    // uma query própria por competência, ou seja, uma definição de mês diferente do resto
    // do dashboard: a fatura de setembro que vence em outubro contava nos dois meses.
    const totalFaturas = saidasDoMes
      .filter((saida) => saida.automatica && saida.formaPagamento === 'CARTAO_CREDITO')
      .reduce((soma, saida) => soma + saida.valor, 0)

    const serieEntradas: SeriePonto[] = periodos.map((p, i) => ({
      label: labelCurtoPeriodo(p),
      valor: somar(entradasPorPeriodo[i]!),
    }))
    const serieSaidas: SeriePonto[] = periodos.map((p, i) => ({
      label: labelCurtoPeriodo(p),
      valor: somar(saidasPorPeriodo[i]!),
    }))

    const agrupado = new Map<string, number>()
    for (const saida of saidasDoMes) {
      agrupado.set(saida.categoriaId, (agrupado.get(saida.categoriaId) ?? 0) + saida.valor)
    }
    const gastosPorCategoria = [...agrupado.entries()]
      .map(([categoriaId, total]) => {
        const categoria = categoriaPorId.get(categoriaId)
        return { nome: categoria?.nome ?? 'Outros', cor: categoria?.cor ?? '#94a3b8', total }
      })
      .sort((a, b) => b.total - a.total)

    const nomeECor = (categoriaId: string) => {
      const categoria = categoriaPorId.get(categoriaId)
      return { categoriaNome: categoria?.nome ?? 'Sem categoria', categoriaCor: categoria?.cor ?? '#94a3b8' }
    }

    const transacoesRecentes: TransacaoRecente[] = [
      ...entradasDoMes.map<TransacaoRecente>((entrada) => ({
        id: entrada.id,
        tipo: 'ENTRADA',
        descricao: entrada.descricao,
        valor: entrada.valor,
        data: entrada.data,
        ...nomeECor(entrada.categoriaId),
      })),
      ...saidasDoMes.map<TransacaoRecente>((saida) => ({
        id: saida.id,
        tipo: 'SAIDA',
        descricao: saida.descricao,
        valor: saida.valor,
        data: saida.data,
        ...nomeECor(saida.categoriaId),
      })),
    ]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 8)

    return {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      totalFaturas,
      variacaoEntradas: calcularVariacao(totalEntradas, serieEntradas.at(-2)?.valor ?? 0),
      variacaoSaidas: calcularVariacao(totalSaidas, serieSaidas.at(-2)?.valor ?? 0),
      serieEntradas,
      serieSaidas,
      gastosPorCategoria,
      transacoesRecentes,
    }
  }
}
