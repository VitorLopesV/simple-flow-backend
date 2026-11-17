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
      areas: {
        Row: {
          atualizado_em: string
          cor: string
          criado_em: string
          id: string
          nome: string
          sistema: boolean
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          cor: string
          criado_em?: string
          id?: string
          nome: string
          sistema?: boolean
          user_id: string
        }
        Update: {
          atualizado_em?: string
          cor?: string
          criado_em?: string
          id?: string
          nome?: string
          sistema?: boolean
          user_id?: string
        }
        Relationships: []
      }
      atividades: {
        Row: {
          acao: string
          categoria_id: string | null
          criado_em: string
          data: string
          descricao: string
          id: string
          registro_id: string
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          acao: string
          categoria_id?: string | null
          criado_em?: string
          data: string
          descricao: string
          id?: string
          registro_id: string
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          acao?: string
          categoria_id?: string | null
          criado_em?: string
          data?: string
          descricao?: string
          id?: string
          registro_id?: string
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
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
          editado_manualmente: boolean
          id: string
          observacao: string | null
          recorrente: boolean
          serie_encerrada: boolean
          serie_id: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          categoria_id: string
          criado_em?: string
          data: string
          descricao: string
          editado_manualmente?: boolean
          id?: string
          observacao?: string | null
          recorrente?: boolean
          serie_encerrada?: boolean
          serie_id?: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          categoria_id?: string
          criado_em?: string
          data?: string
          descricao?: string
          editado_manualmente?: boolean
          id?: string
          observacao?: string | null
          recorrente?: boolean
          serie_encerrada?: boolean
          serie_id?: string | null
          tipo?: string
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
      itens_rotina: {
        Row: {
          area_id: string
          atualizado_em: string
          criado_em: string
          data_inicial: string | null
          dias_semana: number[] | null
          id: string
          intervalo_dias: number | null
          modo: string
          nome: string
          user_id: string
          vezes: Json
        }
        Insert: {
          area_id: string
          atualizado_em?: string
          criado_em?: string
          data_inicial?: string | null
          dias_semana?: number[] | null
          id?: string
          intervalo_dias?: number | null
          modo: string
          nome: string
          user_id: string
          vezes: Json
        }
        Update: {
          area_id?: string
          atualizado_em?: string
          criado_em?: string
          data_inicial?: string | null
          dias_semana?: number[] | null
          id?: string
          intervalo_dias?: number | null
          modo?: string
          nome?: string
          user_id?: string
          vezes?: Json
        }
        Relationships: []
      }
      ocorrencias_rotina: {
        Row: {
          concluida_em: string | null
          criado_em: string
          data: string
          hora: string | null
          id: string
          indice: number
          item_id: string | null
          lembrete: boolean
          nome: string
          ordem: number
          sprint_id: string
          user_id: string
        }
        Insert: {
          concluida_em?: string | null
          criado_em?: string
          data: string
          hora?: string | null
          id?: string
          indice: number
          item_id?: string | null
          lembrete?: boolean
          nome: string
          ordem: number
          sprint_id: string
          user_id: string
        }
        Update: {
          concluida_em?: string | null
          criado_em?: string
          data?: string
          hora?: string | null
          id?: string
          indice?: number
          item_id?: string | null
          lembrete?: boolean
          nome?: string
          ordem?: number
          sprint_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          criado_em: string
          foto_url: string | null
          id: string
          nome: string | null
          recompensa_padrao: string | null
          telefone: string | null
        }
        Insert: {
          criado_em?: string
          foto_url?: string | null
          id: string
          nome?: string | null
          recompensa_padrao?: string | null
          telefone?: string | null
        }
        Update: {
          criado_em?: string
          foto_url?: string | null
          id?: string
          nome?: string | null
          recompensa_padrao?: string | null
          telefone?: string | null
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
          editado_manualmente: boolean
          forma_pagamento: string
          id: string
          observacao: string | null
          pago_em: string | null
          recorrente: boolean
          serie_encerrada: boolean
          serie_id: string | null
          status: string
          tipo: string
          user_id: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          atualizado_em?: string
          automatica?: boolean
          cartao_id?: string | null
          categoria_id: string
          criado_em?: string
          data: string
          descricao: string
          editado_manualmente?: boolean
          forma_pagamento: string
          id?: string
          observacao?: string | null
          pago_em?: string | null
          recorrente?: boolean
          serie_encerrada?: boolean
          serie_id?: string | null
          status?: string
          tipo?: string
          user_id: string
          valor: number
          vencimento?: string | null
        }
        Update: {
          atualizado_em?: string
          automatica?: boolean
          cartao_id?: string | null
          categoria_id?: string
          criado_em?: string
          data?: string
          descricao?: string
          editado_manualmente?: boolean
          forma_pagamento?: string
          id?: string
          observacao?: string | null
          pago_em?: string | null
          recorrente?: boolean
          serie_encerrada?: boolean
          serie_id?: string | null
          status?: string
          tipo?: string
          user_id?: string
          valor?: number
          vencimento?: string | null
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
      sprints: {
        Row: {
          atualizado_em: string
          criado_em: string
          fechado_em: string | null
          fechamento_aplicado_em: string | null
          fim: string
          foto: Json | null
          id: string
          inicio: string
          recompensa: string | null
          rotina_gerada_em: string | null
          situacao: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          fechado_em?: string | null
          fechamento_aplicado_em?: string | null
          fim: string
          foto?: Json | null
          id?: string
          inicio: string
          recompensa?: string | null
          rotina_gerada_em?: string | null
          situacao?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          fechado_em?: string | null
          fechamento_aplicado_em?: string | null
          fim?: string
          foto?: Json | null
          id?: string
          inicio?: string
          recompensa?: string | null
          rotina_gerada_em?: string | null
          situacao?: string
          user_id?: string
        }
        Relationships: []
      }
      super_tasks: {
        Row: {
          area_id: string
          arquivada_em: string | null
          atualizado_em: string
          concluida_em: string | null
          criado_em: string
          data_termino: string | null
          id: string
          notas: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          area_id: string
          arquivada_em?: string | null
          atualizado_em?: string
          concluida_em?: string | null
          criado_em?: string
          data_termino?: string | null
          id?: string
          notas?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          area_id?: string
          arquivada_em?: string | null
          atualizado_em?: string
          concluida_em?: string | null
          criado_em?: string
          data_termino?: string | null
          id?: string
          notas?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      tarefas: {
        Row: {
          area_id: string
          arquivada_em: string | null
          atualizado_em: string
          concluida_em: string | null
          criado_em: string
          dia: string | null
          dificuldade: string | null
          hora: string | null
          id: string
          nao_concluida_no_sprint_de: string | null
          notas: string | null
          prioridade: string | null
          sprint_id: string | null
          super_task_id: string | null
          tempo_estimado_minutos: number | null
          titulo: string
          user_id: string
        }
        Insert: {
          area_id: string
          arquivada_em?: string | null
          atualizado_em?: string
          concluida_em?: string | null
          criado_em?: string
          dia?: string | null
          dificuldade?: string | null
          hora?: string | null
          id?: string
          nao_concluida_no_sprint_de?: string | null
          notas?: string | null
          prioridade?: string | null
          sprint_id?: string | null
          super_task_id?: string | null
          tempo_estimado_minutos?: number | null
          titulo: string
          user_id: string
        }
        Update: {
          area_id?: string
          arquivada_em?: string | null
          atualizado_em?: string
          concluida_em?: string | null
          criado_em?: string
          dia?: string | null
          dificuldade?: string | null
          hora?: string | null
          id?: string
          nao_concluida_no_sprint_de?: string | null
          notas?: string | null
          prioridade?: string | null
          sprint_id?: string | null
          super_task_id?: string | null
          tempo_estimado_minutos?: number | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      transacoes_cartao: {
        Row: {
          atualizado_em: string
          cartao_id: string
          categoria_id: string
          criado_em: string
          data: string
          descricao: string
          editado_manualmente: boolean
          fatura_id: string
          id: string
          observacao: string | null
          parcela_atual: number
          recorrente: boolean
          serie_encerrada: boolean
          serie_id: string | null
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
          editado_manualmente?: boolean
          fatura_id: string
          id?: string
          observacao?: string | null
          parcela_atual?: number
          recorrente?: boolean
          serie_encerrada?: boolean
          serie_id?: string | null
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
          editado_manualmente?: boolean
          fatura_id?: string
          id?: string
          observacao?: string | null
          parcela_atual?: number
          recorrente?: boolean
          serie_encerrada?: boolean
          serie_id?: string | null
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
      gerar_recorrencias_mes_seguinte: {
        Args: { referencia?: string }
        Returns: number
      }
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
