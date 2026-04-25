import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { randomUUID } from 'crypto'
import type { CookieOptions, Request, Response } from 'express'
import type { JwtPayload, LoginResponse } from '@petshop/shared'
import { AuthService } from './auth.service.js'
import { RefreshTokenDto } from './dto/refresh.dto.js'
import { LoginDto } from './dto/login.dto.js'
import { JwtGuard } from './guards/jwt.guard.js'
import { GoogleAuthService } from './google-auth.service.js'

interface AuthenticatedRequest extends Request {
  user: JwtPayload
}

const AUTH_SESSION_COOKIE = 'petshop_auth'
const GOOGLE_AUTH_STATE_COOKIE = 'petshop_google_state'

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

type GoogleStatePayload = {
  nonce: string
  redirect: string
}

type GoogleCodeBody = {
  code?: string
  redirect?: string
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
  ) { }

  private getCookieOptions(maxAge: number, httpOnly: boolean): CookieOptions {
    return {
      httpOnly,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
      maxAge,
    }
  }

  private getClearCookieOptions() {
    return {
      sameSite: 'lax' as const,
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
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
    const options = this.getClearCookieOptions()
    res.clearCookie('access_token', options)
    res.clearCookie('refresh_token', options)
    res.clearCookie(AUTH_SESSION_COOKIE, options)
  }

  private sanitizeRedirectPath(redirect: string | undefined) {
    const normalized = String(redirect ?? '/dashboard').trim()
    if (!normalized.startsWith('/') || normalized.startsWith('//')) {
      return '/dashboard'
    }
    return normalized
  }

  private encodeGoogleState(payload: GoogleStatePayload) {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  }

  private decodeGoogleState(rawState: string | undefined): GoogleStatePayload {
    if (!rawState) {
      throw new UnauthorizedException('Google state khong hop le')
    }

    try {
      const parsed = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8')) as Partial<GoogleStatePayload>
      const nonce = String(parsed.nonce ?? '').trim()
      const redirect = this.sanitizeRedirectPath(parsed.redirect)

      if (!nonce) {
        throw new Error('missing nonce')
      }

      return {
        nonce,
        redirect,
      }
    } catch {
      throw new UnauthorizedException('Google state khong hop le')
    }
  }

  private buildGoogleFailureRedirect(message: string) {
    const baseUrl = this.googleAuthService.getWebAppBaseUrl()
    const query = new URLSearchParams({
      error: 'google_auth_failed',
      message,
    })

    return `${baseUrl}/login?${query.toString()}`
  }

  private buildGoogleLinkRedirect(redirect: string, status: 'success' | 'error', message?: string) {
    const target = new URL(redirect, this.googleAuthService.getWebAppBaseUrl())
    target.searchParams.set('google_link', status)

    if (message) {
      target.searchParams.set('message', message)
    } else {
      target.searchParams.delete('message')
    }

    return target.toString()
  }

  private validateGooglePopupRequest(req: Request) {
    const requestedWith = String(req.headers['x-requested-with'] ?? '').trim().toLowerCase()
    if (requestedWith !== 'xmlhttprequest') {
      throw new UnauthorizedException('Google popup request khong hop le')
    }

    const origin = String(req.headers.origin ?? '').trim()
    const allowedOrigin = new URL(this.googleAuthService.getWebAppBaseUrl()).origin
    if (!origin || origin !== allowedOrigin) {
      throw new UnauthorizedException('Google popup origin khong hop le')
    }
  }

  private getGoogleCode(body: GoogleCodeBody) {
    const code = String(body?.code ?? '').trim()
    if (!code) {
      throw new UnauthorizedException('Google login missing code')
    }
    return code
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dang nhap he thong' })
  @ApiResponse({ status: 200, description: 'Dang nhap thanh cong' })
  @ApiResponse({ status: 401, description: 'Sai tai khoan hoac mat khau' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const auth = await this.authService.login(dto)
    this.setAuthCookies(res, auth)
    return {
      success: true,
      user: auth.user,
    }
  }

  @Get('google/status')
  @ApiOperation({ summary: 'Lay trang thai cau hinh dang nhap Google' })
  async googleStatus() {
    const config = await this.googleAuthService.getPublicConfig()
    return {
      success: true,
      data: config,
    }
  }

  @Get('google')
  @ApiOperation({ summary: 'Bat dau dang nhap bang Google' })
  async googleLogin(
    @Query('redirect') redirect: string | undefined,
    @Res() res: Response,
  ) {
    const nonce = randomUUID()
    const state = this.encodeGoogleState({
      nonce,
      redirect: this.sanitizeRedirectPath(redirect),
    })
    res.cookie(GOOGLE_AUTH_STATE_COOKIE, nonce, this.getCookieOptions(10 * 60_000, true))

    const url = await this.googleAuthService.createAuthorizationUrl(state)
    return res.redirect(url)
  }

  @Get('google/link')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bat dau lien ket tai khoan Google cho user hien tai' })
  async googleLink(
    @Query('redirect') redirect: string | undefined,
    @Res() res: Response,
  ) {
    const nonce = randomUUID()
    const state = this.encodeGoogleState({
      nonce,
      redirect: this.sanitizeRedirectPath(redirect),
    })
    res.cookie(GOOGLE_AUTH_STATE_COOKIE, nonce, this.getCookieOptions(10 * 60_000, true))

    const url = await this.googleAuthService.createAuthorizationUrl(state, 'link')
    return res.redirect(url)
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google callback de tao session browser' })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const clearOptions = this.getClearCookieOptions()
    const statePayload = this.decodeGoogleState(state)
    const expectedNonce = getCookieValue(req, GOOGLE_AUTH_STATE_COOKIE)

    res.clearCookie(GOOGLE_AUTH_STATE_COOKIE, clearOptions)

    if (!expectedNonce || expectedNonce !== statePayload.nonce) {
      return res.redirect(this.buildGoogleFailureRedirect('Google state mismatch'))
    }

    if (!code) {
      return res.redirect(this.buildGoogleFailureRedirect('Google login missing code'))
    }

    try {
      const auth = await this.googleAuthService.loginWithAuthorizationCode(code)
      this.setAuthCookies(res, auth)
      return res.redirect(`${this.googleAuthService.getWebAppBaseUrl()}${statePayload.redirect}`)
    } catch (error: any) {
      this.clearAuthCookies(res)
      return res.redirect(
        this.buildGoogleFailureRedirect(
          error?.message ? String(error.message) : 'Google login failed',
        ),
      )
    }
  }

  @Get('google/link/callback')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Google callback de lien ket tai khoan hien tai' })
  async googleLinkCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const clearOptions = this.getClearCookieOptions()
    const statePayload = this.decodeGoogleState(state)
    const expectedNonce = getCookieValue(req, GOOGLE_AUTH_STATE_COOKIE)

    res.clearCookie(GOOGLE_AUTH_STATE_COOKIE, clearOptions)

    if (!expectedNonce || expectedNonce !== statePayload.nonce) {
      return res.redirect(this.buildGoogleLinkRedirect(statePayload.redirect, 'error', 'Google state mismatch'))
    }

    if (!code) {
      return res.redirect(this.buildGoogleLinkRedirect(statePayload.redirect, 'error', 'Google login missing code'))
    }

    try {
      await this.googleAuthService.linkUserWithAuthorizationCode(req.user.userId, code)
      const auth = await this.authService.createSessionForUserId(req.user.userId)
      this.setAuthCookies(res, auth)
      return res.redirect(this.buildGoogleLinkRedirect(statePayload.redirect, 'success'))
    } catch (error: any) {
      return res.redirect(
        this.buildGoogleLinkRedirect(
          statePayload.redirect,
          'error',
          error?.message ? String(error.message) : 'Google link failed',
        ),
      )
    }
  }

  @Post('google/code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dang nhap Google popup code flow' })
  async googleCodeLogin(
    @Body() body: GoogleCodeBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.validateGooglePopupRequest(req)
    const code = this.getGoogleCode(body)
    const auth = await this.googleAuthService.loginWithPopupAuthorizationCode(code)
    this.setAuthCookies(res, auth)
    return {
      success: true,
      user: auth.user,
      redirect: this.sanitizeRedirectPath(body.redirect),
    }
  }

  @Post('google/link/code')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lien ket Google popup code flow' })
  async googleCodeLink(
    @Body() body: GoogleCodeBody,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.validateGooglePopupRequest(req)
    const code = this.getGoogleCode(body)
    await this.googleAuthService.linkUserWithPopupAuthorizationCode(req.user.userId, code)
    const auth = await this.authService.createSessionForUserId(req.user.userId)
    this.setAuthCookies(res, auth)
    return {
      success: true,
      user: auth.user,
      redirect: this.sanitizeRedirectPath(body.redirect),
    }
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
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
    return {
      success: true,
      user: auth.user,
    }
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

  @Patch('preferences')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Luu cai dat POS ca nhan' })
  async updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    await this.authService.updatePosPreferences(req.user.userId, body)
    return { success: true }
  }

  @Patch('default-branch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Luu chi nhanh mac dinh POS' })
  async updateDefaultBranch(
    @Req() req: AuthenticatedRequest,
    @Body() body: { branchId: string | null },
  ) {
    await this.authService.updateDefaultBranch(req.user.userId, body.branchId ?? null)
    return { success: true }
  }
}
