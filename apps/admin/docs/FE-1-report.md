# FE-1 实施与验收报告

分支：`feat/fe-1-auth`。改动范围为 `apps/admin`，未改动 `packages/`、后端或根目录配置。FE-1 前端适配和自动化验证已完成，停在本卡。

**真实后端验收尚未完成。** `127.0.0.1:8080` 当前无法连接，任务未提供可登录账号；下列浏览器证据使用 Playwright 拦截响应的契约夹具，不是真实账号、真实角色修改或真实会话撤销的证据。应用本身关闭 Nitro Mock，正常运行只请求真实后端。

## 四步产物与验证

| 步骤 | 实现 | 独立验证 |
| --- | --- | --- |
| 1. 请求层 | `/api` 代理到 `http://127.0.0.1:8080`，客户端基路径 `/api/v1`；解开信封，非零 code 抛 `ApiError`，保留 trace ID；Bearer 注入、本地中文映射、401 恢复与一次重放 | `client.test.ts` 15 项，涵盖 HTTP 200 业务失败、401/403/409/429、204、消息不泄漏、重放失败和 20109 |
| 2. 认证层 | snake_case TokenPair；access 只在模块内存，refresh 只在 sessionStorage；刷新单飞、轮换、20109 有限退避；20101/20103 清会话；`/auth/me`；刷新页面恢复登录；注销立即清理状态与动态路由 | `session.test.ts` 9 项、`auth-flow.test.ts` 5 项，涵盖五请求协调、刷新轮换、重载、旧持久化清理和注销竞争 |
| 3. 菜单与权限 | `/auth/menus` 为导航与权限数据源；树与排序转换、目录出口、组件白名单、未知组件 404、button 不进路由；`hasPermission(code)`；已知未接页面占位 | `menus.test.ts` 5 项，使用实际 Vben 菜单生成和 Vue Router，验证菜单替换、空菜单与注册表 |
| 4. 用户只读列表 | `/admin/users` 分页、关键词和状态参数；page_size 最大 100；查询重置页码、保留已提交筛选、加载/空/错误/重试状态、丢弃过期响应；UTC 转本地；权限控制的新增演示按钮 | `admin-users.test.ts` 2 项、`list.test.ts` 5 项；浏览器实际操作分页、筛选和按钮 |

刷新遇到 20109 时最多请求 5 次，退避 400/800/1600/3200ms；期间不弹错。持续繁忙时保留会话，避免超过后端 30 秒旧令牌重放窗口。跨标签页协调按任务卡留待后续。

组件路径已与后端 `internal/modules/identity/seed_catalog.go` 的种子目录核对：`system/user/index` 为用户列表，菜单、角色、订单、客户和询盘为占位。由于真实后端不可连接，真实菜单树仍须联调确认。

## §5 十项验收证据

浏览器原始断言、请求路径与参数见 [browser-results.json](evidence/browser-results.json)，执行脚本见 [fe1.mjs](../e2e/fe1.mjs)。以下“契约通过”均指真实浏览器运行本应用、接口由测试夹具响应。

| # | 任务卡断言 | 逐条证据 | 当前结论 |
| --- | --- | --- | --- |
| 1 | 真实账号登录成功、token 落地、跳首页 | 浏览器断言 1：`POST /auth/login → GET /auth/me → GET /auth/menus → /system/users`；扫描 localStorage/sessionStorage 均无 access，refresh 仅在 sessionStorage。认证集成测试同时确认 Vben accessToken 为空。[登录截图](evidence/login.png)、[用户页截图](evidence/users.png) | 契约通过；**真实账号待后端提供** |
| 2 | 菜单与后端一致，刷新页面保持 | 浏览器断言 2：菜单来自夹具返回的系统/用户/角色/未知组件树；页面 reload 后只增加 1 次 refresh，重新获取菜单并回到用户页。菜单测试校验路径、层次、排序、keepAlive 和 button 排除 | 契约通过；真实菜单待联调 |
| 3 | 移除角色菜单后重新登录，该菜单消失 | 浏览器断言 3：删去夹具中的角色菜单并退出重登，角色文本数量为 0；菜单测试确认旧 `IdentityMenu_1` 路由被删除。初始无 `system:user:create` 时新增按钮数量为 0，赋予后显示；点击仅提示“当前版本仅支持查看用户”，没有用户写请求 | 契约通过；真实角色变更待联调 |
| 4 | 未注册组件显示 404，不白屏 | 浏览器断言 4：`unregistered/index` 显示“哎呀！未找到页面”，保留应用布局；注册表测试确认映射到既有 404 loader。[404 截图](evidence/unknown-component.png) | 前端通过 |
| 5 | 5 个过期请求仅刷新 1 次，全部成功且无错误提示 | 浏览器断言 5：同时发起 5 个 `/auth/me`，精确断言 refresh 增量为 1、5 个结果均为 true、错误 toast 为 0；另一次首刷返回 HTTP 409/20109，静默重试 1 次，5 个等待者均成功。单元测试还覆盖 HTTP 401/20109、持续繁忙不清会话、退避上限、令牌轮换及注销抢先 | 契约通过；真实过期与轮换待联调 |
| 6 | 后台注销会话后下一次请求跳登录 | 浏览器断言 6：夹具返回 HTTP 401/20103 后立即到 `/auth/login`，refresh 调用数不增加，sessionStorage 中 refresh 数量为 0；认证测试另覆盖任务卡的 20101，并确认 user store 清空 | 契约通过；真实后台撤销待联调 |
| 7 | 分页、关键词、状态正确，200 压到 100 | 浏览器断言 7：关键词 `user02` 发送 `keyword=user02&page=1`，重置后第 2 页显示 user21；选择锁定后发送 `status=locked&page=1`，显示 user03 且不显示 user01；`getUsersApi({ page_size: 200 })` 实际发出 100。`08:00Z` 在 Asia/Shanghai 显示 `16:00:00`。参数与列表状态另有 7 项测试 | 前端通过；**真实筛选阻塞，后端未实现 keyword/status** |
| 8 | 401/403/409/429 提示正确，不展示后端 message | 浏览器断言 8 与请求层参数化测试：401/20103 为“登录已失效，请重新登录”；403/20107 为“没有权限执行此操作”；409/10004 为“请求处理中，请稍后重试”；429/10005 为“请求过于频繁，请稍后重试”。浏览器 DOM 不含夹具注入的 `BACKEND_PRIVATE_MESSAGE_MUST_NOT_RENDER`；未知 code 按 HTTP 或通用本地文案兜底 | 前端通过 |
| 9 | `pnpm build:antd`、`pnpm typecheck` | `pnpm build:antd`：11/11 tasks、ExitCode=0；`pnpm --dir apps/admin typecheck`：ExitCode=0；`pnpm check:type`：38/38 tasks、ExitCode=0。根 package.json 没有 typecheck 别名，其实际全仓库脚本为 check:type；按约束未改根配置 | 通过，命令名称差异已说明 |
| 10 | 未接页面显示占位、不报错 | 浏览器断言 10：`system/role/index` 显示“功能尚未接入”，没有编造接口；注册表内其余未接种子页面共用占位，个人资料和未接认证入口也使用占位；空菜单有明确提示。整个登录、重载、路由切换、用户表格、刷新与撤销流程的 `pageerror` 数组为空。[占位截图](evidence/placeholder.png) | 前端通过 |

