import { validateEnv } from './env.schema'

const env = validateEnv()

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',

  database: {
    url: env.DATABASE_URL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  server: {
    apiPort: env.API_PORT,
    workerPort: env.WORKER_PORT,
    webPort: env.WEB_PORT,
    corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
  },

  redis: {
    url: env.REDIS_URL ?? 'redis://localhost:6379',
  },

  upload: {
    dir: env.UPLOAD_DIR,
    maxFileSize: env.MAX_FILE_SIZE,
  },
} as const

export type Config = typeof config
