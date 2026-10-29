/** Carrega e valida as variáveis de ambiente necessárias, falhando cedo no boot se algo faltar. */

function obrigatoria(nome: string): string {
  const valor = process.env[nome]
  if (!valor) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`)
  }
  return valor
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  porta: Number(process.env.PORT ?? 3000),
  supabaseUrl: obrigatoria('SUPABASE_URL'),
  supabaseAnonKey: obrigatoria('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: obrigatoria('SUPABASE_SERVICE_ROLE_KEY'),
  /** Opcional: sem ela o `GET /api/keepalive` rejeita toda chamada (a Vercel a envia como Bearer no cron). */
  cronSecret: process.env.CRON_SECRET,
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5180')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean),
}
