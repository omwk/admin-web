# FE-IDN-012 验收记录

日期：2026-11-19。分支：`feat/fe-idn-012-account-link`。

前端基线：`main@f2ddf0726be5ca37665de92b9ffec26d3f31870b`。后端基线：`7e64607`。

## §3 七项验收

| # | 断言 | 结果与证据 |
| --- | --- | --- |
| 1 | 新 code 链接能打开邀请页 | `?tenant=acme#token=x` 渲染可编辑表单；[截图](01-code-link.png)、[浏览器结果](acceptance.json)。 |
| 2 | 旧 ID 链接仍可打开 | `?tenant_id=2#token=x` 渲染可编辑表单；[截图](02-legacy-link.png)。另用非默认租户真实旧链接提交，响应 201。 |
| 3 | 两者缺失显示链接不完整 | `#token=x` 显示「链接不完整，请联系管理员重新生成。」且按钮禁用；[截图](03-incomplete-link.png)。单测同时验证不会调用提交接口。 |
| 4 | code 场景登录预填 code | 非默认租户 `feidn012_1795039220152` 的 code-only 邀请、code 与冲突 ID 并存的邀请响应均为 201，code-only 重置响应 204；完成后移除 credential fragment，真实登录表单均预填该 code；[邀请截图](login-invite-0.png)、[优先级截图](login-invite-2.png)、[重置截图](login-reset-3.png)。 |
| 5 | 仅 ID 场景登录留空 | 浏览器预置记忆值 `remembered-other`；旧链接接受成功 201，登录表单企业代码仍为空；[截图](login-invite-1.png)、`acceptance.json` 第 5 项。 |
| 6 | 无效验证 token 显示失效提示 | `?tenant=&tenant_id=invalid#token=invalid` 经真实验证接口返回 400，页面显示「链接已失效，请重新获取验证邮件」；[截图](06-invalid-verification.png)。缺失、过长及后端拒绝 token 的单测均通过。 |
| 7 | lint / typecheck / unit / build 全绿 | 下表列出完整命令及结果；日志均保存在本目录。 |

`frontendAccountLink` 对邀请、重置、注册验证三条路径均有规范化单测，保留 query 与 fragment，并继续拒绝未知路径。[定向测试](focused.txt)：4 文件、64 测试通过。

## 检查命令

| 命令 | 结果 | 日志 |
| --- | --- | --- |
| `pnpm lint` | 格式检查通过，exit 0 | [lint.txt](lint.txt) |
| `pnpm check:type` | `38 successful, 38 total` | [typecheck.txt](typecheck.txt) |
| `pnpm test:unit --maxWorkers=2` | `153 passed`，`1086 passed` | [unit.txt](unit.txt) |
| `pnpm --filter @vben/web-antd test:unit --maxWorkers=2` | `58 passed`，`379 passed`，exit 0 | [admin-unit.txt](admin-unit.txt) |
| `pnpm build:antd` | `11 successful, 11 total`，exit 0 | [build.txt](build.txt) |
| `pnpm --filter @vben/web-antd test:e2e:fe-idn-012` | `browser acceptance 1-6: passed; fixture cleanup: passed`，exit 0 | [browser.txt](browser.txt) |
| `golangci-lint run --concurrency=2` | exit 0 | [backend-lint.txt](backend-lint.txt) |
| `go vet -p 2 ./...` | exit 0 | [backend-vet.txt](backend-vet.txt) |
| `go test -p 2 ./...` | 全包通过；首次 bootstrap 用时 519.222s，最终复核命中缓存、exit 0 | [backend-unit.txt](backend-unit.txt)、[backend-unit-final.txt](backend-unit-final.txt) |
| `go test ./internal/bootstrap -run '^TestIdentityAccountTenantCodeIntegrationInviteAndReset$' -count=1 -v` | 7 子场景、邀请和重置两接口均通过 | [backend-focused.txt](backend-focused.txt) |
| `./scripts/check-test-groups.ps1` | 新测试仅归属 core；`Source 595 = shards 594 + excluded 1`，exit 0 | [backend-test-groups.txt](backend-test-groups.txt) |

前端 lint 的现有图标诊断、Vitest 的现有 mock hoist 提示均为非阻断输出，完整保留在日志中。没有放宽测试、禁用规则或新增依赖。

## 验证边界与后端补齐

浏览器使用 Edge headless，前端运行于 `http://127.0.0.1:5667`，访问单独从当前后端工作区构建的 API `http://127.0.0.1:18081`。Playwright 仅转发该 origin 下的 `/api/**` 到真实 API，响应未替换；五个账号请求均匿名，浏览器 `pageerror` 为 0。测试密码和账号凭证随机生成，不写入证据；截图遮盖密码控件。

