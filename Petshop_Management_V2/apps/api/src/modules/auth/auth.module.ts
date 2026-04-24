import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { GoogleAuthService } from './google-auth.service.js'
import { JwtStrategy } from './strategies/jwt.strategy.js'
import { TokenCleanupService } from './token-cleanup.service.js'
import { DatabaseModule } from '../../database/database.module.js'

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET')
        if (!secret) throw new Error('Missing required environment variable: JWT_SECRET')
        return {
          secret,
          signOptions: { expiresIn: (config.get('JWT_EXPIRES_IN') ?? '15m') as any },
        }
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleAuthService, JwtStrategy, TokenCleanupService],
  exports: [AuthService, JwtModule],
})
export class AuthModule { }
