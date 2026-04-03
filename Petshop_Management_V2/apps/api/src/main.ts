import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  // Serve static files from the uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  })

  // Increase payload size limits for file/avatar uploads via base64
  app.use(json({ limit: '10mb' }))
  app.use(urlencoded({ extended: true, limit: '10mb' }))

  const port = process.env['API_PORT'] ?? 3001
  const corsOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000')
    .split(',')
    .map((o: string) => o.trim())

  // Global validation pipe
  // NOTE: whitelist:true strips unknown props, forbidNonWhitelisted:false allows them for interface-based DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Interface DTOs don't have class-validator decorators
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // API prefix
  app.setGlobalPrefix('api')

  // Swagger (dev only)
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('🐾 Petshop Service API')
      .setDescription('API cho hệ thống quản lý cửa hàng thú cưng')
      .setVersion('2.0')
      .addBearerAuth()
      .build()

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
    console.log(`📖 Swagger: http://localhost:${port}/api/docs`)
  }

  await app.listen(port)
  console.log(`🚀 Petshop API running on http://localhost:${port}/api`)
}

bootstrap()
