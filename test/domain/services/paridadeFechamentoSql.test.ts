import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { calcularPlacar } from '../../../src/domain/services/placarDoSprint'
import { CONFIGURACAO_PONTUACAO, pontosDaTarefa } from '../../../src/domain/services/pontuacao'

/**
 * Paridade entre a função SQL de fechamento (migration) e a fórmula TypeScript do placar (#68): a lógica é
 * duplicada em SQL, então este teste lê a migration e confere constantes, fórmula e formato da foto.
 */
const SQL = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261116190000_fechamento_sprint.sql'), 'utf8')
const PONTOS = SQL.slice(SQL.indexOf('function public.pontos_da_tarefa'), SQL.indexOf('function public.fechar_sprint('))

/** Lê `case <variavel> when A then B ... end` do SQL como pares [A, B] (B como texto, para não perder casas). */
function lerCase(variavel: string): Array<[string, string]> {
  const bloco = new RegExp(`case ${variavel}((?: when '?\\w+'? then [\\d.]+)+) end`).exec(PONTOS)
  expect(bloco, `case ${variavel} não encontrado na migration`).not.toBeNull()
  return [...bloco![1]!.matchAll(/when '?(\w+)'? then ([\d.]+)/g)].map((m) => [m[1]!, m[2]!])
}

/** Decimal em texto (`1.5`) como fração inteira [numerador, denominador], sem erro de ponto flutuante. */
function fracao(texto: string): [bigint, bigint] {
  const [inteira, decimal = ''] = texto.split('.')
  return [BigInt(inteira! + decimal), 10n ** BigInt(decimal.length)]
}

/** `round()` do Postgres (numeric): meio para longe do zero; valores aqui são sempre positivos. */
function arredondar([num, den]: [bigint, bigint]): number {
  return Number((2n * num + den) / (2n * den))
}

