"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
exports.validateEnv = validateEnv;
const zod_1 = require("zod");
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: zod_1.z.string().url(),
    JWT_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('7d'),
    API_PORT: zod_1.z.coerce.number().default(3001),
    WORKER_PORT: zod_1.z.coerce.number().default(3002),
    WEB_PORT: zod_1.z.coerce.number().default(3000),
    REDIS_URL: zod_1.z.string().optional(),
    CORS_ORIGINS: zod_1.z.string().default('http://localhost:3000'),
    UPLOAD_DIR: zod_1.z.string().default('./uploads'),
    MAX_FILE_SIZE: zod_1.z.coerce.number().default(52428800), // 50MB
});
function validateEnv(raw = process.env) {
    const result = exports.envSchema.safeParse(raw);
    if (!result.success) {
        const issues = result.error.issues
            .map((i) => `  ${i.path.join('.')}: ${i.message}`)
            .join('\n');
        throw new Error(`❌ Invalid environment variables:\n${issues}`);
    }
    return result.data;
}
//# sourceMappingURL=env.schema.js.map