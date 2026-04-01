---
name: trpc
description: Best practices for implementing end-to-end typesafe APIs with tRPC in TypeScript. Use this skill when setting up backend API Gateways or direct client-to-server communications without GraphQL, especially when integrated with DDD or Moleculer.
---

# tRPC Integration Skill

tRPC (TypeScript RPC) enables type-safe APIs without a build step or explicit schema declarations, providing excellent Developer Experience (DX) for modern Web Apps (Next.js, Expo).

When writing tRPC code, or building an API layer using tRPC, follow these rules strictly:

## 1. Directory Structure (DDD Slicing)
Do not build massive monolithic routers. Break down the logic into **Routers based on Domain Context**.
- Place tRPC routers inside their respective feature module folder (e.g., `src/modules/users/user.router.ts`).
- **Root Router:** Create a single `appRouter.ts` at the root that merely aggregates all feature routers.
  ```typescript
  export const appRouter = router({
    users: userRouter,
    orders: orderRouter
  });
  ```

## 2. Input/Output Validation (Zod Context)
Always use Schema Validation library `zod`.
- Use `.input(zodSchema)` aggressively for validation.
- Separate `zod` schemas into a `dto` folder or alongside the feature if they are large domain schemas.

## 3. Middleware & Context Binding (Auth)
- **Context Generation:** The context should be the single source of truth for Request, Response, and Session logic. Inject services like Appwrite SDK connection, Database connectors (Prisma), or JWT decoders into the context object.
- **Procedures:** 
  - `publicProcedure`: No session checks.
  - `protectedProcedure`: Uses a middleware `isAuthed` that verifies the session (e.g., throwing a `TRPCError({ code: 'UNAUTHORIZED' })` if the token from Context is invalid).

## 4. Integration with Microservices (Moleculer Bridge)
When operating in a Microservice Architecture (e.g., using **Moleculer**):
- Understand that tRPC serves as the **API Gateway** attached to an Entry Web Server (like Fastify or Express).
- The `tRPC` procedure handler acts only as an orchestrator. It should call the Moleculer Service broker directly to fetch or mutate data logic:
  ```typescript
  const userRouter = router({
    getUser: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        // Use Moleculer service broker mapped in context
        return await ctx.broker.call("users.get", { id: input.id });
      })
  });
  ```

## 5. Error Handling Policies
tRPC uses standard HTTP error mappings via `TRPCError`.
- `BAD_REQUEST` for logic rules violation (Validation schemas natively throw this).
- `UNAUTHORIZED` for lack of context users.
- `FORBIDDEN` for proper permission/ACL denials.
- Map internal Domain Errors (from your DDD patterns) to the `TRPCError` type cleanly before propagating it to the client.
