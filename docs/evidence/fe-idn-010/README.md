# FE-IDN-010 验收记录

分支 `feat/fe-idn-010-channel-form`，基线 `main d4a6412`；真实后端 `095844f`。前端 `http://127.0.0.1:5666`，后端 `http://127.0.0.1:18080`。浏览器验收于 2026-11-18（北京时间）执行，最终完整记录见 [acceptance.json](acceptance.json)。

## 十一条验收

按本次会话要求，第 10 条为端口/TLS 警告，原卡的构建项顺延为第 11 条。

| # | 结果 | 证据 |
| --- | --- | --- |
| 1 | 通过 | SMTP 地址、发件人邮箱、用户名均为 `type=text`，输入值可见：[表单截图](01-smtp-visible-password-masked-real.png)。 |
| 2 | 通过 | `password/api_key/access_key_secret/secret` 均为 `type=password`：[SMTP](01-smtp-visible-password-masked-real.png)、[SendGrid](02-sendgrid-masked-real.png)、[阿里云邮件](02-aliyun-masked-real.png)、[Webhook](02-secret-masked-real.png)。Access Key ID、endpoint 明文。 |
| 3 | 通过 | 六个字段逐一断言占位及 §2.2 提示文案；提示使用 `text-xs text-gray-500`。见 JSON 第 3 项及 `provider-form.test.ts`。 |
| 4 | 通过 | 真实 POST 返回 HTTP 400、`details.field=smtp_addr`，地址下方红框/红字「SMTP 地址需包含端口，例如 smtp.163.com:465」：[截图](04-smtp-port-field-error-real.png)。trace_id=`01M7NAEHTMG48PKBP3ETTSPXAR`。 |
| 5 | 通过 | 只填密码、不填用户名，真实 POST 返回 HTTP 400、`details.field=username`，用户名下方显示「已填写密码时必须同时填写 SMTP 用户名」：[截图](05-username-field-error-real.png)。trace_id=`01M7NAEJVBJ979EXEBAD52BG1M`。 |
| 6 | 通过 | 修改地址/用户名后对应错误与红框消失；改其他字段保留原错误，由组件测试覆盖：[截图](06-field-errors-cleared-real.png)。 |
| 7 | 通过 | 无 field 的响应显示顶部横幅：[截图](07-top-banner-response-fixture.png)。此项使用明确标注的 HTTP 400 响应夹具，不计作真实后端证据；组件测试另覆盖未知字段兜底。 |
| 8 | 通过 | 切换 SMTP → 阿里云邮件后 config/字段错误清空；名称保留、优先级仍为 17、启用仍为 false：[截图](08-kind-switch-cleared-real.png)。另验证切换清除顶部错误、切回 SMTP 后无旧值。 |
| 9 | 通过 | 完整 SMTP 配置真实返回 HTTP 201、code=0，并在列表出现：[截图](09-created-provider-list-real.png)。trace_id=`01M7NAES6WWZ7GE8RF7R2X2PKD`。验收后 API 删除返回 204。 |
| 10 | 通过 | [465+STARTTLS 警告](10-465-starttls-warning-real.png)、[587+TLS 警告](10-587-tls-warning-real.png)；切成匹配模式或端口 2525 后警告消失。保留 465+STARTTLS 警告仍真实提交成功（201）。 |
| 11 | 通过 | lint、typecheck、Admin 单元测试、全仓单元测试、生产 build 全部通过。命令及汇总见下表，最终证据索引见 [verification.json](verification.json)。 |

额外回归：[编辑态截图](edit-configured-flags-real.png)确认已保存配置仍仅显示「已配置」、不回填原值；原有组件测试确认编辑留空省略该键、保留后端配置。

## 检查命令

均在仓库根目录执行；未新增依赖。

