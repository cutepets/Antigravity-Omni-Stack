import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger'
import type { CookieOptions, Request, Response } from 'express'
import type { JwtPayload, LoginResponse } from '@petshop/shared'
import { AuthService } from './auth.service.js'
import { JwtGuard } from './guards/jwt.guard.js'
import { LoginDto } from './dto/login.dto.js'
import { RefreshTokenDto } from './dto/refresh.dto.js'

interface AuthenticatedRequest extends Request {
  user: JwtPayload
}

const AUTH_SESSION_COOKIE = 'petshop_auth'

function getCookieValue(req: Request, name: string): string | null {
  const rawCookie = req.headers.cookie
  if (!rawCookie) return null

  const cookie = rawCookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null
}

function parseDurationToMs(value: string, fallbackMs: number): number {
  const match = value.trim().match(/^(\d+)(ms|s|m|h|d)$/i)
  if (!match) return fallbackMs

  const amount = Number(match[1] ?? fallbackMs)
  const unit = (match[2] ?? 'ms').toLowerCase()
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  }

  return amount * (multipliers[unit] ?? 1)
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getCookieOptions(maxAge: number, httpOnly: boolean): CookieOptions {
    return {
      httpOnly,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
      maxAge,
    }
  }

  private setAuthCookies(res: Response, auth: LoginResponse) {
    const accessMaxAge = parseDurationToMs(process.env['JWT_EXPIRES_IN'] ?? '15m', 15 * 60_000)
    const refreshMaxAge = parseDurationToMs(process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d', 7 * 86_400_000)

    res.cookie('access_token', auth.accessToken, this.getCookieOptions(accessMaxAge, true))
    res.cookie('refresh_token', auth.refreshToken, this.getCookieOptions(refreshMaxAge, true))
    res.cookie(AUTH_SESSION_COOKIE, '1', this.getCookieOptions(refreshMaxAge, false))
  }

  private clearAuthCookies(res: Response) {
    const options = {
      sameSite: 'lax' as const,
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
    }

    res.clearCookie('access_token', options)
    res.clearCookie('refresh_token', options)
    res.clearCookie(AUTH_SESSION_COOKIE, options)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dang nhap he thong' })
  @ApiResponse({ status: 200, description: 'Dang nhap thanh cong' })
  @ApiResponse({ status: 401, description: 'Sai tai khoan hoac mat khau' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const auth = await this.authService.login(dto)
    this.setAuthCookies(res, auth)
    return auth
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lam moi access token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto.refreshToken ?? getCookieValue(req, 'refresh_token')
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token khong hop le')
    }

    const auth = await this.authService.refreshTokens(refreshToken)
    this.setAuthCookies(res, auth)
    return auth
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dang xuat' })
  async logout(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.user.userId, dto.refreshToken ?? getCookieValue(req, 'refresh_token'))
    this.clearAuthCookies(res)
    return { success: true }
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lay thong tin nguoi dung hien tai' })
  getMe(@Req() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user.userId)
  }
}
