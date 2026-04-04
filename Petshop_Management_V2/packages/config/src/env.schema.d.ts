import { z } from 'zod';
export declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    DATABASE_URL: z.ZodString;
    JWT_SECRET: z.ZodString;
    JWT_REFRESH_SECRET: z.ZodString;
    JWT_EXPIRES_IN: z.ZodDefault<z.ZodString>;
    JWT_REFRESH_EXPIRES_IN: z.ZodDefault<z.ZodString>;
    API_PORT: z.ZodDefault<z.ZodNumber>;
    WORKER_PORT: z.ZodDefault<z.ZodNumber>;
    WEB_PORT: z.ZodDefault<z.ZodNumber>;
    REDIS_URL: z.ZodOptional<z.ZodString>;
    CORS_ORIGINS: z.ZodDefault<z.ZodString>;
    UPLOAD_DIR: z.ZodDefault<z.ZodString>;
    MAX_FILE_SIZE: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "production" | "test";
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_REFRESH_EXPIRES_IN: string;
    API_PORT: number;
    WORKER_PORT: number;
    WEB_PORT: number;
    CORS_ORIGINS: string;
    UPLOAD_DIR: string;
    MAX_FILE_SIZE: number;
    REDIS_URL?: string | undefined;
}, {
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_REFRESH_SECRET: string;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    JWT_EXPIRES_IN?: string | undefined;
    JWT_REFRESH_EXPIRES_IN?: string | undefined;
    API_PORT?: number | undefined;
    WORKER_PORT?: number | undefined;
    WEB_PORT?: number | undefined;
    REDIS_URL?: string | undefined;
    CORS_ORIGINS?: string | undefined;
    UPLOAD_DIR?: string | undefined;
    MAX_FILE_SIZE?: number | undefined;
}>;
export type Env = z.infer<typeof envSchema>;
export declare function validateEnv(raw?: NodeJS.ProcessEnv): Env;
//# sourceMappingURL=env.schema.d.ts.map