import { createApp } from './app'
import { env } from './infrastructure/config/env'

const app = createApp()

app.listen(env.porta, () => {
  console.log(`API rodando em http://localhost:${env.porta}/api`)
})