国际化入口 `src/locales`、语言包及 `setupI18n` 均保留；启动时固定 `zh-CN`，隐藏语言切换，避免旧浏览器偏好覆盖首版中文配置。

## 最终校验与复现

- `pnpm --dir apps/admin test:unit`：6 个测试文件，41/41 通过，ExitCode=0。
- `pnpm --dir apps/admin typecheck`：ExitCode=0。
- `pnpm check:type`：38/38 tasks 成功，ExitCode=0。
- `pnpm build:antd`：11/11 tasks 成功，ExitCode=0。存在既有 tsdown 弃用和 Ant Design 静态/动态导入构建警告，未影响构建。
- 对所有新增/修改 TS、Vue、MJS 执行 ESLint：0 错误，ExitCode=0；格式化及 `git diff --check` 通过。
- `node apps/admin/e2e/fe1.mjs`：浏览器契约断言通过，`errors=[]`，ExitCode=0。脚本仅测试时拦截 API；不进入应用生产包。

在仓库根目录复现浏览器检查（需要本机 Chrome，脚本当前使用 Windows 标准安装路径）：

```powershell
pnpm --dir apps/admin dev --host 127.0.0.1 --port 5173 --strictPort
# 另一终端执行
node apps/admin/e2e/fe1.mjs
```

原始输出保留在本地 `apps/admin/docs/FE-1-tests.log`、`FE-1-browser.log`、`FE-1-final-typecheck.log`、`FE-1-workspace-typecheck.log`、`FE-1-build.log`、`FE-1-eslint.log`。日志按仓库既有规则被 Git 忽略；上述表格保留了关键结果，浏览器 JSON 和截图随应用文档保存。

## 后端需要补

1. **联调服务与账号**：启动 `127.0.0.1:8080`，提供可登录且拥有 `system:user:list` 的账号。实际探测 `GET http://127.0.0.1:8080/api/v1/auth/me` 返回 curl ExitCode=7 / Could not connect to server，见本地 `FE-1-backend-check.log`。
2. **种子与验收条件**：提供 ≥3 用户、≥2 角色、完整真实菜单树；支持验收时变更角色菜单及撤销测试会话。当前未连接数据库，不能确认实际种子已经落库。
3. **用户筛选**：在既有 `GET /api/v1/admin/users` 中实现并补齐 OpenAPI 的 `keyword`、`status` 参数及语义。当前 `identity.yaml` listUsers 只有 page/page_size/sort；`admin_http_handlers.go` 的 users 只调用分页，`AdminService.Users` 也只接收 `repo.Page`。前端已传递本卡规定的参数，不做当前页本地筛选来伪装后端结果。
4. **错误契约统一**：integration.md 将会话撤销记为 20101、刷新繁忙记为 HTTP 401/20109；identity.yaml 将自然过期记为 20102、无效/撤销凭据记为 20103、刷新繁忙记为 HTTP 409/20109。请统一文档。前端当前兼容 20101/20103 撤销和两种 20109 HTTP 状态，20102 才走自然过期刷新。
5. **实际菜单确认**：提供一次真实 `/auth/menus` 响应以核对组件路径、菜单显隐和超管 permissions。当前注册表依据后端现有种子源码；没有添加替代接口。

这些缺口解决后，仍须补做真实账号登录、真实角色菜单移除、真实过期刷新、真实会话撤销和真实用户筛选的联调验收；本报告未将它们标为真实通过。
