# FE-IDN-013 验收记录

2026-11-19，分支 `feat/fe-idn-013-notification-complete`，基线 `75abb6d`。后端 `acae5f0`，迁移 36；真实 API `http://127.0.0.1:18080/api/v1`。

最终浏览器验收使用生产构建与独立 Vite preview（`http://127.0.0.1:5667/#`），避免现有开发服务器热重载重置编辑器状态。请求状态、trace ID、断言与清理结果保存在 [acceptance.json](acceptance.json)，执行输出见 [browser.txt](browser.txt)。没有 mock 业务接口。

| # | 验收项 | 实际结果与证据 |
| --- | --- | --- |
| 1 | 变量面板 | 通过。接口返回 AppName、UserName、TenantName、Link、ExpiresInHours、ExpiresAt、SupportEmail，共 7 项，包含说明、示例、必填标志。[面板上部](01-variables.png)、[面板下部](01-variables-support.png) |
| 2 | 插入 | 通过。在“前后”的第 1 位插入 Link，得到 `前{{.Link}}后`，插入后光标为 10。实际 DOM 值与 selectionStart 断言见 JSON 的 item 2。 |
| 3 | 未知变量 | 通过。保存 `{{.NotDeclared}}` 被拦截，显示具体名称 NotDeclared；没有发出保存 PUT。[截图](03-unknown-variable.png) |
| 4 | 预览 | 通过。真实 preview POST 200，抽屉显示“验证你的 CommerceHub 邮箱”与渲染后的正文，结果不含 `{{`，并注明“用示例值渲染”。[截图](04-template-preview.png) |
| 5 | 测试发送 | 通过。显示“已发送测试邮件，可在投递记录查看”，新增真实投递 109，模板“验证注册邮箱”，状态 sent。[截图](05-test-sent.png) |
| 6 | 偏好名称 | 通过。显示“验证注册邮箱”，悬浮提示 identity.verify。[截图](06-preference-name.png) |
| 7 | 事务性 | 通过。安全模板开关禁用并说明“安全邮件（验证/重置/邀请）不可关闭”；notification.default 邮件偏好自定义后切换成功，PUT 200。[截图](07-security-preferences.png) |
| 8 | 角标为 0 | 通过。真实 unread-count 为 0，页面可见角标数量为 0。[截图](08-zero-badge.png) |
| 9 | 角标轮询 | 通过。创建新站内消息后触发窗口 focus，count 从 0 变为 1，角标出现；单测使用假时钟验证 59,999 ms 不请求、60,000 ms 请求，以及卸载清理。[截图](09-focus-badge.png) |
| 10 | 通知中心 | 通过。列表显示“验收新消息”、摘要和“系统公告”；点击触发 read PUT 200，详情显示完整两行正文与已读状态。[截图](10-inbox-detail.png) |
| 11 | 模板筛选 | 通过。下拉显示并可搜索“系统公告”，选择后按 notification.broadcast 过滤。[截图](11-template-filter.png) |
| 12 | 公告页 | 通过。全部用户 3 人、指定角色 2 人、指定用户 1 人；二次确认显示“1 人，站内信、邮件”，发布 POST 201，成功提示并切换历史。真实数据库存在目标用户站内消息和邮件投递；本机 SMTP 共接收测试与公告邮件 2 封。[全部](12-audience-all.png)、[角色](12-audience-roles.png)、[用户](12-audience-users.png)、[二次确认](12-confirmation.png)、[历史](12-broadcast-history.png) |
| 13 | 公告权限 | 通过。reader 账号无 system:notify:broadcast 权限，直接访问公告页跳转整页 403，公告业务请求数量为 0。[截图](13-broadcast-forbidden.png) |
| 14 | 构建 | 通过。下面四条最终命令退出码均为 0。 |

| 命令 | 汇总 | 日志 |
| --- | --- | --- |
| `pnpm lint` | 格式、oxlint、eslint、stylelint 通过 | [lint.txt](lint.txt) |
| `pnpm check:type` | 38 successful / 38 total | [typecheck.txt](typecheck.txt) |
| `pnpm test:unit` | 156 files / 1102 tests passed | [unit-workspace.txt](unit-workspace.txt) |
| `pnpm build:antd` | 11 successful / 11 total；产出 dist 与 dist.zip | [build.txt](build.txt) |

单测额外覆盖变量声明加载失败、控制语句中的未知变量、偏好只提交可编辑变更、过期计数响应、过期人数预览、重复确认、发布失败保留正文、无权限不加载业务数据。保留仓库现有的图标解析提示、happy-dom teardown AbortError 与 sortable mock hoisting 提示；命令退出码均为 0，未放宽断言。

预览和测试接口按模板 ID 操作已保存版本。编辑器明确说明版本边界，草稿有修改时禁用这两个操作，避免把旧内容显示为当前草稿的预览。HTML 正文使用受限 iframe 展示。后端菜单尚无公告项时，仅对具有公告权限的账号补充隐藏路由，由通知中心“发布公告”进入；没有更改后端契约。

## 复跑

需要现有前端依赖、Bun、Microsoft Edge，以及运行中的开发后端和 worker。数据库连接只从后端 `.env` 或 FE_IDN_013_DATABASE_URL 读取，不写入证据；密码随机生成且不落盘。

```powershell
pnpm build:antd
pnpm --filter @vben/web-antd preview --host 127.0.0.1 --port 5667 --strictPort
# 在另一终端执行
$env:FE_IDN_013_ORIGIN = 'http://127.0.0.1:5667/#'
node apps/admin/e2e/fe-idn-013.mjs
```

脚本在 finally 中先按 API 删除可删除的数据，再按外键顺序用 SQL 清理整套独立租户数据，并核对已有数据摘要。完整删除语句、影响行数和偏差说明见 [cleanup.md](cleanup.md)。没有保留本卡测试数据，没有修改既有系统配置或渠道。
