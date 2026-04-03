export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code?: string | undefined;
    constructor(message: string, statusCode?: number, code?: string | undefined);
}
export declare class NotFoundError extends AppError {
    constructor(resource: string, id?: string);
}
export declare class ValidationError extends AppError {
    readonly field?: string | undefined;
    constructor(message: string, field?: string | undefined);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string);
}
export declare class BusinessRuleError extends AppError {
    constructor(message: string);
}
//# sourceMappingURL=index.d.ts.map