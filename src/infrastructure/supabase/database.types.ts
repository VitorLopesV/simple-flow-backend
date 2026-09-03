// Gerado a partir do schema do projeto Supabase "simple-flow" (id euyezrijzrptczujckyq).
// Regenerar após qualquer migration nova.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cartoes: {
        Row: {
          ativo: boolean
          bandeira: string
          cor: string
          criado_em: string
          dia_fechamento: number
          dia_vencimento: number
          id: string
          limite: number
          nome: string
          ultimos_digitos: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          bandeira: string
          cor: string
          criado_em?: string
          dia_fechamento: number
          dia_vencimento: number
          id?: string
          limite: number
          nome: string
          ultimos_digitos: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          bandeira?: string
          cor?: string
          criado_em?: string
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          limite?: number
          nome?: string
          ultimos_digitos?: string
          user_id?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          cor: string
          criado_em: string
          id: string
          movimento: string
          nome: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          cor: string
          criado_em?: string
          id?: string
          movimento: string
          nome: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          cor?: string
          criado_em?: string
          id?: string
          movimento?: string
          nome?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      entradas: {
        Row: {
          atualizado_em: string
          categoria_id: string
          criado_em: string
          data: string
          descricao: string
          id: string
          observacao: string | null
          recorrente: boolean
          user_id: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          categoria_id: string
          criado_em?: string
          data: string
          descricao: string
          id?: string
          observacao?: string | null
          recorrente?: boolean
          user_id: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          categoria_id?: string
          criado_em?: string
          data?: string
          descricao?: string
          id?: string
          observacao?: string | null
          recorrente?: boolean
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "entradas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas: {
        Row: {
          cartao_id: string
          competencia: string
          fechamento: string
          id: string
          pago_em: string | null
          status: string
          total: number
          user_id: string
          vencimento: string
        }
        Insert: {
          cartao_id: string
          competencia: string
          fechamento: string
          id?: string
          pago_em?: string | null
          status?: string
          total?: number
          user_id: string
          vencimento: string
        }
        Update: {
          cartao_id?: string
          competencia?: string
          fechamento?: string
          id?: string
          pago_em?: string | null
          status?: string
          total?: number
          user_id?: string
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          criado_em: string
          id: string
          nome: string | null
        }
        Insert: {
          criado_em?: string
          id: string
          nome?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      saidas: {
        Row: {
          atualizado_em: string
          automatica: boolean
          cartao_id: string | null
          categoria_id: string
          criado_em: string
          data: string
          descricao: string
          forma_pagamento: string
          id: string
          observacao: string | null
          recorrente: boolean
          status: string
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          automatica?: boolean
          cartao_id?: string | null
          categoria_id: string
          criado_em?: string
          data: string
          descricao: string
          forma_pagamento: string
          id?: string
          observacao?: string | null
          recorrente?: boolean
          status?: string
          tipo?: string
          user_id: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          automatica?: boolean
          cartao_id?: string | null
          categoria_id?: string
          criado_em?: string
          data?: string
          descricao?: string
          forma_pagamento?: string
          id?: string
          observacao?: string | null
          recorrente?: boolean
          status?: string
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "saidas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saidas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes_cartao: {
        Row: {
          atualizado_em: string
          cartao_id: string
          categoria_id: string
          criado_em: string
          data: string
          descricao: string
          fatura_id: string
          id: string
          observacao: string | null
          parcela_atual: number
          recorrente: boolean
          tipo: string
          total_parcelas: number
          user_id: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          cartao_id: string
          categoria_id: string
          criado_em?: string
          data: string
          descricao: string
          fatura_id: string
          id?: string
          observacao?: string | null
          parcela_atual?: number
          recorrente?: boolean
          tipo?: string
          total_parcelas?: number
          user_id: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          cartao_id?: string
          categoria_id?: string
          criado_em?: string
          data?: string
          descricao?: string
          fatura_id?: string
          id?: string
          observacao?: string | null
          parcela_atual?: number
          recorrente?: boolean
          tipo?: string
          total_parcelas?: number
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_cartao_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_cartao_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_cartao_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
