"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const env_schema_js_1 = require("./env.schema.js");
const env = (0, env_schema_js_1.validateEnv)();
exports.config = {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
    database: {
        url: env.DATABASE_URL,
    },
    jwt: {
        secret: env.JWT_SECRET,
        refreshSecret: env.JWT_REFRESH_SECRET,
        expiresIn: env.JWT_EXPIRES_IN,
        refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    server: {
        apiPort: env.API_PORT,
        workerPort: env.WORKER_PORT,
        webPort: env.WEB_PORT,
        corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    },
    redis: {
        url: env.REDIS_URL ?? 'redis://localhost:6379',
    },
    upload: {
        dir: env.UPLOAD_DIR,
        maxFileSize: env.MAX_FILE_SIZE,
    },
};
//# sourceMappingURL=app.config.js.map