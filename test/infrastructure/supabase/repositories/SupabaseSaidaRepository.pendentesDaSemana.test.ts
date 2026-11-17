import { describe, expect, it } from 'vitest'

import { SupabaseSaidaRepository } from '../../../../src/infrastructure/supabase/repositories/SupabaseSaidaRepository'
import { USER_ID, linhaFatura, linhaSaida, type FaturaRow, type SaidaRow } from '../../../helpers/linhasSupabase'
import { argumentos, criarSupabaseFake, falha, ok, type ConsultaRegistrada } from '../../../helpers/supabaseFake'

function noIntervalo<T>(consulta: ConsultaRegistrada, linhas: T[], coluna: keyof T & string): T[] {
  const [, inicio] = argumentos(consulta, 'gte')!
  const [, fim] = argumentos(consulta, 'lte')!
  return linhas.filter((linha) => String(linha[coluna]) >= String(inicio) && String(linha[coluna]) <= String(fim))
}

function cenario({ saidas = [] as SaidaRow[], faturas = [] as FaturaRow[] } = {}) {
  return criarSupabaseFake({
    saidas: (consulta) => ok(noIntervalo(consulta, saidas, 'vencimento')),
    faturas: (consulta) => ok(noIntervalo(consulta, faturas, 'vencimento')),
    cartoes: () => ok([{ id: 'cartao-1', nome: 'Nubank' }]),
    transacoes_cartao: () => ok([]),
  })
}

describe('SupabaseSaidaRepository.listarPendentesVencendoEntre', () => {
  it('consulta pelo vencimento, só PENDENTE e sempre com user_id', async () => {
    const fake = cenario()

    await new SupabaseSaidaRepository(fake.client).listarPendentesVencendoEntre(USER_ID, '2026-11-16', '2026-11-22')

    expect(fake.consultasDe('saidas')).toHaveLength(1)
    expect(fake.consultasDe('saidas')[0]!.chamadas).toEqual([
      ['select', '*'],
      ['eq', 'user_id', USER_ID],
      ['eq', 'status', 'PENDENTE'],
      ['gte', 'vencimento', '2026-11-16'],
      ['lte', 'vencimento', '2026-11-22'],
    ])
    expect(fake.consultasDe('faturas')[0]!.chamadas).toContainEqual(['eq', 'user_id', USER_ID])
  })

  it('traz saída de outra competência que vence na semana e ordena por vencimento e descrição', async () => {
    const { client } = cenario({
      saidas: [
        linhaSaida({ id: 'b', descricao: 'B', data: '2026-10-30', status: 'PENDENTE', vencimento: '2026-11-18' }),
        linhaSaida({ id: 'a', descricao: 'A', data: '2026-11-01', status: 'PENDENTE', vencimento: '2026-11-18' }),
        linhaSaida({ id: 'cedo', descricao: 'Z', status: 'PENDENTE', vencimento: '2026-11-16' }),
        linhaSaida({ id: 'fora', status: 'PENDENTE', vencimento: '2026-11-23' }),
      ],
    })

    const resultado = await new SupabaseSaidaRepository(client).listarPendentesVencendoEntre(USER_ID, '2026-11-16', '2026-11-22')

    expect(resultado.map((s) => s.id)).toEqual(['cedo', 'a', 'b'])
  })

  it('inclui só fatura em aberto da janela, como saída derivada', async () => {
    const { client } = cenario({
      faturas: [
        linhaFatura({ id: 'aberta', vencimento: '2026-11-20', total: 300 }),
        linhaFatura({ id: 'paga', vencimento: '2026-11-19', status: 'PAGA', pago_em: '2026-11-10' }),
        linhaFatura({ id: 'fora', vencimento: '2026-11-25' }),
      ],
    })

    const resultado = await new SupabaseSaidaRepository(client).listarPendentesVencendoEntre(USER_ID, '2026-11-16', '2026-11-22')

    expect(resultado).toEqual([
      expect.objectContaining({ id: 'sai_fat_aberta', valor: 300, status: 'PENDENTE', automatica: true, vencimento: '2026-11-20' }),
    ])
  })

  it('semana que cruza o mês lê as faturas dos dois meses e recorta pela janela', async () => {
    const fake = cenario({
      faturas: [
        linhaFatura({ id: 'nov', vencimento: '2026-11-30' }),
        linhaFatura({ id: 'dez', vencimento: '2026-12-02' }),
        linhaFatura({ id: 'dez-fora', vencimento: '2026-12-10' }),
      ],
    })

    const resultado = await new SupabaseSaidaRepository(fake.client).listarPendentesVencendoEntre(USER_ID, '2026-11-30', '2026-12-06')

    expect(resultado.map((s) => s.id)).toEqual(['sai_fat_nov', 'sai_fat_dez'])
    expect(fake.consultasDe('faturas')).toHaveLength(2)
  })

  it('propaga o erro do banco', async () => {
    const fake = criarSupabaseFake({ saidas: [falha({ message: 'falha' })] })

    await expect(
      new SupabaseSaidaRepository(fake.client).listarPendentesVencendoEntre(USER_ID, '2026-11-16', '2026-11-22'),
    ).rejects.toEqual({ message: 'falha' })
  })
})
