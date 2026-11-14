# FE-IDN-001 验收证据

日期：2026-11-14。分支：`feat/fe-idn-001-tenant-enhance`，从当时最新的 `main` / `origin/main`（`2641cd1b24bea1ef3f80c8ba3d029a82fe58c2c9`）创建。

契约依据：`docs/tasks/FE-IDN-001.md`、`docs/tasks/SF-5.md`、后端 `D:/code/go-admin-api/api/openapi/system.yaml` 的 tenants 部分。后端状态是 `suspended`；成员接口为服务端分页，返回六个安全字段；重发没有请求体，强制重发使用 query `force=true`。

## 卡片 §4 十项

| # | 验收项 | 实测断言与证据 |
| --- | --- | --- |
| 1 | ID 列 | 真实开通返回 `tenant_id=12`，表格第一列为数字 `12`，单元格使用 `font-mono`。[截图](01-id-and-inactive-real.png)；[原始断言](acceptance.json)。 |
| 2 | 管理员列 | 激活前 `admin_active_count=0`，红色 `未激活`；接受邀请后 API 计数变为 `1`，界面显示 `1 人`。[未激活](01-id-and-inactive-real.png)、[已激活](02-admin-count-real.png)。 |
| 3 | 成员抽屉 | `GET /api/v1/admin/tenants/12/members?page=1&page_size=20` 返回 200。逐字段比对账号、字典状态、超管和创建时间，接口仅含 `id/account/nickname/status/is_super/created_at`。抽屉无编辑、禁用、重置密码、删除按钮。[开通后成员](03-members-readonly-real.png)、[激活后成员](03-members-active-readonly-real.png)。单测另覆盖 active/disabled/locked、翻页、失败重试及丢弃过期响应。 |
| 4 | 重发（无管理员） | 点击后直接 `POST /api/v1/admin/tenants/12/admin-invite`，无 force 参数，返回 201，弹窗显示本站链接。此前开通邀请接受返回 400。[遮盖链接的截图](04-direct-invite-masked-real.png)、[HTTP 断言](acceptance.json)。 |
| 5 | 重发（有管理员） | `重置管理员` 先展示指定二次确认文案；取消发送 0 次请求。确认后带 `?force=true`，返回 201。再次签发后，未使用的旧邀请接受返回 400，新邀请接受返回 201。[二次确认](05-confirm-force-real.png)、[新链接弹窗](05-forced-link-masked-real.png)、[HTTP 断言](acceptance.json)。 |
| 6 | 链接一次性 | 实际复制内容与本次响应链接一致。关闭弹窗后输入框消失，刷新后无恢复入口；localStorage/sessionStorage 不含链接。单测补充离开 KeepAlive 页面、重新挂载和迟到响应清理。[关闭并刷新](06-link-discarded-real.png)、[断言](acceptance.json)。 |
| 7 | 停用租户 | 真实停用返回 `suspended`；重发按钮 disabled，悬浮显示 `租户已停用`。[截图](07-suspended-tooltip-real.png)。 |
| 8 | 平台租户 | `default(1)` 行显示蓝色 `平台` 标记；停用按钮 disabled，悬浮显示 `平台租户不可停用`。[截图](08-platform-protection-real.png)。 |
| 9 | 权限 | 从真实登录会话的菜单响应中移除 `system:tenant:manage` 后，重发、重置管理员和其他写入口全部隐藏，`查看成员` 仍可用且 GET 返回 200。[UI 权限夹具截图](09-no-manage-members-ui-fixture.png)。该项仅验证前端权限分支：后端平台超管始终返回全量权限，响应夹具的使用已在 [acceptance.json](acceptance.json) 明确标记。 |
| 10 | 构建 | lint / typecheck / unit / build 的命令和退出码见 [verification.json](verification.json)，原始日志见下表。 |

## 检查命令

| 命令 | 验证内容 | 日志 |
| --- | --- | --- |
| `pnpm lint` | 全仓格式、代码与样式检查 | [lint.txt](lint.txt) |
| `pnpm check:type` | 38 个类型检查任务 | [typecheck.txt](typecheck.txt) |
| `pnpm test:unit --maxWorkers=2` | 141 文件，904 测试 | [unit-workspace.txt](unit-workspace.txt) |
| `pnpm -F @vben/web-antd test:unit --maxWorkers=2` | 管理端 46 文件，197 测试 | [unit-admin.txt](unit-admin.txt) |
| `pnpm -F @vben/web-antd build` | 生产构建及 dist.zip | [build.txt](build.txt) |

workspace 单测输出包含 happy-dom 退出时的 AbortError 日志，以及既有 sortable mock 的提升警告；退出码为 0，904 项通过。完整输出保留在日志中。

## 复现与数据

实际浏览器验收使用本地前端 `http://127.0.0.1:5668`、hash 路由、后端 `http://127.0.0.1:18080`、Edge 无头浏览器。脚本为 `apps/admin/e2e/fe-idn-001.mjs`，支持环境变量覆盖地址、路由和浏览器。

```powershell
$env:FE_IDN_ADMIN_PASSWORD = '<本地平台管理员密码>'
$env:FE_IDN_ORIGIN = 'http://127.0.0.1:5668'
$env:FE_IDN_BACKEND = 'http://127.0.0.1:18080'
pnpm -F @vben/web-antd test:e2e:fe-idn-001
```

前端需已启动并将 `/api/v1` 代理到后端。测试开发服务器的 history 路由时，另设置 `$env:FE_IDN_ROUTER_MODE = 'history'`。密码由环境变量传入，邀请凭证和登录令牌不写入日志；截图遮盖账号链接及密码输入框。

最终完整验收使用独立租户 ID 12。排查脚本和重跑期间生成的 ID 9、10、11，以及最终 ID 12 均已核实为 `suspended`。后端没有租户删除接口，保留这些停用的验收租户；复用已有模板，未修改后端代码。
