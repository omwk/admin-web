# FE-1 Implementation Plan

> **For agentic workers:** Execute the four tasks inline, in order, with verification at each checkpoint. The task's explicit four-step workflow takes precedence over optional delegation and handoff workflows.

**Goal:** Connect the Vben admin application to the existing identity API and render the authorized, read-only user list.

**Architecture:** Keep all adaptation in `apps/admin`. A configurable request client unwraps the backend envelope and delegates authentication recovery to an application-owned single-flight refresh coordinator. Backend menus and permissions drive routes and buttons through an explicit component registry.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vben RequestClient, Ant Design Vue, dayjs, Vitest.

**Spec:** `docs/tasks/FE-1.md`; backend `D:/code/go-admin-api/api/openapi/identity.yaml` and `docs/api/integration.md`.

## Global Constraints

- Do not modify `packages/` or backend code.
- Never show backend `message`; map business codes and HTTP statuses to local Chinese text.
- Keep the i18n infrastructure; force Chinese for this first release.
- Access token stays in memory; refresh token stays in sessionStorage.
- Record backend contract gaps and unavailable integration prerequisites in the final report.
- Do not start FE-2, add user writes, or invent endpoints.

## Task 1: Request layer

**Files:** `.env.development`, `.env.production`, `vite.config.ts`, `src/api/request.ts`, new `src/api/client.ts`, `src/api/errors.ts`, `src/api/model/response.ts`, `src/api/__tests__/client.test.ts`, application Vitest config.

**Interfaces:** `createApiClient(baseURL, authentication, notify)` returns a Vben RequestClient. Authentication exposes `getAccessToken`, `refreshAccessToken`, and `onSessionExpired`. `ApiError` retains numeric code, HTTP status and trace ID with a locally mapped message.

- [x] Disable Nitro mock; proxy `/api` unchanged to `http://127.0.0.1:8080`; use `/api/v1` at the client boundary.
- [x] Unwrap successful envelopes (including a separate HTTP 204 case), reject business and HTTP failures, inject Bearer, and replay at most once after authentication recovery.
- [x] Verify real client interceptors with a transport adapter: envelope, HTTP 200 business failures, 401 recovery, revoked sessions, 403/409/429 messages, and no backend text leakage.
- [x] Run the application typecheck before Task 2.

## Task 2: Authentication

**Files:** `src/api/model/identity.ts`, `src/api/core/auth.ts`, `src/api/core/user.ts`, `src/auth/token.ts`, `src/auth/refresh.ts`, `src/auth/persistence.ts`, `src/store/auth.ts`, `src/bootstrap.ts`, `src/router/guard.ts`, login view and preferences.

**Interfaces:** `TokenPair` uses `access_token/refresh_token/token_type/expires_in`. `setTokens/clearTokens/getAccessToken/getRefreshToken` own credential storage. `refreshAccessToken()` shares a promise and retries 20109 with bounded backoff. `/auth/me` adapts `Overview.user` to Vben's `UserInfo` without a token field value.

- [x] Implement token storage, keep framework credential fields null, and purge hydrated legacy credentials before installing the router.
- [x] Wire login, body-based refresh, authenticated logout, and `/auth/me`; remove `/auth/codes` and cookie assumptions.
- [x] Restore a page session through refresh before protected navigation. Clear stores, routes and credentials on revocation; prevent late refresh from resurrecting logout.
- [x] Remove mock account defaults and unsupported login options; keep translations and force Chinese.
- [x] Verify five simultaneous expired-access requests produce one refresh and five successful replays; verify 20109 silence, rotation, terminal failure, reload and logout races; run typecheck.

## Task 3: Menus and permissions

**Files:** `src/api/core/menu.ts`, `src/router/menu-adapter.ts`, `src/router/component-registry.ts`, `src/router/access.ts`, `src/router/guard.ts`, `src/auth/permission.ts`, placeholder view and application route configuration.

**Interfaces:** `getAllMenusApi()` requests `/auth/menus`, saves `permissions`, and returns `RouteRecordStringComponent[]`. `hasPermission(code)` reads only those permission codes. Registry keys match backend seeds (`system/user/index`, etc.); unknown keys resolve to the existing 404 component.

- [x] Convert menu types, hierarchy, sorting, names, keep-alive, metadata and safe external links; exclude buttons.
- [x] Generate backend routes with the explicit registry and select the first available internal home route; clear previous routes on identity changes.
- [x] Register known unfinished seed pages as placeholders; unknown components remain 404.
- [x] Verify conversion, revoked-menu replacement, permission changes, registry and actual Vue Router navigation; run typecheck.

## Task 4: Read-only users and acceptance

**Files:** `src/api/core/admin-users.ts`, `src/api/model/admin-user.ts`, `src/views/system/user/index.vue`, `src/utils/datetime.ts`, tests and `docs/FE-1-report.md` under this application.

**Interfaces:** `getUsersApi({page,page_size,keyword,status})` calls `/admin/users` and returns `Page<AdminUser>`. Clamp page size to 100; filter changes reset page to 1. `formatDateTime` parses RFC3339 UTC with dayjs and converts to local time.

- [x] Render Ant Design table, keyword/status filters, pagination, loading, empty and retryable failure states; guard stale responses.
- [x] Hide the demonstration button without `system:user:create`; show only a local explanation when clicked.
- [x] Verify real request parameters, size clamp, filter/page transitions, permission hiding and UTC conversion.
- [x] Run all application tests, typecheck, lint and `pnpm build:antd`; inspect the built UI if possible.
- [x] Report all ten task-card assertions separately, distinguish automated transport fixtures from live backend evidence, and record missing prerequisites and contract gaps.

## Known integration gaps before implementation

- `127.0.0.1:8080` is not listening; no working test account has been supplied.
- Backend OpenAPI and implementation currently omit `keyword` and `status` filtering for users; the frontend will send the task-card parameters without fabricating filtering results.
- Revocation is described as 20101 in integration notes and 20103 in OpenAPI; support both, refresh 20102 natural expiry.
- 20109 is documented as both HTTP 401 and 409; key retries on its business code.
- Reusing a rotated refresh token returns 20109 for 30 seconds, then revokes the session; retries must be bounded and cannot recover another tab's token in FE-1.
- Root `package.json` defines `check:type`, but no `typecheck` alias. Use application `pnpm typecheck` and the existing root `pnpm check:type` without changing the root or framework.
