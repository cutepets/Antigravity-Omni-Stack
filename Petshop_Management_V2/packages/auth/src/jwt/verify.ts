import jwt from 'jsonwebtoken'
import type { JwtPayload } from '@petshop/shared'

export const verifyToken = (token: string, secret: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, secret)
    return decoded as JwtPayload
  } catch {
    return null
  }
}

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload
  } catch {
    return null
  }
}
