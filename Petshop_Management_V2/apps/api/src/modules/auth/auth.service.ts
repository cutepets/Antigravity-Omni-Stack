import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { DatabaseService } from '../../database/database.service.js'
import type { LoginResponse, AuthUser, JwtPayload } from '@petshop/shared'
import { LoginDto } from './dto/login.dto.js'

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  private getRefreshSecret(): string {
    const secret = process.env['JWT_REFRESH_SECRET']
    if (!secret) {
      throw new Error('Missing required environment variable: JWT_REFRESH_SECRET')
    }
    return secret
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.db.user.findFirst({
      where: { username: dto.username },
      select: {
        id: true,
        username: true,
        fullName: true,
        staffCode: true,
        branchId: true,
        avatar: true,
        passwordHash: true,
        status: true,
        branch: { select: { id: true, name: true, address: true, isActive: true } },
        authorizedBranches: { select: { id: true, name: true, address: true, isActive: true } },
        role: true
      },
    })

    if (!user) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng')
    }

    if (user.status === 'LEAVING' || user.status === 'RESIGNED' || user.status === 'QUIT') {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa')
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng')
    }

    const combinedRole = (user as any).role?.code ?? (user as any).legacyRole
    const combinedPermissions = (user as any).role?.permissions ?? []

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      role: combinedRole as JwtPayload['role'],
      permissions: combinedPermissions
    }

    const accessToken = this.jwt.sign(payload as Record<string, any>)
    const refreshToken = this.jwt.sign(payload as Record<string, any>, {
      secret: this.getRefreshSecret(),
      expiresIn: (process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d') as any,
    })

    // Store refresh token in DB
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    })

    let mappedAuthorizedBranches = Array.from(
      new Map(
        [...((user as any).branch ? [(user as any).branch] : []), ...((user as any).authorizedBranches || [])].map(b => [b.id, b])
      ).values()
    ).filter(b => b.isActive)

    if (combinedPermissions.includes('FULL_BRANCH_ACCESS') || combinedRole === 'SUPER_ADMIN' || combinedRole === 'ADMIN') {
       const allBranches = await this.db.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, address: true, isActive: true } })
       mappedAuthorizedBranches = allBranches as any[]
    }

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: combinedRole as AuthUser['role'],
      staffCode: user.staffCode,
      branchId: user.branchId ?? null,
      avatar: user.avatar ?? null,
      authorizedBranches: mappedAuthorizedBranches,
      permissions: combinedPermissions
    }

    return { accessToken, refreshToken, user: authUser }
  }

  async refreshTokens(token: string): Promise<LoginResponse> {
    let payload: JwtPayload
    try {
      payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.getRefreshSecret(),
      })
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ')
    }

    const stored = await this.db.refreshToken.findFirst({
      where: { token, expiresAt: { gte: new Date() } },
      include: { 
        user: {
          include: {
            branch: { select: { id: true, name: true, address: true, isActive: true } },
            authorizedBranches: { select: { id: true, name: true, address: true, isActive: true } },
            role: true
          }
        } 
      },
    })

    if (!stored) {
      throw new UnauthorizedException('Refresh token đã hết hạn hoặc không tồn tại')
    }

    // Rotate — delete old, issue new
    await this.db.refreshToken.delete({ where: { id: stored.id } })

    const u = stored.user
    const combinedRole = (u as any).role?.code ?? (u as any).legacyRole
    const combinedPermissions = (u as any).role?.permissions ?? []

    const newPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: payload.userId,
      role: combinedRole,
      permissions: combinedPermissions,
    }
    const newAccess = this.jwt.sign(newPayload as Record<string, any>)
    const newRefresh = this.jwt.sign(newPayload as Record<string, any>, {
      secret: this.getRefreshSecret(),
      expiresIn: (process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d') as any,
    })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    await this.db.refreshToken.create({
      data: { userId: payload.userId, token: newRefresh, expiresAt },
    })

    const authUser: AuthUser = {
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: combinedRole,
      permissions: combinedPermissions,
      staffCode: u.staffCode,
      branchId: u.branchId ?? null,
      avatar: u.avatar ?? null,
      authorizedBranches: Array.from(
        new Map(
          [...((u as any).branch ? [(u as any).branch] : []), ...((u as any).authorizedBranches || [])].map(b => [b.id, b])
        ).values()
      ).filter(b => b.isActive)
    }

    return { accessToken: newAccess, refreshToken: newRefresh, user: authUser }
  }

  async logout(userId: string, token: string): Promise<void> {
    await this.db.refreshToken.deleteMany({
      where: { userId, token },
    })
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        staffCode: true,
        branchId: true,
        avatar: true,
        branch: { select: { id: true, name: true, address: true, isActive: true } },
        authorizedBranches: { select: { id: true, name: true, address: true, isActive: true } }
      },
    })

    if (!user) throw new NotFoundException('Không tìm thấy người dùng')

    const combinedRole = (user as any).role?.code ?? (user as any).legacyRole
    const combinedPermissions = (user as any).role?.permissions ?? []

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: combinedRole,
      permissions: combinedPermissions,
      staffCode: user.staffCode,
      branchId: user.branchId ?? null,
      avatar: user.avatar ?? null,
      authorizedBranches: Array.from(
        new Map(
          [...((user as any).branch ? [(user as any).branch] : []), ...((user as any).authorizedBranches || [])].map(b => [b.id, b])
        ).values()
      ).filter(b => b.isActive)
    }
  }
}
