import type { JwtPayload } from '@petshop/shared';
export declare const signAccessToken: (payload: Omit<JwtPayload, "iat" | "exp">, secret: string, expiresIn?: string) => string;
export declare const signRefreshToken: (payload: Omit<JwtPayload, "iat" | "exp">, secret: string, expiresIn?: string) => string;
//# sourceMappingURL=sign.d.ts.map