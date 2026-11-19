# FE-IDN-014 验收记录

分支：`feat/fe-idn-014-personal-channels`；起点：`main e5fa35c`。实现、检查和证据均在本地，未提交、推送或创建 PR。

新增 `/profile/notifications`，展示只读账号邮箱和 Webhook / Bark / Gotify 卡片。配置保存后自动测试，只有投递为 `sent` 且重新读取到 `verified_at` 才提示验证成功；列表使用后端掩码，修改时不回填地址。删除需确认。偏好页依据 `available/reason` 展示可用状态，并提供配置入口；机器人服务商标注系统公告用途。

## §2 十条验收

真实浏览器通过现有开发 API 执行，无接口 mock。API：`127.0.0.1:18080`；前端：`127.0.0.1:5666`。浏览器验收时间、请求路径/状态和清理明细见 [acceptance.json](acceptance.json)。

| # | 结果 | 证据 |
| --- | --- | --- |
| 1 | 通过：账号邮箱只读，个人渠道状态齐全 | `checks[item=1]`；[个人页截图](01-personal-channels.png)，三张 URL 渠道卡片及邮件卡片 |
| 2 | 通过：Bark 保存 → 自动测试 → 已验证 | PUT 200、POST 200，投递 `115` 为 `sent`，重新读取 `verified_at=2026-11-19T23:46:23.321576+08:00`；[截图](02-bark-verified.png) |
| 3 | 通过：列表与 DOM 不含完整推送 URL | `checks[item=3]`：只显示 `https://httpbingo.org/…/****`，检查原始目标地址及随机探针均未进入列表 |
| 4 | 通过：测试失败提示原因，保持未验证 | Gotify 测试 HTTP 200，但投递 `failed/provider_delivery_failed`、`verified_at=null`；[截图](04-test-failed.png)，前端显示中文失败说明 |
| 5 | 通过：确认删除后偏好对应列变未配置 | 先取消确认并确认配置仍存在，再确认 DELETE 204；Bark 偏好无开关、显示「未配置」，「去配置」链接可跳转 |
| 6 | 通过：Bark 验证后偏好列可用并保存个人覆盖 | `barkAvailable=true`、`overrideSaved=true`；[截图](06-bark-preferences.png)，包含 Bark 表头与系统通知开关 |
| 7 | 通过：事务性邮件固定开启、禁用并解释 | `identity.verify:email` 的 `aria-checked=true` 且 disabled，显示「安全邮件（验证/重置/邀请）不可关闭」；[组件测试](../../../apps/admin/src/views/system/notification/__tests__/preference-availability.test.ts) |
| 8 | 通过：管理员页说明机器人用途 | [截图](08-admin-purpose.png)：企业微信、钉钉机器人「系统公告专用，不发送个人通知」；机器人行也增加说明 |
| 9 | 通过：普通用户无管理员渠道入口和权限 | 个人页/API 可访问；管理员菜单隐藏、页面不渲染，服务商 API 返回 403；[截图](09-reader-permission.png) |
| 10 | 通过：四项检查全绿 | 见以下命令和结果文件 |

## 检查结果

| 命令 | 结果 | 输出 |
| --- | --- | --- |
| `pnpm lint` | exit 0；格式、ESLint、样式和 Oxlint 检查通过 | [日志](lint.txt)、[退出码与时间](lint-result.json) |
| `pnpm check:type` | exit 0；38 successful / 38 total | [日志](typecheck.txt)、[退出码与时间](typecheck-result.json) |
| `pnpm test:unit` | exit 0；159 files / 1116 tests passed | [日志](unit.txt)、[退出码与时间](unit-result.json) |
| `pnpm build:antd` | exit 0；11 successful / 11 total | [日志](build.txt)、[退出码与时间](build-result.json) |
| `pnpm -F @vben/web-antd test:e2e:fe-idn-014` | §2 第 1–9 项通过；浏览器异常为空；开发夹具已清理 | [结构化记录](acceptance.json) |

新增单测覆盖有序保存/测试、HTTP 200 投递失败、缺失验证时间、SSRF 业务错误及地址脱敏、HTTPS 校验、删除确认、四种不可用原因、事务性邮件锁定、个人渠道过滤及无菜单用户的路由。已有通知偏好覆盖/继承语义保持。

补充真实断言：保存私网地址返回 HTTP 400，弹窗显示「个人渠道地址必须使用公网主机」，未继续调用测试接口。个人页与偏好页均不显示短信；偏好列表仅接受 email / webhook / bark / gotify。

| reason           | 中文说明                   |
| ---------------- | -------------------------- |
| `not_configured` | 尚未配置通知方式           |
| `not_verified`   | 通知方式尚未验证，请先测试 |
| `missing_email`  | 账号尚未填写邮箱           |
| `disabled`       | 通知方式已停用             |