| 命令 | 汇总 | 日志 |
| --- | --- | --- |
| `bun run lint` | `All matched files use the correct format.`，退出码 0 | [lint.log](lint.log)、[退出码](lint-result.json) |
| `bun run check:type` | `Tasks: 38 successful, 38 total` | [typecheck.log](typecheck.log) |
| `bun run --cwd apps/admin test:unit --maxWorkers=2` | `Test Files 57 passed (57)` / `Tests 318 passed (318)` | [unit-admin.log](unit-admin.log) |
| `bun run test:unit --maxWorkers=2` | `Test Files 152 passed (152)` / `Tests 1025 passed (1025)` | [unit-workspace.log](unit-workspace.log) |
| `bun run build:antd` | `Tasks: 11 successful, 11 total` / `built in 25.27s` | [build.log](build.log) |
| `bun run --cwd apps/admin test:e2e:fe-idn-010` | 第 1–10 项通过，`passed=true`，浏览器异常 0 | [e2e.log](e2e.log)、[acceptance.json](acceptance.json) |

全仓单元测试日志保留现有 happy-dom AbortError、嵌套 `vi.mock` 提示；测试汇总全部通过。lint 输出现有图标名提示，退出码为 0。

浏览器脚本使用现有 Playwright/Bun 工具，执行前需提供 `FE_IDN_010_DATABASE_URL`（与本地后端相同的开发库 DSN）、`FE_IDN_010_BACKEND_REV=095844f`。默认访问上文地址；可通过 `FE_IDN_010_ORIGIN`、`FE_IDN_010_BACKEND` 覆盖。不得指向共享或生产库。凭据在进程内生成，报告仅保留字段名、状态码和掩码截图。

## §12 清理

验收脚本在 `finally` 中通过 API 删除服务商（id=3，HTTP 204），再在事务内使用本卡 UA、开始时间及用户 ID 的精确谓词删除审计、会话、临时用户及角色关联。SQL、参数与影响行数分别记录在 [第一次调试清理](cleanup-first-run.json)、[第二次调试清理](cleanup-second-run.json)、[完整验收清理](cleanup.json)。两次调试未通过的验收结果保留作执行记录，不作为最终通过证据。

三次执行共清除：服务商 1 个、临时用户 3 个、用户角色关联 3 行、审计 5 行、刷新会话 5 行；密码历史和 auth_token 均为 0 行。没有创建租户、角色、菜单、模板，也没有修改系统设置。每次清理均比较已有用户/服务商/设置/菜单/租户/模板/角色基线，确认原数据保留。

实际参数见 JSON，主要 SQL 如下：

```sql
SELECT set_config('commercehub.audit_prune_before',$1,true);
DELETE FROM audit_log WHERE user_agent IN ($1,$2) AND created_at>=$3 AND created_at<$4 RETURNING id;
DELETE FROM sys_refresh_token WHERE user_id=$1 AND user_agent IN ($2,$3) AND created_at>=$4 RETURNING id;
DELETE FROM password_history WHERE tenant_id=1 AND user_id=$1 RETURNING id;
DELETE FROM auth_token WHERE tenant_id=1 AND (user_id=$1 OR created_by=$1) RETURNING id;
DELETE FROM sys_user_role WHERE tenant_id=1 AND user_id=$1 RETURNING role_id;
DELETE FROM sys_user WHERE tenant_id=1 AND id=$1 AND username=$2 RETURNING id;
```

已清理：在本地开发实例所用的 `commercehub_test` 库复核本卡用户/服务商/审计/会话均为 0，并执行 `go run ./cmd/cli audit-prune --before 2026-11-17T18:12:17.527Z` → `deleted=0`，退出码 0。完整结果见 [audit-prune.log](audit-prune.log) 和 [cleanup-verify.json](cleanup-verify.json)。未保留本卡测试数据。

## 文档差异

§2.5 的 `ls_mode/ls` 按既有契约使用 `tls_mode/tls`；本次会话指定基线 `d4a6412`、十一条验收优先于卡片中较早的 prompt。第 7 项响应夹具已单独标明。其余按卡实现。
