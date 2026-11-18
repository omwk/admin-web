# FE-IDN-012 · 账号链接与验证页适配

- ID: FE-IDN-012
- 类型: 修复
- 仓库: 前端
- 状态: 已实现（待评审）
- 预计: 0.3 人日
- 分支: `feat/fe-idn-012-account-link`
- 依赖: BE-IDN-016（链接改用租户 code）

---

## 1. 背景

后端邮件链接将从：

```
/auth/invite/accept?tenant_id=2#token=...
```

改为：

```
/auth/invite/accept?tenant=acme#token=...&tenant_id=2   （过渡期两者都有）
```

前端 `_core/authentication/account-link.vue` 目前只认 `tenant_id`：

```ts
const tenant = Number(route.query.tenant_id);
...
tenant_id: tenant,
```

## 2. 改动

### 2.1 优先使用租户 code

```ts
const tenantCode = typeof q.tenant === 'string' ? q.tenant.trim() : '';
const tenantID = Number(q.tenant_id);
```

- 有 `tenant` → 用它（登录现在接受 code）
- 只有 `tenant_id` → 回退（旧邮件仍可打开）
- 两者都没有 → 显示「链接不完整」，不进入下一步

### 2.2 登录跳转

接受邀请/重置完成后跳登录页：

| 情况           | 预填                                |
| -------------- | ----------------------------------- |
| 有 tenant code | 登录表单租户字段填 code             |
| 只有 id        | 不预填（code 与 id 不同，不能混用） |

### 2.3 验证页

`register-verify.vue` 只用 token，不需要改；但要补一件事：

- 链接里 `tenant` 与 `tenant_id` 都无效时，提示「链接已失效，请重新获取验证邮件」
  而不是空白页

### 2.4 链接规范化

`frontendAccountLink` 只允许 `/auth/invite/accept` 与 `/auth/password/reset`；
本次新增 `/auth/register/verify` 允许通过（此前注册邮件链接没有经过这个函数，
但如果用户在管理端复制链接，应该也能规范化）。

## 3. 验收

| #   | 项         | 断言                                        |
| --- | ---------- | ------------------------------------------- |
| 1   | 新链接     | `?tenant=acme#token=x` 能正常打开接受邀请页 |
| 2   | 旧链接     | `?tenant_id=2#token=x` 仍能打开（回退）     |
| 3   | 都缺失     | 显示「链接不完整」，不崩溃                  |
| 4   | 登录预填   | 新链接场景登录页租户字段为 code             |
| 5   | 旧链接登录 | 不回填错误值（留空）                        |
| 6   | 验证页     | 无效 token 显示失效提示                     |
| 7   | 构建       | lint / typecheck / unit / build 全绿        |

验收记录（2026-11-19）：§3 七项已通过，逐项截图、真实接口状态、完整检查日志见 [FE-IDN-012 验收记录](../evidence/fe-idn-012/README.md)。前端基线为 `main@f2ddf07`；经用户确认，另在后端 `7e64607` 基线上补齐邀请接受与密码重置的 tenant code 解析，两仓库均使用 `feat/fe-idn-012-account-link`。

已清理：五次验收/调试夹具按 tenant ID/code 删除 53 行（租户 5、用户 13、部门 5、账号凭证 20、密码历史 10），本卡审计余量 0，原有 6 条审计及已有业务数据哈希一致；专用 Redis DB 12 的验收限流键已删除，临时 API/前端服务已停止，未修改已有系统配置。逐条 SQL、影响行数见各次 `acceptance*.json`，汇总与全局复核见 [cleanup-final.json](../evidence/fe-idn-012/cleanup-final.json)。

## 4. Codex prompt

```
实现 docs/tasks/FE-IDN-012.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-012-account-link（从最新 main 10516d8 开）

后端已就绪（BE-IDN-016 合并后）：
  邀请/重置/验证链接为绝对地址，含 ?tenant=<code>（过渡期同时带 tenant_id）
  登录接口接受租户 code

必读：本卡、apps/admin/src/views/_core/authentication/account-link.vue、
register-verify.vue、apps/admin/src/auth/account-link.ts 与其测试

改动：
1. 优先读 ?tenant（code），回退 ?tenant_id；都无则提示链接不完整
2. 登录跳转：有 code 时预填租户字段，仅 id 时留空
3. 验证页无效 token 显示失效提示
4. frontendAccountLink 允许 /auth/register/verify

验收按卡片 §3 七条逐条贴证据。
完成后停下报告，并按 AGENTS §12 清理测试数据。
```