发现 `7e64607` 的两个消费接口只读取 `tenant_id`，用户已明确选择「补齐后端 code 解析」。后端工作区 `D:/code/go-admin-api` 同名分支修改了 `api/openapi/account.yaml`、`account_link.go`、`account_invite_http.go`、`account_recovery_http.go`，并新增 `identity_account_tenant_code_integration_test.go`。解析顺序为去除两端空白后的精确 code、旧 ID；未知或大小写不符的 code 拒绝降级到 ID。旧 API 未传选择器时保留原有默认租户行为，前端仍阻止缺失租户的链接提交。两仓库改动需要配套交付。

回归测试先在原实现上失败，随后通过：[前端 red](red.txt)、[后端 red](backend-red.txt)、[定向 green](focused.txt)、[后端 green](backend-focused.txt)。后端未改 schema，无迁移及配置变更；新增 Go 测试 91 行，修改的 Go 文件均低于 400 行，函数均低于 80 行。改动未新增日志语句，证据请求仅记录租户选择器及 HTTP 状态。

前两次浏览器尝试被验收脚本过宽的 `/api/` 路由匹配误拦截源码模块，现已限定到 origin 下的 API 路径；另外两次分别命中测试重用旧密码与重复运行限流。夹具已改为新密码，缓存按专用 DB 中的精确限流键清理。失败记录保留为 `acceptance-initial.json`、`acceptance-retry.json`、`acceptance-password-reuse.json`、`acceptance-rate-limit.json`，这些运行的数据库清理均成功。

## AGENTS §12 清理

已清理：五次运行的租户 ID `28,29,30,31,32`，合计删除 53 行；[汇总复核](cleanup-final.json) 显示所有本卡租户及关联数据余量为 0。每次都校验 tenant ID/code，在事务内按外键顺序执行以下参数化 SQL；具体参数和影响行数保存在各次 `acceptance*.json`。

```sql
SELECT id FROM tenant WHERE id = $1 AND code = $2 FOR UPDATE;
SELECT set_config('commercehub.audit_prune_before', $1, true);
DELETE FROM audit_log
WHERE user_agent IN ($1, $2) AND created_at >= $3 AND created_at < $4
RETURNING id;
DELETE FROM sys_refresh_token WHERE tenant_id = $1 RETURNING tenant_id;
DELETE FROM auth_token WHERE tenant_id = $1 RETURNING tenant_id;
DELETE FROM password_history WHERE tenant_id = $1 RETURNING tenant_id;
DELETE FROM sys_user_role WHERE tenant_id = $1 RETURNING tenant_id;
DELETE FROM sys_user WHERE tenant_id = $1 RETURNING tenant_id;
DELETE FROM sys_dept WHERE tenant_id = $1 RETURNING tenant_id;
DELETE FROM tenant WHERE id = $1 AND code = $2 RETURNING id;
```

| 表                | 五次运行删除行数 | 最终本卡余量 |
| ----------------- | ---------------- | ------------ |
| audit_log         | 0                | 0            |
| sys_refresh_token | 0                | 0            |
| auth_token        | 20               | 0            |
| password_history  | 10               | 0            |
| sys_user_role     | 0                | 0            |
| sys_user          | 13               | 0            |
| sys_dept          | 5                | 0            |
| tenant            | 5                | 0            |

本卡未产生审计行；以本卡 User-Agent 和时间窗口限定清理，原有 6 条审计完整保留。已有 tenant、dept、user、role、menu、setting、template 全量哈希校验一致；没有保留本卡测试数据，没有临时修改已有注册开关或密码策略。后端集成夹具使用隔离数据库，测试自动销毁。

专用 Redis DB 12 中仅删除三条本机 IP 的 `invite-ip`、`reset-ip`、`verify-ip` 验收限流键，最终 `DBSIZE=0`；[最终缓存清理](redis-cleanup.json)、[重跑前缓存清理](redis-before-retry.json)。未使用全局 `FLUSHDB`。临时 API 18081 与前端 5667 已停止。

## 复跑

先启动此卡前后端代码，并为 API 指定独立 Redis 数据库。将开发库连接通过 `FE_IDN_012_DATABASE_URL` 注入执行环境，设置 `FE_IDN_012_ORIGIN` 和 `FE_IDN_012_BACKEND` 后运行上表浏览器命令。数据库 worker 使用现有 Bun SQL，浏览器使用现有 Playwright/Edge。脚本在 `finally` 内清理夹具，重复运行前应清理专用缓存中的本次限流键或等待其恢复。不要把数据库连接或凭证写进文档与日志。
