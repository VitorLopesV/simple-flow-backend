import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { montarFoto } from '../../../src/domain/services/fotoDoSprint'

/**
 * A migration da #72 redefine `fechar_sprint` com a recompensa e o detalhe na foto: a lógica é duplicada em SQL,
 * então este teste lê a migration e confere chaves, ordem dos passos, imutabilidade e permissões.
 */
const SQL = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261116200000_recompensa_sprint.sql'), 'utf8')

describe('paridade da migration de recompensa com a foto em TypeScript', () => {
  it('a foto do SQL tem as chaves da foto do TypeScript, inclusive recompensa e detalhe', () => {
    const foto = montarFoto(
      [{ nome: 'R', data: '2026-11-17', hora: null, ordem: 0, concluidaEm: null, lembrete: false }],
      [{ id: 't', titulo: 'T', dia: '2026-11-17', hora: null, tempoEstimado: 60, dificuldade: 'FACIL', prioridade: 'BAIXA', concluida: false, atrasada: false, superTask: false }],
      '2026-11-16',
      '2026-11-20',
      null,
    )
    const chaves = (objeto: object): string[] =>
      Object.entries(objeto).flatMap(([chave, valor]) => [chave, ...(valor && typeof valor === 'object' ? chaves(Array.isArray(valor) ? (valor[0] ?? {}) : valor) : [])])

    for (const chave of new Set(chaves(foto))) expect(SQL, `chave ${chave}`).toContain(`'${chave}'`)
    for (const situacao of ['CONCLUIDA', 'ATRASADA', 'NAO_CONCLUIDA']) expect(SQL).toContain(`'${situacao}'`)
  })

  it('a recompensa efetiva é a do sprint ou a padrão do perfil, avaliada no fechamento', () => {
    expect(SQL).toContain("nullif(btrim(v_sprint.recompensa), '')")
    expect(SQL).toContain('p.recompensa_padrao')
    expect(SQL).toContain("'recompensa', v_recompensa")
    expect(SQL.indexOf('v_recompensa text')).toBeGreaterThan(0)
  })

  it('mantém o bônus por inteiros e a ordem foto -> devolver -> próximo sprint -> aplicado', () => {
    expect(SQL).toContain("'bonus', v_total > 0 and v_feitos * 10 >= v_total * 9")
    const foto = SQL.indexOf("set situacao = 'FECHADO'")
    const devolver = SQL.indexOf('set sprint_id = null, nao_concluida_no_sprint_de')
    const proximo = SQL.indexOf('insert into public.sprints (user_id, inicio, fim)')
    const aplicado = SQL.indexOf('set fechamento_aplicado_em = p_agora')
    expect(foto).toBeGreaterThan(0)
    expect(devolver).toBeGreaterThan(foto)
    expect(proximo).toBeGreaterThan(devolver)
    expect(aplicado).toBeGreaterThan(proximo)
  })

  it('idempotente: ignora sprint aplicado e só regrava a foto de sprint ABERTO', () => {
    expect(SQL).toContain('v_sprint.fechamento_aplicado_em is not null')
    expect(SQL).toContain("if v_sprint.situacao = 'ABERTO' then")
    expect(SQL).toContain('on conflict (user_id, inicio) do nothing')
  })

  it('sprint fechado é imutável também na recompensa; consultas novas filtram por user_id', () => {
    expect(SQL).toContain('(new.situacao, new.foto, new.fechado_em, new.recompensa)')
    expect(SQL).toContain("old.situacao = 'FECHADO'")
    expect(SQL).toContain('o.user_id = v_sprint.user_id')
    expect(SQL).toContain('t.user_id = v_sprint.user_id')
  })

  it('limita a recompensa a 1–120 caracteres no banco e revoga EXECUTE de anon/authenticated', () => {
    expect(SQL).toContain('char_length(recompensa) between 1 and 120')
    expect(SQL).toContain('char_length(recompensa_padrao) between 1 and 120')
    for (const assinatura of ['sprints_foto_imutavel()', 'fechar_sprint(uuid, timestamptz)']) {
      expect(SQL).toContain(`revoke execute on function public.${assinatura} from public, anon, authenticated;`)
    }
  })
})
