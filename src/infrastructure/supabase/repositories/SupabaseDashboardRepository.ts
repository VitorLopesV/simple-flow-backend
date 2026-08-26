import type { SupabaseClient } from '@supabase/supabase-js'

import type { DashboardResumo, TransacaoRecente } from '../../../domain/entities/Dashboard'
import type { DashboardRepository } from '../../../domain/repositories/DashboardRepository'
import type { ID, Periodo, SeriePonto } from '../../../shared/types/common'
import {
  dentroDoPeriodo,
  labelCurtoPeriodo,
  limitesDoMes,
  paraCompetencia,
  ultimosPeriodos,
} from '../../../shared/utils/periodo'
import { calcularVariacao } from '../../../shared/utils/variacao'
import type { Database } from '../database.types'

const MESES_NO_GRAFICO = 6

interface Lancamento {
  id: string
  descricao: string
  valor: number
  data: string
  categoriaId: string
}

function somar(registros: { valor: number }[]): number {
  return registros.reduce((soma, item) => soma + item.valor, 0)
}

function montarSerie(registros: { data: string; valor: number }[], periodos: Periodo[]): SeriePonto[] {
  return periodos.map((periodo) => ({
    label: labelCurtoPeriodo(periodo),
    valor: somar(registros.filter((registro) => dentroDoPeriodo(registro.data, periodo))),
  }))
}

/**
 * Recebe um client Supabase escopado no JWT do usuário — o RLS já restringe as
 * queries ao próprio usuário; o filtro explícito por userId é defesa em profundidade.
 */
export class SupabaseDashboardRepository implements DashboardRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async resumo(userId: ID, periodo: Periodo): Promise<DashboardResumo> {
    const periodos = ultimosPeriodos(periodo, MESES_NO_GRAFICO)
    const inicioJanela = limitesDoMes(periodos[0]!).inicio
    const fimJanela = limitesDoMes(periodos[periodos.length - 1]!).fim
    const competencia = paraCompetencia(periodo)

    const [entradasRes, saidasRes, categoriasRes, faturasRes] = await Promise.all([
      this.supabase
        .from('entradas')
        .select('id, descricao, valor, data, categoria_id')
        .eq('user_id', userId)
        .gte('data', inicioJanela)
        .lte('data', fimJanela),
      this.supabase
        .from('saidas')
        .select('id, descricao, valor, data, categoria_id')
        .eq('user_id', userId)
        .gte('data', inicioJanela)
        .lte('data', fimJanela),
      this.supabase.from('categorias').select('id, nome, cor'),
      this.supabase
        .from('faturas')
        .select('total')
        .eq('user_id', userId)
        .eq('competencia', competencia)
        .neq('status', 'PAGA'),
    ])

    if (entradasRes.error) throw entradasRes.error
    if (saidasRes.error) throw saidasRes.error
    if (categoriasRes.error) throw categoriasRes.error
    if (faturasRes.error) throw faturasRes.error

    const paraLancamento = (linha: {
      id: string
      descricao: string
      valor: number
      data: string
      categoria_id: string
    }): Lancamento => ({
      id: linha.id,
      descricao: linha.descricao,
      valor: Number(linha.valor),
      data: linha.data,
      categoriaId: linha.categoria_id,
    })

    const entradas = entradasRes.data.map(paraLancamento)
    const saidas = saidasRes.data.map(paraLancamento)
    const categoriaPorId = new Map(categoriasRes.data.map((categoria) => [categoria.id, categoria]))

    const entradasDoMes = entradas.filter((entrada) => dentroDoPeriodo(entrada.data, periodo))
    const saidasDoMes = saidas.filter((saida) => dentroDoPeriodo(saida.data, periodo))

    const totalEntradas = somar(entradasDoMes)
    const totalSaidas = somar(saidasDoMes)
    const totalFaturas = faturasRes.data.reduce((soma, fatura) => soma + Number(fatura.total), 0)

    const serieEntradas = montarSerie(entradas, periodos)
    const serieSaidas = montarSerie(saidas, periodos)

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
