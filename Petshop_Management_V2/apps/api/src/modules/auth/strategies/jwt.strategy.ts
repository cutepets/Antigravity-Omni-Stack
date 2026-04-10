import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env['JWT_SECRET']
    if (!jwtSecret) {
      throw new Error('Missing required environment variable: JWT_SECRET')
    }

    const cookieExtractor = (req: Request) => {
      const rawCookie = req?.headers?.cookie
      if (!rawCookie) return null

      const token = rawCookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('access_token='))

      return token ? decodeURIComponent(token.slice('access_token='.length)) : null
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
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