## AGENTS §12 清理

清理对象为开发 API 实际连接的 `commercehub_test.public`，三轮临时租户 ID 为 48 / 49 / 50。最后一次先通过 API 删除个人渠道、清空角色关联、删除用户/角色/菜单，共记录 41 次清理请求；Bark 已在验收第 5 项中删除。SQL 仅处理经过租户 ID + code 双重核对的本卡夹具。

第一次运行遇到测试脚本将成功的角色清空响应 204 误判为 200，修正脚本后重试；第一次剩余数据已由限定租户的 SQL 清完。第二次通过后，为让第 6 项截图同时包含表头与开关，调整截图视口并完成第三次验收。三轮清理回执均保留：[第一次](first-run-cleanup.json)、[第二次](second-run-cleanup.json)、[最终](acceptance.json)。

执行清理时在同一事务中锁定目标租户，并设置审计删除保护参数：

```sql
SELECT id FROM tenant WHERE id=$1 AND code=$2 FOR UPDATE;
SELECT set_config('commercehub.audit_prune_before', $3, true);
DELETE FROM audit_log
WHERE tenant_id=$1 AND created_at >= $4 AND created_at < $3
RETURNING id;
```

下表是 API 清理后 SQL 删除行数，完整语句逐条保存在回执的 `cleanup.sql` 中。除最后的 tenant 行外，统一使用 `DELETE FROM <表> WHERE tenant_id=$1 RETURNING tenant_id`；tenant 使用 `DELETE FROM tenant WHERE id=$1 AND code=$2 RETURNING id`。

| 表                                | 租户 48 | 租户 49 | 租户 50 |
| --------------------------------- | ------: | ------: | ------: |
| audit_log（额外限定本轮起止时间） |      13 |      49 |      49 |
| notify_outbox                     |       2 |       2 |       2 |
| notify_delivery                   |       2 |       2 |       2 |
| notification_preference           |       1 |       1 |       1 |
| notification                      |       1 |       1 |       1 |
| sys_user_channel                  |       0 |       0 |       0 |
| sys_refresh_token                 |      11 |      11 |      12 |
| auth_token                        |       0 |       0 |       0 |
| password_history                  |       0 |       0 |       0 |
| sys_user_role                     |       2 |       1 |       1 |
| sys_role_menu                     |      56 |       0 |       0 |
| sys_role_permission               |     120 |     119 |     119 |
| sys_role_dept                     |       0 |       0 |       0 |
| sys_user                          |       3 |       3 |       3 |
| sys_role                          |       2 |       1 |       1 |
| sys_menu                          |      28 |       0 |       0 |
| sys_permission                    |     119 |     119 |     119 |
| sys_dept                          |       1 |       1 |       1 |
| sys_setting                       |       1 |       1 |       1 |
| channel_provider                  |       0 |       0 |       0 |
| notify_template                   |       0 |       0 |       0 |
| idempotency_key                   |       0 |       0 |       0 |
| outbox_event                      |       1 |      34 |      34 |
| tenant（ID + code）               |       1 |       1 |       1 |

每轮 `cleanup.remaining` 的全部计数均为 0；租户、用户、部门、角色、菜单、权限、设置、服务商、模板、个人渠道的原有记录摘要与清理前一致，原有 13 条审计内容也保留。最终额外只读复查见 [cleanup-verification.json](cleanup-verification.json)：24 个表中上述三个租户的数据均为 0，`feidn014_*` 临时租户总数为 0，审计仍为原有 13 条。

已清理：本卡 API DELETE/关联清空 + 租户/时间限定 SQL → 全部夹具及 111 条验收审计已删除，未保留测试数据；现有系统设置和服务商未修改，临时租户设置随夹具删除。

## 偏差与验证范围

- 前端仓库缺少 `AGENTS.md` 和 `docs/design/notification-routing.md`，已读取同项目后端 `D:/code/go-admin-api` 中的对应文件。按当前指令仅开放四种个人渠道，不采用旧卡示例中的手机/短信项。
- §12 示例命令 `go run ./cmd/cli audit-prune --before <当前时间>` 没有租户或起始时间筛选，会同时删除原有 13 条审计。本次未执行全局 prune，采用同样的审计保护参数、限定夹具租户与本轮时间的 SQL；删除语句与影响行数已完整留证。
- Bark 成功验收使用可公开访问的 HTTPS 状态测试端点，后端真实发送并写入验证时间；未使用真实设备密钥，因此未验证手机端收件。失败链路使用返回 503 的公开端点。证据只保留掩码，未保留完整目标地址、随机密码或访问令牌。
- 单测日志包含现有 happy-dom 清理 fetch 的 AbortError 和 sortable mock 位置提示；lint 输出有现有图标扫描提示。上述命令均 exit 0，未放宽既有断言。
