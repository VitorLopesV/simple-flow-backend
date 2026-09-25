import cors from 'cors'
import express, { type Express } from 'express'

import { env } from './infrastructure/config/env'
import { errorHandler } from './presentation/http/middlewares/errorHandler'
import { routes } from './presentation/http/routes'

/** Composition root: monta middlewares e rotas. Compartilhado entre server.ts e api/index.ts. */
export function createApp(): Express {
  const app = express()

  app.use(
    cors({
      origin: env.corsOrigins,
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  // O padrão (100 KB) barraria a foto de perfil (data URL, até 500 KB decodificados ≈
  // 683 KB em base64) antes de o schema dar uma mensagem clara. Acima disso vira 413.
  app.use(express.json({ limit: '1mb' }))

  app.use('/api', routes)

  app.use(errorHandler)

  return app
}
