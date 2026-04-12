/**
 * @file        main.ts - NestJS Application Bootstrap
 * @encoding    utf-8
 * @description Bootstraps the Petshop Management API with UTF-8 charset
 *              enforcement on every HTTP response.
 */
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { json, urlencoded } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { join } from 'path'
import { AppModule } from './app.module.js'

async function bootstrap() {
  console.log('DATABASE_URL is:', process.env['DATABASE_URL'])

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    next()
  })

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  })

  app.use(json({ limit: '10mb' }))
  app.use(urlencoded({ extended: true, limit: '10mb' }))

  const port = process.env['API_PORT'] ?? 3001
  const corsOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000')
    .split(',')
    .map((origin: string) => origin.trim())

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  app.setGlobalPrefix('api')

  if (process.env['NODE_ENV'] !== 'production') {
    try {
      const config = new DocumentBuilder()
        .setTitle('Petshop Service API')
        .setDescription('API cho he thong quan ly cua hang thu cung')
        .setVersion('2.0')
        .addBearerAuth()
        .build()

      const document = SwaggerModule.createDocument(app, config)
      SwaggerModule.setup('api/docs', app, document)
      console.log(`Swagger: http://localhost:${port}/api/docs`)
    } catch (error) {
      console.warn('Swagger bootstrap skipped:', error)
    }
  }

  await app.listen(port)
  console.log(`Petshop API running on http://localhost:${port}/api`)
}

bootstrap()
