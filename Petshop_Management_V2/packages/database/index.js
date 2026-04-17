/**
 * Runtime shim for @petshop/database
 * Re-exports everything from @prisma/client so that Node.js ESM/CJS
 * can resolve enums and types at runtime without needing tsx/ts-node.
 */
"use strict";
const prismaClient = require("@prisma/client");

// Re-export all Prisma Client exports (PrismaClient, all enums, types)
Object.keys(prismaClient).forEach((key) => {
    if (key !== "default") {
        exports[key] = prismaClient[key];
    }
});

// Also export the singleton prisma instance
const { PrismaClient } = prismaClient;

const globalForPrisma = globalThis;

const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log:
            process.env["NODE_ENV"] === "development"
                ? ["query", "error", "warn"]
                : ["error"],
    });

if (process.env["NODE_ENV"] !== "production") {
    globalForPrisma.prisma = prisma;
}

exports.prisma = prisma;
