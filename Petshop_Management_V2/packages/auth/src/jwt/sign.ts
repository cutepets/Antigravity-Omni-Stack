import jwt from 'jsonwebtoken'
import type { JwtPayload } from '@petshop/shared'

export const signAccessToken = (
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: string = '15m',
): string => {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions)
}

export const signRefreshToken = (
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: string = '7d',
): string => {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions)
}
