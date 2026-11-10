# Backend User Filters Implementation Plan

> **For agentic workers:** Execute these steps in the current authorized workspace, using verification-before-completion before reporting results.

**Goal:** Enable real keyword/status filtering against the backend at `http://127.0.0.1:18080` and verify the complete live acceptance flow.

**Architecture:** Keep the existing real request client and remove the temporary filter gate from `getUsersApi`. Normalize query values and send them directly. The browser test observes actual requests/responses and asserts the rendered results without HTTP interception.

**Tech Stack:** Vue 3, TypeScript, Ant Design Vue, Vite, Vitest, Playwright.

**Spec:** The current task requires admin login (3 top-level menus, 103 permissions), 3 users, keyword sales returning 2 users and sales01 returning 1, disabled status filtering, reload persistence, sales01 empty menus without errors, single-flight refresh, and no runtime service simulation dependencies.

## Constraints

- Keep `VITE_NITRO_MOCK=false` and the `/api` proxy target at `http://127.0.0.1:18080`.
- Use real login/read/refresh/logout requests; do not change backend seed users or grants.
- Passwords come from environment variables and must not appear in evidence.
- Current seed users are all active, so disabled filtering must yield total=0 and an empty table.

## Task 1: Enable filters

**Files:** `apps/admin/src/api/core/admin-users.ts`, `apps/admin/src/api/__tests__/admin-users.test.ts`, `apps/admin/src/views/system/user/index.vue`.

**Interface:** Preserve `getUsersApi(query: UserListQuery, config?: ApiRequestConfig)` and send `params: normalizeUserQuery(query)`.

- [x] Expect `{ keyword: 'alice', page: 2, page_size: 100, status: 'active' }` in the API test and confirm failure with the current gate.
- [x] Remove `USER_FILTERS_ENABLED` and send the normalized query directly; restore the active filtering description.
- [x] Run the API test and the complete admin unit suite.

## Task 2: Live browser acceptance

**Files:** `apps/admin/e2e/fe1.mjs`, `apps/admin/docs/evidence/*`.

- [x] Assert backend admin menu permissionCount=103 and render all 3 top-level sidebar menus.
- [x] Exercise keyword=sales (2 rows), keyword=sales01 (1 row), status=disabled (0 rows), and both filters together. Assert exact request query values and real response statuses, totals, usernames, and rendered table rows.
- [x] Reset filters and assert both parameters are absent and 3 rows return.
- [x] Retain real reload, empty sales01 menu, and concurrent refresh checks; save sanitized JSON and search/status screenshots.

## Task 3: Verification and documentation

**Files:** `README.md`, `apps/admin/docs/FE-1-report.md`, this plan.

- [x] Run admin typecheck, ESLint on changed code, production build, and the live browser suite.
- [x] Search runtime/E2E/build code for service simulation dependencies and verify `git diff --check`.
- [x] Replace temporary filter-gate instructions and stale acceptance results with actual enabled-filter results, explicitly noting the all-active seed data.
