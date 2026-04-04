import type { JwtPayload } from '@petshop/shared';
export declare const verifyToken: (token: string, secret: string) => JwtPayload | null;
export declare const decodeToken: (token: string) => JwtPayload | null;
//# sourceMappingURL=verify.d.ts.map