describe('paridade da migration de fechamento com o placar em TypeScript', () => {
  it('as tabelas de pontuação do SQL são as de CONFIGURACAO_PONTUACAO', () => {
    const tempo = Object.fromEntries(lerCase('p_tempo'))
    const dificuldade = Object.fromEntries(lerCase('p_dificuldade'))
    const prioridade = Object.fromEntries(lerCase('p_prioridade'))

    expect(Object.keys(tempo).map(Number).sort((a, b) => a - b)).toEqual(
      Object.keys(CONFIGURACAO_PONTUACAO.baseDoTempo).map(Number).sort((a, b) => a - b),
    )
    for (const [minutos, base] of Object.entries(CONFIGURACAO_PONTUACAO.baseDoTempo)) expect(Number(tempo[minutos])).toBe(base)
    for (const [chave, fator] of Object.entries(CONFIGURACAO_PONTUACAO.multiplicadorDeDificuldade)) {
      expect(Number(dificuldade[chave])).toBe(fator)
    }
    for (const [chave, fator] of Object.entries(CONFIGURACAO_PONTUACAO.multiplicadorDePrioridade)) {
      expect(Number(prioridade[chave])).toBe(fator)
    }
    expect(PONTOS).toContain(`when p_atrasada then ${CONFIGURACAO_PONTUACAO.fatorDeAtraso} else 1 end`)
  })

  it('para as 45 combinações (com e sem atraso), a conta exata do SQL dá o mesmo inteiro que pontosDaTarefa', () => {
    const tempo = lerCase('p_tempo')
    const dificuldade = lerCase('p_dificuldade')
    const prioridade = lerCase('p_prioridade')
    let combinacoes = 0

    for (const [minutos, base] of tempo) {
      for (const [dif, fd] of dificuldade) {
        for (const [pri, fp] of prioridade) {
          for (const atrasada of [false, true]) {
            const fatores = [fracao(base), fracao(fd), fracao(fp), fracao(atrasada ? '0.2' : '1')]
            const num = fatores.reduce((acc, [n]) => acc * n, 1n)
            const den = fatores.reduce((acc, [, d]) => acc * d, 1n)
            const esperado = arredondar([num, den])
            const obtido = pontosDaTarefa(
              { tempoEstimado: Number(minutos) as 15, dificuldade: dif as 'FACIL', prioridade: pri as 'BAIXA' },
              atrasada,
            )
            expect(obtido, `${minutos}/${dif}/${pri}/atrasada=${atrasada}`).toBe(esperado)
            combinacoes += 1
          }
        }
      }
    }
    expect(combinacoes).toBe(90)
  })

  it('rotina vale 40 por dia e o bônus compara inteiros a partir de 90% (nunca o percentual arredondado)', () => {
    expect(CONFIGURACAO_PONTUACAO.pontosDoDiaDeRotina).toBe(40)
    expect(CONFIGURACAO_PONTUACAO.bonusAPartirDeDecimos).toBe(9)
    expect(SQL).toContain('v_dias * 40 + v_tarefas_total')
    expect(SQL).toContain('v_dias_cumpridos * 40 + v_tarefas_feitos')
    expect(SQL).toContain("'bonus', v_total > 0 and v_feitos * 10 >= v_total * 9")
    expect(SQL).toContain("'percentual', case when v_total = 0 then 0 else round(v_feitos * 1000.0 / v_total) / 10.0 end")
  })

  it('a foto do SQL tem exatamente as chaves do placar do TypeScript', () => {
    const placar = calcularPlacar([], [], '2026-11-16', '2026-11-20')
    const chaves = (objeto: object): string[] =>
      Object.entries(objeto).flatMap(([chave, valor]) => [chave, ...(typeof valor === 'object' ? chaves(valor) : [])])

    expect(chaves(placar).length).toBe(15)
    for (const chave of chaves(placar)) expect(SQL, `chave ${chave}`).toContain(`'${chave}'`)
  })

  it('SQL: só dia útil dentro do sprint, sem lembrete e sem arquivadas; super task não existe em `tarefas`', () => {
    expect(SQL).toContain('extract(isodow from o.data) between 1 and 5')
    expect(SQL).toContain('extract(isodow from t.dia) between 1 and 5')
    expect(SQL).toContain('not o.lembrete')
    expect(SQL).toContain('t.arquivada_em is null')
    expect(SQL).not.toContain('super_tasks')
  })

  it('ordem do fechamento no SQL: foto, depois devolver as tarefas, depois o próximo sprint', () => {
    const foto = SQL.indexOf("set situacao = 'FECHADO'")
    const devolver = SQL.indexOf('set sprint_id = null, nao_concluida_no_sprint_de')
    const proximo = SQL.indexOf('insert into public.sprints (user_id, inicio, fim)')
    const aplicado = SQL.indexOf('set fechamento_aplicado_em = p_agora')
    expect(foto).toBeGreaterThan(0)
    expect(devolver).toBeGreaterThan(foto)
    expect(proximo).toBeGreaterThan(devolver)
    expect(aplicado).toBeGreaterThan(proximo)
  })

  it('idempotente e imutável: ignora sprint aplicado, só regrava foto de sprint ABERTO, trigger barra mudança', () => {
    expect(SQL).toContain('v_sprint.fechamento_aplicado_em is not null')
    expect(SQL).toContain("if v_sprint.situacao = 'ABERTO' then")
    expect(SQL).toContain('on conflict (user_id, inicio) do nothing')
    expect(SQL).toContain("old.situacao = 'FECHADO'")
    expect(SQL).toContain('raise exception')
  })

  it('o fechamento só roda a partir de sexta 23:59 em São Paulo', () => {
    expect(SQL).toContain("((v_sprint.fim + time '23:59') at time zone 'America/Sao_Paulo')")
    expect(SQL).toContain("((s.fim + time '23:59') at time zone 'America/Sao_Paulo')")
  })

  it('agenda `59 2 * * 6` (UTC) e revoga EXECUTE de anon e authenticated em todas as funções novas', () => {
    expect(SQL).toMatch(/cron\.schedule\(\s*'fechar-sprints-vencidos',\s*'59 2 \* \* 6',/)
    for (const assinatura of [
      'sprints_foto_imutavel()',
      'pontos_da_tarefa(int, text, text, boolean)',
      'fechar_sprint(uuid, timestamptz)',
      'fechar_sprints_vencidos(timestamptz)',
    ]) {
      expect(SQL).toContain(`revoke execute on function public.${assinatura} from public, anon, authenticated;`)
    }
  })
})
