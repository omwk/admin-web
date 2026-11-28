# FE-IDN-020 Client Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Enable editing a gateway client's name and IP whitelist with version checks, explicit allow-all confirmation, conflict refresh, and list reload after a successful save.

**Architecture:** Extend the existing gateway update request type and reuse the shared gateway error boundary. Keep form behavior in the existing client drawer, emit list refresh events to its parent, and test the API payload and drawer interactions with Vitest.

**Tech Stack:** Vue 3, TypeScript, Ant Design Vue, Vitest.

**Spec:** `docs/tasks/FE-IDN-020.md` and `docs/design/api-gateway-console.md`, following BE-IDN-034 at `836d6eb` plus the supplied `1b1602a` contract.

## Global Constraints

- Do not modify `packages/**`.
- Send the selected list row's `version` with every client update.
- Omitted update fields remain unchanged. Send `ip_whitelist: []` to clear the allowlist.
- Show the backend conflict as 「已被他人修改，请刷新」 and reload the client list.
- Confirm before clearing a non-empty allowlist, with the explicit consequence that all IPs will be allowed.
- Keep IP input as one IP or CIDR per line and leave validation of forbidden catch-all CIDRs to the backend.

---

### Task 1: Update API types and conflict mapping

**Files:**

- Modify `apps/admin/src/api/model/gateway.ts`
- Modify `apps/admin/src/api/__tests__/gateway.test.ts`
- Modify `apps/admin/src/views/open-platform/shared/gateway-error.ts`
- Modify `apps/admin/src/views/open-platform/shared/__tests__/gateway-error.test.ts`

**Interfaces:** `GatewayClientUpdate` accepts optional `name`, `ip_whitelist`, and `status`, and requires `version`. `isGatewayVersionConflict(error)` returns true for HTTP 409 or business code 10409.

- [x] Add a request test that PUT sends `{ name, ip_whitelist, status, version }`, including `ip_whitelist: []`.
- [x] Add error tests for HTTP 409 and backend business code 10409.
- [x] Run focused tests and confirm the new assertions fail against the original type/error mapping.
- [x] Make the model and helper changes so the focused tests pass.
- [x] Re-run the focused test files.

### Task 2: Enable client metadata editing and confirmation

**Files:**

- Modify `apps/admin/src/views/open-platform/clients/client-form-drawer.vue`
- Modify `apps/admin/src/views/open-platform/clients/index.vue`
- Create `apps/admin/src/views/open-platform/clients/__tests__/client-form-drawer.test.ts`

**Interfaces:** The drawer emits `saved` after a successful PUT, `created` after a successful POST, and `refresh` after an update conflict. The parent reloads the client list on both `saved` and `refresh`.

- [x] Add drawer tests for enabled name/IP inputs and IP/CIDR guidance, an update payload that preserves the selected row version, successful-save event, confirmed empty-list submission, cancellation without a request, and 409/10409 conflict text plus refresh.
- [x] Run the new test and confirm the missing behavior fails.
- [x] Make name and IP whitelist editable. Parse one item per line, retain comma separators for compatibility, and submit name, whitelist, status, and the list-row version.
- [x] Confirm before clearing a non-empty allowlist, then send `[]` after confirmation.
- [x] Map 409/10409 to 「已被他人修改，请刷新」 and emit `refresh` while keeping the drawer open with the message.
- [x] Keep successful save on `saved` so the parent reloads the list and the drawer closes.
- [x] Run the new drawer test and confirm all cases pass.

### Task 3: Record and verify the change

**Files:**

- Update `docs/tasks/FE-IDN-020.md`
- Update `docs/evidence/fe-idn-020/acceptance.md` if the existing evidence directory is present on the branch

- [x] Record the BE-IDN-034 contract, edited fields, confirmation, conflict refresh, and successful list refresh.
- [x] Run `pnpm lint`, `pnpm check:type`, focused gateway and drawer tests, `pnpm test:unit`, `pnpm run build:antd`, and `git diff --check`.
- [x] Confirm `packages/**` remains unchanged.
