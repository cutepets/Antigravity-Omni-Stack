import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { google } from 'googleapis'
import { DatabaseService } from '../../database/database.service.js'
import { decryptSecret } from '../../common/utils/secret-box.util.js'
import { AuthService } from './auth.service.js'

type GoogleAuthRuntimeConfig = {
  enabled: boolean
  clientId: string
  clientSecret: string
  allowedDomain: string | null
  redirectUri: string
}

export type GoogleAuthPublicConfig = {
  enabled: boolean
  configured: boolean
  allowedDomain: string | null
  apiBaseUrl: string
  webAppBaseUrl: string
  callbackUrl: string
}

type ResolvedGoogleUser = {
  googleId: string
  email: string
  avatar: string | null
}

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly authService: AuthService,
  ) {}

  private getApiBaseUrl() {
    const configured =
      process.env['PUBLIC_API_URL'] ??
      process.env['API_PUBLIC_URL'] ??
      process.env['NEXT_PUBLIC_API_URL']

    if (configured) {
      return configured.replace(/\/+$/, '')
    }

    return `http://localhost:${process.env['API_PORT'] ?? '3001'}`
  }

  getWebAppBaseUrl() {
    const configured =
      process.env['PUBLIC_WEB_URL'] ??
      process.env['WEB_APP_URL'] ??
      process.env['NEXT_PUBLIC_APP_URL']

    if (configured) {
      return configured.replace(/\/+$/, '')
    }

    const corsOrigin = (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000')
      .split(',')[0]
      ?.trim()

    return corsOrigin || 'http://localhost:3000'
  }

  private async getRuntimeConfig(): Promise<GoogleAuthRuntimeConfig> {
    const config = await this.db.systemConfig.findFirst({
      select: {
        googleAuthEnabled: true,
        googleAuthClientId: true,
        googleAuthClientSecretEnc: true,
        googleAuthAllowedDomain: true,
      },
    })

    const clientId =
      config?.googleAuthClientId?.trim() ||
      process.env['GOOGLE_AUTH_CLIENT_ID'] ||
      ''
    const clientSecret =
      decryptSecret(config?.googleAuthClientSecretEnc) ||
      process.env['GOOGLE_AUTH_CLIENT_SECRET'] ||
      ''
    const enabled =
      config?.googleAuthEnabled ??
      (process.env['GOOGLE_AUTH_ENABLED'] ?? '').trim().toLowerCase() === 'true'

    const allowedDomain =
      config?.googleAuthAllowedDomain?.trim() ||
      process.env['GOOGLE_AUTH_ALLOWED_DOMAIN'] ||
      null

    if (!enabled || !clientId || !clientSecret) {
      throw new BadRequestException('Dang nhap Google chua duoc cau hinh')
    }

    return {
      enabled,
      clientId,
      clientSecret,
      allowedDomain,
      redirectUri: `${this.getApiBaseUrl()}/api/auth/google/callback`,
    }
  }

  private async createOAuthClient() {
    const config = await this.getRuntimeConfig()
    return {
      client: new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri,
      ),
      config,
    }
  }

  async getPublicConfig(): Promise<GoogleAuthPublicConfig> {
    const systemConfig = await this.db.systemConfig.findFirst({
      select: {
        googleAuthEnabled: true,
        googleAuthClientId: true,
        googleAuthClientSecretEnc: true,
        googleAuthAllowedDomain: true,
      },
    })

    const enabled =
      systemConfig?.googleAuthEnabled ??
      (process.env['GOOGLE_AUTH_ENABLED'] ?? '').trim().toLowerCase() === 'true'
    const clientId =
      systemConfig?.googleAuthClientId?.trim() ||
      process.env['GOOGLE_AUTH_CLIENT_ID'] ||
      ''
    const clientSecretConfigured = Boolean(
      decryptSecret(systemConfig?.googleAuthClientSecretEnc) ||
      process.env['GOOGLE_AUTH_CLIENT_SECRET'],
    )

    return {
      enabled,
      configured: enabled && Boolean(clientId) && clientSecretConfigured,
      allowedDomain:
        systemConfig?.googleAuthAllowedDomain?.trim() ||
        process.env['GOOGLE_AUTH_ALLOWED_DOMAIN'] ||
        null,
      apiBaseUrl: this.getApiBaseUrl(),
      webAppBaseUrl: this.getWebAppBaseUrl(),
      callbackUrl: `${this.getApiBaseUrl()}/api/auth/google/callback`,
    }
  }

  async createAuthorizationUrl(state: string) {
    const { client } = await this.createOAuthClient()
    return client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account',
      state,
    })
  }

  private async resolveGoogleUserFromCode(code: string): Promise<ResolvedGoogleUser> {
    const { client, config } = await this.createOAuthClient()
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)

    const oauth2 = google.oauth2({
      version: 'v2',
      auth: client,
    })
    const profileResponse = await oauth2.userinfo.get()
    const profile = profileResponse.data

    const googleId = String(profile.id ?? '').trim()
    const email = String(profile.email ?? '').trim().toLowerCase()
    const emailVerified = Boolean(profile.verified_email)

    if (!googleId || !email || !emailVerified) {
      throw new UnauthorizedException('Tai khoan Google khong hop le de dang nhap')
    }

    if (config.allowedDomain) {
      const domain = email.split('@')[1] ?? ''
      if (domain.toLowerCase() !== config.allowedDomain.toLowerCase()) {
        throw new UnauthorizedException('Tai khoan Google khong thuoc domain duoc phep')
      }
    }

    return {
      googleId,
      email,
      avatar: String(profile.picture ?? '').trim() || null,
    }
  }

  async loginWithAuthorizationCode(code: string) {
    const profile = await this.resolveGoogleUserFromCode(code)

    const user = await this.db.user.findFirst({
      where: { googleId: profile.googleId },
      select: { id: true },
    })

    if (!user) {
      throw new UnauthorizedException('Tai khoan Google chua duoc lien ket voi nguoi dung nay')
    }

    await this.db.user.update({
      where: { id: user.id },
      data: {
        googleEmail: profile.email,
        googleAvatar: profile.avatar,
      },
    })

    return this.authService.createSessionForUserId(user.id)
  }

  async linkUserWithAuthorizationCode(userId: string, code: string) {
    const profile = await this.resolveGoogleUserFromCode(code)
    const existingUser = await this.db.user.findFirst({
      where: {
        googleId: profile.googleId,
        NOT: {
          id: userId,
        },
      },
      select: {
        id: true,
      },
    })

    if (existingUser) {
      throw new UnauthorizedException('Tai khoan Google da duoc lien ket voi nguoi dung khac')
    }

    return this.db.user.update({
      where: { id: userId },
      data: {
        googleId: profile.googleId,
        googleEmail: profile.email,
        googleAvatar: profile.avatar,
      },
      select: {
        id: true,
        googleId: true,
        googleEmail: true,
        googleAvatar: true,
      },
    })
  }
}
