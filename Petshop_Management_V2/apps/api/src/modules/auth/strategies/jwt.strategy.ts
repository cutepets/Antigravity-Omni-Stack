import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { JwtPayload } from '@petshop/shared'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env['JWT_SECRET']
    if (!jwtSecret) {
      throw new Error('Missing required environment variable: JWT_SECRET')
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    })
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.userId) {
      throw new UnauthorizedException('Token không hợp lệ')
    }
    return payload
  }
}
