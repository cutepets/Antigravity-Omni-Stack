---
name: appwrite
description: Best practices and architecture guidelines for integrating Appwrite Backend-as-a-Service using Web Client SDK and Node.js Server SDK. Use this skill when building web apps that rely on Appwrite for Auth, Databases, Storage, or Cloud Functions.
---

# Appwrite Integration Skill

Appwrite is a powerful Backend-as-a-Service (BaaS) that provides Authentication, Databases, Storage, and Cloud Functions. Appwrite significantly accelerates backend development for Web Apps.

When writing or guiding code interacting with Appwrite, ALWAYS follow these structural patterns:

## 1. Client SDK vs Server SDK Boundaries
- **Client SDK (Frontend/Browser/Mobile):** 
  - Uses project `ENDPOINT` and `PROJECT_ID`.
  - Driven by User session (JWT or Session Cookie).
  - **Never** expose an API Key here.
  - Operations are securely restricted by Document-level Permissions.

- **Server SDK (Backend/NestJS/Cloud Functions):**
  - Uses project `ENDPOINT`, `PROJECT_ID`, and a secret `API_KEY`.
  - Capable of overriding client permissions to enforce business logic on the database backend.
  - **Never** expose the `API_KEY` to the client. Should only be initialized via `.env`.

## 2. Authentication & Authorization Patterns
- Avoid building custom Authentication systems; map external Webapp Users tightly to Appwrite's `Account` Service (`appwrite.account`).
- **Permissions/Roles Strategy:**
  - Secure the Appwrite Database by strictly configuring default Document Permissions.
  - Example: A traditional User-Specific record should only allow `read("user:[USER_ID]")` and `update("user:[USER_ID]")`.
  - Ensure sensitive administrative data denies all roles by default, handling reads exclusively via the secure Server SDK APIs.

## 3. Database & Schema Design
Appwrite's database is NoSQL-like but strictly schema-enforced.
- Use `appwrite.databases.createDocument()` and similar actions.
- Treat `Databases` as the microservice boundary or Domain Boundary in a DDD Hexagon architecture (e.g. `ecommerce`, `crm`).
- Treat `Collections` as Entities/Aggregates.
- **Rules:** 
  - Do NOT hardcode Database IDs or Collection IDs. Always resolve them via Environment Variables (e.g., `process.env.APPWRITE_DATABASE_ID`).

## 4. Appwrite Cloud Functions (Node.js Environment)
When authoring Cloud Functions hosted on Appwrite:
- Use the standard entry point structure: `export default async ({ req, res, log, error }) => { ... }`.
- Utilize the passed-in Environment variables via `process.env` (e.g., `process.env.APPWRITE_API_KEY`).
- Initialize the Server SDK dynamically inside the function, executing logic, and returning proper standard JSON payload `return res.json({ statusCode: 200, data: result })`.
- Remember that Appwrite Functions are stateless and execute efficiently; keep them clean and decoupled from persistent long-running logic.

## 5. Storage
- Secure private files by specifying Bucket permissions. Use Appwrite's built-in file preview tools (`appwrite.storage.getFilePreview()`) instead of manually serving objects when creating frontend views.

**Agent Execution Notice:**
When the user asks you to implement a database query or an authentication flow using Appwrite, prefer writing clean wrapper classes (Services or Repositories if using Hexagon structure) around `appwrite.databases` and `appwrite.account` to maintain standard Dependency Injection principles.
