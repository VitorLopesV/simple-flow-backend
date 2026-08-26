import type { Cartao, CartaoPayload } from '../entities/Cartao'
import type { ID } from '../../shared/types/common'

export interface CartaoRepository {
  listar(userId: ID): Promise<Cartao[]>
  buscarPorId(userId: ID, id: ID): Promise<Cartao | null>
  criar(userId: ID, payload: CartaoPayload): Promise<Cartao>
  atualizar(userId: ID, id: ID, payload: CartaoPayload): Promise<Cartao>
  remover(userId: ID, id: ID): Promise<void>
}
