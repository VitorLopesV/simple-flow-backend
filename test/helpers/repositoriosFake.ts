import { vi } from 'vitest'

import type { Categoria } from '../../src/domain/entities/Categoria'
import type { AuthService } from '../../src/domain/repositories/AuthService'
import type { CartaoRepository } from '../../src/domain/repositories/CartaoRepository'
import type { CategoriaRepository } from '../../src/domain/repositories/CategoriaRepository'
import type { DashboardRepository } from '../../src/domain/repositories/DashboardRepository'
import type { EntradaRepository } from '../../src/domain/repositories/EntradaRepository'
import type { FaturaRepository } from '../../src/domain/repositories/FaturaRepository'
import type { PerfilRepository } from '../../src/domain/repositories/PerfilRepository'
import type { SaidaRepository } from '../../src/domain/repositories/SaidaRepository'

/**
 * Implementações falsas das interfaces do domínio, com cada método espionado — os
 * use-cases são testados isolados da infraestrutura, sem o client Supabase.
 */

export function criarEntradaRepositoryFake() {
  return {
    listar: vi.fn(),
    resumo: vi.fn(),
    listarDoPeriodo: vi.fn(),
    buscarPorId: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    remover: vi.fn(),
  } satisfies EntradaRepository
}

export function criarSaidaRepositoryFake() {
  return {
    listar: vi.fn(),
    resumo: vi.fn(),
    listarDoPeriodo: vi.fn(),
    buscarPorId: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    remover: vi.fn(),
  } satisfies SaidaRepository
}

export function criarCartaoRepositoryFake() {
  return {
    listar: vi.fn(),
    buscarPorId: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    remover: vi.fn(),
  } satisfies CartaoRepository
}

export function criarFaturaRepositoryFake() {
  return {
    listarComFaturas: vi.fn(),
    listarVencendoNoPeriodo: vi.fn(),
    pagar: vi.fn(),
    buscarTransacaoPorId: vi.fn(),
    criarTransacao: vi.fn(),
    atualizarTransacao: vi.fn(),
    removerTransacao: vi.fn(),
  } satisfies FaturaRepository
}

/** Categorias do sistema, uma por natureza — o que os use-cases consultam para validar a recorrência. */
export const CATEGORIAS = {
  despesaFixa: { id: 'cat-fixa', nome: 'Despesa Fixa', tipo: 'CONTA_FIXA', movimento: 'SAIDA', cor: '#6366f1', userId: null },
  despesaVariavel: { id: 'cat-var', nome: 'Despesa Variável', tipo: 'CONTA_VARIAVEL', movimento: 'SAIDA', cor: '#14b8a6', userId: null },
  investimento: { id: 'cat-inv', nome: 'Investimento', tipo: 'INVESTIMENTO', movimento: 'SAIDA', cor: '#0891b2', userId: null },
  rendaFixa: { id: 'cat-renda-fixa', nome: 'Renda Fixa', tipo: 'RENDA_FIXA', movimento: 'ENTRADA', cor: '#10b981', userId: null },
  rendaVariavel: { id: 'cat-renda-var', nome: 'Renda Variável', tipo: 'RENDA_VARIAVEL', movimento: 'ENTRADA', cor: '#06b6d4', userId: null },
  investimentos: { id: 'cat-invs', nome: 'Investimentos', tipo: 'INVESTIMENTO', movimento: 'ENTRADA', cor: '#eab308', userId: null },
  outros: { id: 'cat-outros', nome: 'Outros', tipo: 'OUTROS', movimento: 'ENTRADA', cor: '#94a3b8', userId: null },
} satisfies Record<string, Categoria>

/** `buscarPorId` responde a partir de `categorias` (por padrão, as de `CATEGORIAS`). */
export function criarCategoriaRepositoryFake(categorias: Categoria[] = Object.values(CATEGORIAS)) {
  return {
    listar: vi.fn(),
    buscarPorId: vi.fn(async (_userId: string, id: string) => categorias.find((categoria) => categoria.id === id) ?? null),
  } satisfies CategoriaRepository
}

export function criarDashboardRepositoryFake() {
  return { resumo: vi.fn() } satisfies DashboardRepository
}

export function criarAuthServiceFake() {
  return {
    registrar: vi.fn(),
    login: vi.fn(),
    renovar: vi.fn(),
    obterUsuarioPorToken: vi.fn(),
  } satisfies AuthService
}

export function criarPerfilRepositoryFake() {
  return { buscar: vi.fn(), atualizar: vi.fn() } satisfies PerfilRepository
}
