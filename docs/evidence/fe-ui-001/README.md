# FE-UI-001 验收证据

日期：2026-11-14（Asia/Shanghai）。前端分支：`feat/fe-ui-001-shell`，从当时最新 `origin/main`（`4d888a3`）创建。

前端：`http://127.0.0.1:5667`；真实后端：`http://127.0.0.1:18080`。浏览器为无头 Microsoft Edge，1440 × 1100，中文及上海时区。截图中的密码输入框统一遮罩。

最初 BE-IDN-001 尚未合并，按授权先完成并验证 B → C → D。后端 [PR #44](https://github.com/omwk/go-admin-api/pull/44) 合并至 `43becf92aba99690937cd71ddce68b90e8b9291e` 并部署后，已按 A → B → C → D 重新联调。[依赖实测](./dependency.json) 确认三字段登录及 `/auth/me.user.tenant_code` 已上线。

前端四块均已实现。十三条验收中 11 项通过，第 5、9 项因真实接口缺项仅部分通过；lint、typecheck、unit、build 均通过。界面夹具结果单独标注，不能替代真实后端验收。机器可读结果见 [验收汇总](./acceptance.json)。

## §6 十三条逐项验收

| # | 项 | 结果 | 实测断言与证据 |
| --- | --- | --- | --- |
| 1 | 企业代码登录 | 通过 | `default` 及独立租户 `feui001_b988d799`（ID 7）均登录 200；后者 `/auth/me` 租户 ID/code 正确，快捷入口均属于其 `/auth/menus`，实际进入 `/system/users`。每次 UI 请求只含 `tenant/account/password`。[JSON](./phase-a-real.json)、[默认登录](./01-login-default-real.png)、[另一租户菜单](./01-other-tenant-menu-real.png)。 |
| 2 | 记住代码 | 通过 | 关闭完整浏览器进程并使用同一用户目录重启，企业代码保留，账号和密码为空；localStorage 无账号、密码及令牌。[JSON](./phase-a-real.json)、[重启截图](./02-login-browser-restarted-real.png)。 |
| 3 | 错误文案 | 通过 | 错误 code、正确 code 配错误密码均为 401/20101，界面统一「企业代码、账号或密码错误」。额外用不同服务端错误原文的夹具验证前端不会泄漏区别。[真实 JSON](./phase-a-real.json)、[真实截图](./03-login-errors-real.png)、[夹具 JSON](./phase-a-ui.json)。 |
| 4 | 顶栏租户 | 通过 | 真实登录后分别断言顶栏为 `租户：default`、`租户：feui001_b988d799`，来自 `/auth/me.user.tenant_code`。夹具另验证提交 code 与 me 不同时以 me 为准。[JSON](./phase-a-real.json)、[默认租户](./04-header-default-real.png)、[另一租户](./04-header-other-tenant-real.png)、[权威值夹具](./phase-a-ui.json)。 |
| 5 | 资料展示 | 部分通过 | 真实 me 可展示昵称、租户 code、部门 ID 和角色；但省略 `email/phone/dept_name`，完整资料无法实测。以夹具确认六字段完整映射；手机因更新接口不接受而只读。[真实字段 JSON](./phase-b.json)、[真实页面](./05-profile-real.png)、[完整字段夹具](./05-profile-fields-ui-fixture.png)。 |
| 6 | 资料修改 | 通过 | 真实修改昵称返回 200，刷新浏览器后仍为保存值；保存后重新读取 me 并更新用户信息。[JSON](./phase-b.json)、[刷新后截图](./06-profile-persisted-real.png)。 |
| 7 | 改密 | 通过 | 旧密码错误返回 401，显示后端原文「用户名或密码错误」且不退出；正确改密返回 204，另一会话的 me 返回 401/20103，当前会话刷新仍正常。成功文案明确其他设备已失效。[JSON](./phase-b.json)、[错误旧密码](./07-wrong-old-password-real.png)、[成功提示](./07-password-success-real.png)。 |
| 8 | 密码规则 | 通过 | 7 位混合密码和 8 位纯字母均被前端拦截，密码接口请求数为 0；另有 Unicode 长度、UTF-8 72 字节上限及确认一致性单测。[JSON](./phase-b.json)、[校验截图](./08-password-rule-real.png)。 |
| 9 | 会话列表 | 部分通过 | 真实显示 3 条会话；二次确认取消后仍有效，确认后 logout-all 204、跳登录页、sessionStorage 为 0、其他会话 401。接口所有行 sid 为空，且无 IP/UA/current，不能证明多设备身份与当前标记；完整列和 tooltip 另用夹具验证。[真实 JSON](./phase-c.json)、[列表](./09-sessions-real.png)、[确认框](./09-logout-all-confirm-real.png)、[跳转](./09-logout-all-login-real.png)、[设备信息夹具](./09-sessions-metadata-ui-fixture.png)。 |
| 10 | 登出 | 通过 | 真实登出清空 sessionStorage，后退仍回登录页，内页表单不再出现；用真实登录配 503 登出响应夹具确认失败也清理。单测确认 auth/user/权限/通知归零及调用 `location.replace`。[JSON](./phase-d.json)、[后退保护](./10-logout-back-guard-real.png)、[503 响应夹具](./10-logout-server-failure-ui-fixture.png)、[单测日志](./unit-workspace.log)。 |
| 11 | 首页 | 通过 | 真实管理员显示 6 个权限快捷入口；无角色用户保留 `/home`，显示指定空态且隐藏通知卡片。首页含欢迎语、租户、当天日期；有通知权限时使用已有接口仅取 3 条。[JSON](./phase-d.json)、[有权限](./11-home-permissions-real.png)、[无权限](./11-home-empty-real.png)。 |
| 12 | 404 | 通过 | 未知路径显示 404；返回首页、返回上一页均实测可用；已知但无权限的 `/system/users` 显示 403。[JSON](./phase-d.json)、[404](./12-not-found-real.png)、[403](./12-known-route-forbidden-real.png)。 |
| 13 | 构建 | 通过 | `pnpm lint` 退出 0；全仓 unit：139 文件 / 893 测试通过；typecheck：38/38；生产 build：11/11。四项命令均退出 0。[lint](./lint.log)、[typecheck](./typecheck.log)、[unit](./unit-workspace.log)、[build](./build.log)。 |

## 后端缺项及前端处理

1. `/auth/me.user` 没有邮箱、手机、部门名。真实验收用户已有邮箱，但 me 未投影该字段；页面不通过管理接口越权补读。昵称保存不会把未返回的邮箱清空；只有显式编辑邮箱才提交该字段。
2. 后端 `internal/modules/identity/account_profile.go` 的 `ProfileInput` 只有 `nickname/email/avatar`，不支持手机修改。当前手机输入只读并提示联系管理员；卡片要求的手机编辑需要后端扩展后补齐。
3. `/auth/sessions` 只返回时间等基础字段，sid 为空，也无 `ip/user_agent/current`。页面如实显示「未提供」，不猜测设备；当后端提供 sid 或 current 时可自动识别当前会话，UA 列支持截断与完整 tooltip。

## 可复跑命令

在仓库根目录启动 `pnpm dev:antd --port 5667`，后端使用 18080。通过环境变量 `FE_UI_ADMIN_PASSWORD` 提供管理员密码，不将密码写入报告。

```powershell
pnpm exec node apps/admin/e2e/fe-ui-001-dependency.mjs
pnpm exec node apps/admin/e2e/fe-ui-001-login-real.mjs
pnpm exec node apps/admin/e2e/fe-ui-001.mjs --phase=b
pnpm exec node apps/admin/e2e/fe-ui-001-sessions.mjs
pnpm exec node apps/admin/e2e/fe-ui-001-shell.mjs
pnpm exec node apps/admin/e2e/fe-ui-001-login-ui.mjs
pnpm lint
pnpm check:type
pnpm test:unit
pnpm build:antd
```

`login-ui.mjs` 全部为前端响应夹具；`shell.mjs` 仅登出 503 为响应夹具，其余连接真实后端。API 测试收到限流会等待后重试，不绕过后端限流。

## 清理与范围

资料、会话、首页验收创建的临时普通用户已删除；独立测试浏览器均关闭，其临时用户目录已删除。管理员测试会话已登出。

另一租户验收创建的 ID 7 / `feui001_b988d799` 已停用（`suspended`）。后端没有租户删除接口，保留该停用租户及它引用的不可变模板 ID 7 / `feui001_shell`，详见 [清理结果](./phase-a-real.json)。未改动既有租户、管理员密码或后端代码。

未提交、推送或合并分支。任务卡要求的页面实现及验收证据保留在当前工作区，后续需要补验第 5、9 项的后端字段。
