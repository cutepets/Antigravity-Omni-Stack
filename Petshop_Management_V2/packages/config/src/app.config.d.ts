export declare const config: {
    readonly env: "development" | "production" | "test";
    readonly isProduction: boolean;
    readonly isDevelopment: boolean;
    readonly isTest: boolean;
    readonly database: {
        readonly url: string;
    };
    readonly jwt: {
        readonly secret: string;
        readonly refreshSecret: string;
        readonly expiresIn: string;
        readonly refreshExpiresIn: string;
    };
    readonly server: {
        readonly apiPort: number;
        readonly workerPort: number;
        readonly webPort: number;
        readonly corsOrigins: string[];
    };
    readonly redis: {
        readonly url: string;
    };
    readonly upload: {
        readonly dir: string;
        readonly maxFileSize: number;
    };
};
export type Config = typeof config;
//# sourceMappingURL=app.config.d.ts.map