import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { DatabaseService } from '../../../database/database.service.js'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly db: DatabaseService) {
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

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.userId) {
      throw new UnauthorizedException('Token không hợp lệ')
    }
    const user = await this.db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        branchId: true,
        authorizedBranches: { select: { id: true } },
        role: { select: { code: true, permissions: true } },
      },
    })

    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ')
    }

    const authorizedBranchIds = Array.from(new Set([
      ...(user.branchId ? [user.branchId] : []),
      ...user.authorizedBranches.map((branch) => branch.id),
    ]))

    return {
      ...payload,
      role: user.role?.code ?? payload.role,
      permissions: Array.isArray(user.role?.permissions)
        ? user.role.permissions.filter((permission): permission is string => typeof permission === 'string')
        : undefined,
      branchId: user.branchId ?? null,
      authorizedBranchIds,
    }
  }
}
