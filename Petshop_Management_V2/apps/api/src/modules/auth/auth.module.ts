import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { JwtStrategy } from './strategies/jwt.strategy.js'
import { DatabaseModule } from '../../database/database.module.js'

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      secret: process.env['JWT_SECRET'] ?? 'dev-secret',
      signOptions: { expiresIn: (process.env['JWT_EXPIRES_IN'] ?? '15m') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
