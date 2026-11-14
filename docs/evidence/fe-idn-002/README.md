# FE-IDN-002 验收证据

分支 `feat/fe-idn-002-registration`，基线 `6d89085`。2026-11-14 使用真实后端 `127.0.0.1:18080`、Vite `127.0.0.1:5669` 和 Microsoft Edge 完成验收；页面请求经过开发代理，未模拟业务响应。

[acceptance.json](acceptance.json) 记录完整业务验收的状态码、业务码、trace ID、浏览器错误、匿名请求和清理结果。[screenshots-refresh.json](screenshots-refresh.json) 记录等待认证页转场结束后，重新执行注册、验证和登录所生成的截图。补截同样使用真实后端，恢复原配置并删除了额外测试账号。证据不保存密码、会话令牌或邮箱验证凭证。

## 卡片 §3 十二条

| # | 项 | 结果与实际证据 |
| --- | --- | --- |
| 1 | 设置读取 | 通过。三项显示后端值及默认 `false`、`""`、`10`，全部 `hot_reload=true`。[截图](01-settings-values-real.png)，`acceptance.json` 第 1 项。 |
| 2 | 关闭状态 | 通过。关闭后角色下拉与每小时上限同时禁用。[截图](02-settings-closed-real.png)，第 2 项。 |
| 3 | 保存 | 通过。页面真实 PUT 返回 200 并提示「已生效」；刷新及再次 GET 均为开启，默认角色和上限也与保存值一致。[截图](03-settings-persisted-real.png)，第 3 项。 |
| 4 | 风险提示 | 通过。开关下方完整显示卡片指定的三条提示，关闭时仍显示。[截图](03-settings-persisted-real.png)，第 4 项及设置组件测试。 |
| 5 | 注册成功 | 通过。真实首次 201，仅显示「如果信息有效，我们已向你的邮箱发送验证邮件，请查收。」；不展示存在性信息或开发验证链接。[截图](05-register-first-real.png)，第 5 项。 |
| 6 | 重复注册 | 通过。同账号再次提交返回 202，结果区与首次逐字一致。[截图](06-register-duplicate-real.png)，第 6 项；补截的首次与重复截图也完全相同。 |
| 7 | 关闭时注册 | 通过。真实 403 / 20111 展示「该企业未开放自助注册」。[截图](07-registration-closed-real.png)，第 7 项。 |
| 8 | 验证页 | 通过。有效 token 返回 204，显示「邮箱已验证，现在可以登录了」及登录按钮；撤销和已使用 token 返回 400，显示「链接无效或已过期」及重新注册链接。支持卡片 query token 和后端 dev 链接 fragment token。[成功](08-verify-success-real.png)、[失败](08-verify-invalid-real.png)，第 8 项。 |
| 9 | 验证后登录 | 通过。未验证登录返回 403 / 20111 并显示「请先完成邮箱验证」；验证后真实登录 200 并进入 `/home`。完整验收还确认普通注册者 `is_super=false` 且获得配置的默认角色。[未验证](09-pending-login-real.png)、[已验证](09-verified-login-real.png)，第 9 项。补截使用空默认角色，登录后显示无权限首页。 |
| 10 | 首用户 | 通过。隔离新租户 ID 13 有 0 个活跃用户、1 个停用的预留管理员；首个注册者验证前 `disabled / is_super=false`，验证后返回 204，登录 200，`/auth/me.user.is_super=true`。[截图](10-first-user-super-real.png)，第 10 项。 |
| 11 | 密码校验 | 通过。7 位密码和纯字母密码均被前端拦截，注册请求数为 0；单测还覆盖纯数字、确认不一致、邮箱错误、必填及后端更严格的密码策略。[截图](11-password-validation-real.png)，第 11 项。 |
| 12 | 构建 | 通过。lint、全仓 typecheck、全仓和管理端 unit、生产 build 均退出 0。[verification.json](verification.json) 及下列日志。 |

## 检查命令

| 命令 | 结果 | 原始日志 |
| --- | --- | --- |
| `pnpm lint` | 退出 0 | [lint.log](lint.log) |
| `pnpm check:type` | 38 / 38 任务成功 | [typecheck.log](typecheck.log) |
| `pnpm test:unit --maxWorkers=2` | 145 文件、929 测试通过 | [unit.log](unit.log) |
| `pnpm -F @vben/web-antd test:unit --maxWorkers=2` | 50 文件、222 测试通过 | [unit-admin.log](unit-admin.log) |
| `pnpm build:antd` | 11 / 11 任务成功，生成 `apps/admin/dist` 和 `dist.zip` | [build.log](build.log) |

检查日志中仍有现有依赖的图标名称、happy-dom 关闭请求、Vitest mock 提升及打包依赖弃用提示；均未导致检查失败。

## 额外约束与错误分支

- 登录页底部入口携带当前输入的企业代码，注册页从 URL 带入时只读；手填企业代码也可使用。[入口截图](login-registration-entry-real.png)。
- 页面不查询企业是否开放注册。完整验收及补截的 `discoveryRequests=[]`；注册和验证请求全部不含 Authorization，未知租户 401 不触发刷新或清理已登录会话，另有传输层单测覆盖。
- 超限真实返回 429 / 10005，页面显示「注册过于频繁，请稍后再试」。[截图](registration-limit-real.png)。
- 未知租户真实返回 401 / 20101，复用登录的「企业代码、账号或密码错误」。[截图](registration-unknown-real.png)。
- 密码使用既有的至少 8 字符、字母和数字、最多 72 UTF-8 字节的前置校验；400 等业务错误保留后端策略文案。
- 三条风险提示、角色列表的无角色选项、租户管理权限保存以及提交期间防重复均有组件测试。角色列表加载失败时提供重试。

## 复现与测试数据

启动开发服务时使用 `VITE_ROUTER_HISTORY=history`，端口设为 5669。提供环境变量 `FE_IDN_002_ADMIN_PASSWORD`、`FE_IDN_002_BACKEND_REPO`（后端源码目录）、`FE_IDN_002_DATABASE_URL`（本地验收数据库连接），然后运行 `pnpm -F @vben/web-antd test:e2e:fe-idn-002`。可用 `FE_IDN_002_ORIGIN` 和 `FE_IDN_002_BACKEND` 覆盖地址。

完整验收通过现有管理 API 创建临时角色、账号、租户模板和新租户。由于没有活跃用户的新租户无法自行登录开启注册，第 10 项的准备由 `e2e/fixtures/registration.go` 完成：仅允许 ID 大于 1、code 以 `reg_` 开头、状态为 active 且活跃用户数为 0 的指定租户，在事务中更新注册设置；实际注册、验证、超管授予和登录全部经过真实 API。

默认租户原始设置 `false / 空角色 / 10` 已恢复，临时普通账号与角色已删除。后端没有租户删除 API，隔离验收租户 ID 13 已停用，关联模板 ID 1 保留；详见 `acceptance.json.cleanup` 和 `retained`。补截未创建额外租户或角色，额外账号也已删除。

首用户登录截图中的「最近通知」接口返回「超出数据权限」；该现象不影响本卡已经验证的注册、邮箱激活、首用户超管授予和登录结果，未在本卡扩大修改范围。
