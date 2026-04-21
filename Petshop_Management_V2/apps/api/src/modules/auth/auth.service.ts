import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common'
import { createHash } from 'crypto'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { getRolePermissions, resolvePermissions } from '@petshop/auth'
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

  private mapAuthorizedBranches(user: {
    branch?: { id: string; name: string; address: string | null; isActive: boolean } | null
    authorizedBranches?: Array<{ id: string; name: string; address: string | null; isActive: boolean }>
  }) {
    return Array.from(
      new Map(
        [...(user.branch ? [user.branch] : []), ...(user.authorizedBranches || [])].map((branch) => [branch.id, branch]),
      ).values(),
    ).filter((branch) => branch.isActive)
  }

  private resolveRolePermissions(roleCode: string, rolePermissions: unknown): string[] {
    const storedPermissions = Array.isArray(rolePermissions) ? rolePermissions : []
    return resolvePermissions([
      ...storedPermissions,
      ...getRolePermissions(roleCode as any),
    ])
  }

  private getJwtPermissions(rolePermissions: unknown): string[] | undefined {
    const storedPermissions = Array.isArray(rolePermissions)
      ? rolePermissions
        .filter((permission): permission is string => typeof permission === 'string')
        .map((permission) => permission.trim())
        .filter(Boolean)
      : []

    return storedPermissions.length > 0 ? [...new Set(storedPermissions)] : undefined
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private getRefreshTokenExpiry(token: string): Date {
    const decoded = this.jwt.decode(token)
    if (decoded && typeof decoded === 'object' && typeof (decoded as { exp?: unknown }).exp === 'number') {
      return new Date((decoded as { exp: number }).exp * 1000)
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    return expiresAt
  }

  private async issueSessionForUser(user: {
    id: string
    username: string
    fullName: string
    staffCode: string
    branchId: string | null
    avatar: string | null
    googleId?: string | null
    googleEmail?: string | null
    status?: string
    branch?: { id: string; name: string; address: string | null; isActive: boolean } | null
    authorizedBranches?: Array<{ id: string; name: string; address: string | null; isActive: boolean }>
    role?: { code?: string | null; permissions?: unknown } | null
  }): Promise<LoginResponse> {
    if (user.status === 'LEAVING' || user.status === 'RESIGNED' || user.status === 'QUIT') {
      throw new UnauthorizedException('Tai khoan da bi vo hieu hoa')
    }

    const combinedRole = user.role?.code ?? ''
    const combinedPermissions = this.resolveRolePermissions(combinedRole, user.role?.permissions)
    let mappedAuthorizedBranches = this.mapAuthorizedBranches(user as any)

    if (
      combinedPermissions.includes('FULL_BRANCH_ACCESS') ||
      combinedRole === 'SUPER_ADMIN' ||
      combinedRole === 'ADMIN'
    ) {
      const allBranches = await this.db.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true, address: true, isActive: true },
      })
      mappedAuthorizedBranches = allBranches as any[]
    }

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      role: combinedRole as JwtPayload['role'],
      permissions: this.getJwtPermissions(user.role?.permissions),
      branchId: user.branchId ?? null,
      authorizedBranchIds: mappedAuthorizedBranches.map((branch) => branch.id),
    }

    const accessToken = this.jwt.sign(payload as Record<string, any>)
    const refreshToken = this.jwt.sign(payload as Record<string, any>, {
      secret: this.getRefreshSecret(),
      expiresIn: (process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d') as any,
    })

    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        token: this.hashRefreshToken(refreshToken),
        expiresAt: this.getRefreshTokenExpiry(refreshToken),
      },
    })

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: combinedRole as AuthUser['role'],
      staffCode: user.staffCode,
      branchId: user.branchId ?? null,
      avatar: user.avatar ?? null,
      authorizedBranches: mappedAuthorizedBranches,
      permissions: combinedPermissions,
      googleLinked: Boolean(user.googleId),
      googleEmail: user.googleEmail ?? null,
    }

    return { accessToken, refreshToken, user: authUser }
  }

  async createSessionForUserId(userId: string): Promise<LoginResponse> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        staffCode: true,
        branchId: true,
        avatar: true,
        googleId: true,
        googleEmail: true,
        status: true,
        branch: { select: { id: true, name: true, address: true, isActive: true } },
        authorizedBranches: { select: { id: true, name: true, address: true, isActive: true } },
        role: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException('Khong tim thay nguoi dung dang nhap Google')
    }

    return this.issueSessionForUser(user as any)
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
        googleId: true,
        googleEmail: true,
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

    const combinedRole = (user as any).role?.code ?? ''
    const combinedPermissions = this.resolveRolePermissions(combinedRole, (user as any).role?.permissions)

    let mappedAuthorizedBranches = this.mapAuthorizedBranches(user as any)

    if (combinedPermissions.includes('FULL_BRANCH_ACCESS') || combinedRole === 'SUPER_ADMIN' || combinedRole === 'ADMIN') {
       const allBranches = await this.db.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, address: true, isActive: true } })
       mappedAuthorizedBranches = allBranches as any[]
    }

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      role: combinedRole as JwtPayload['role'],
      permissions: this.getJwtPermissions((user as any).role?.permissions),
      branchId: user.branchId ?? null,
      authorizedBranchIds: mappedAuthorizedBranches.map((branch) => branch.id),
    }

    const accessToken = this.jwt.sign(payload as Record<string, any>)
    const refreshToken = this.jwt.sign(payload as Record<string, any>, {
      secret: this.getRefreshSecret(),
      expiresIn: (process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d') as any,
    })

    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        token: this.hashRefreshToken(refreshToken),
        expiresAt: this.getRefreshTokenExpiry(refreshToken),
      },
    })

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: combinedRole as AuthUser['role'],
      staffCode: user.staffCode,
      branchId: user.branchId ?? null,
      avatar: user.avatar ?? null,
      authorizedBranches: mappedAuthorizedBranches,
      permissions: combinedPermissions,
      googleLinked: Boolean((user as any).googleId),
      googleEmail: (user as any).googleEmail ?? null,
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
      where: {
        token: {
          in: [token, this.hashRefreshToken(token)],
        },
        expiresAt: { gte: new Date() },
      },
      include: { 
        user: {
          include: {
            role: true,
            branch: { select: { id: true, name: true, address: true, isActive: true } },
            authorizedBranches: { select: { id: true, name: true, address: true, isActive: true } },
          }
        } 
      },
    })

    if (!stored) {
      throw new UnauthorizedException('Refresh token đã hết hạn hoặc không tồn tại')
    }

    // Rotate — delete old, issue new (deleteMany avoids P2025 on race condition)
    await this.db.refreshToken.deleteMany({ where: { id: stored.id } })

    const u = stored.user
    const combinedRole = u.role?.code ?? ''
    const combinedPermissions = this.resolveRolePermissions(combinedRole, (u.role as any)?.permissions)
    let mappedAuthorizedBranches = this.mapAuthorizedBranches(u as any)

    if (combinedPermissions.includes('FULL_BRANCH_ACCESS') || combinedRole === 'SUPER_ADMIN' || combinedRole === 'ADMIN') {
      const allBranches = await this.db.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true, address: true, isActive: true },
      })
      mappedAuthorizedBranches = allBranches as any[]
    }

    const newPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: payload.userId,
      role: combinedRole,
      permissions: this.getJwtPermissions((u.role as any)?.permissions),
      branchId: u.branchId ?? null,
      authorizedBranchIds: mappedAuthorizedBranches.map((branch) => branch.id),
    }
    const newAccess = this.jwt.sign(newPayload as Record<string, any>)
    const newRefresh = this.jwt.sign(newPayload as Record<string, any>, {
      secret: this.getRefreshSecret(),
      expiresIn: (process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d') as any,
    })

    await this.db.refreshToken.create({
      data: {
        userId: payload.userId,
        token: this.hashRefreshToken(newRefresh),
        expiresAt: this.getRefreshTokenExpiry(newRefresh),
      },
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
      authorizedBranches: mappedAuthorizedBranches,
      googleLinked: Boolean((u as any).googleId),
      googleEmail: (u as any).googleEmail ?? null,
    }

    return { accessToken: newAccess, refreshToken: newRefresh, user: authUser }
  }

  async logout(userId: string, token?: string | null): Promise<void> {
    if (!token) {
      await this.db.refreshToken.deleteMany({
        where: { userId },
      })
      return
    }

    await this.db.refreshToken.deleteMany({
      where: {
        userId,
        token: {
          in: [token, this.hashRefreshToken(token)],
        },
      },
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
        googleId: true,
        googleEmail: true,
        branch: { select: { id: true, name: true, address: true, isActive: true } },
        authorizedBranches: { select: { id: true, name: true, address: true, isActive: true } }
      },
    })

    if (!user) throw new NotFoundException('Không tìm thấy người dùng')

    const combinedRole = (user as any).role?.code ?? ''
    const combinedPermissions = this.resolveRolePermissions(combinedRole, (user as any).role?.permissions)

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: combinedRole,
      permissions: combinedPermissions,
      staffCode: user.staffCode,
      branchId: user.branchId ?? null,
      avatar: user.avatar ?? null,
      googleLinked: Boolean((user as any).googleId),
      googleEmail: (user as any).googleEmail ?? null,
      authorizedBranches: Array.from(
        new Map(
          [...((user as any).branch ? [(user as any).branch] : []), ...((user as any).authorizedBranches || [])].map(b => [b.id, b])
        ).values()
      ).filter(b => b.isActive)
    }
  }
}
