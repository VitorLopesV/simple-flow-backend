import { vi } from 'vitest'

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
    listarComProjecao: vi.fn(),
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
    listarComProjecao: vi.fn(),
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

export function criarCategoriaRepositoryFake() {
  return { listar: vi.fn() } satisfies CategoriaRepository
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
