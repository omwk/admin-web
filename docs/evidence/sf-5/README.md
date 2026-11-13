# SF-5 租户管理验收证据

分支：`feat/sf-5-tenant`。实测：2026-11-14（Asia/Shanghai）。前端 `http://127.0.0.1:5666`，真实后端 `http://127.0.0.1:18080`。

租户列表包含分页、来源模板、改名、停启及平台保护；开通使用两步向导，邀请仅保存在组件内存，关闭或离开页面即销毁；模板页签支持生成快照、查看角色/菜单/权限、修改名称描述及删除保护。没有新增依赖或修改后端。

## 卡片 §5 十三项验收

完整 HTTP 状态、错误原文、trace ID、断言和清理结果见 [real-ui.json](./real-ui.json)。邀请截图已遮盖链接；证据不含邀请 token、密码、访问或刷新令牌。

| # | 验收项 | 结果与证据 |
| --- | --- | --- |
| 1 | 列表 | `default(1)` 为 `active`，显示平台徽标，来源模板为“无”。[截图](./01-default-real.png) |
| 2 | 生成模板 | 从 default 生成模板 ID 4；3 个角色、21 个菜单、118 个权限，角色/菜单数与来源及模板详情一致。[列表](./02-snapshot-real.png)、[详情](./02-snapshot-detail-real.png) |
| 3 | 开通 | 两步表单真实 POST 201，创建租户 ID 4；剪贴板与显示链接完全一致。localStorage/sessionStorage 不含邀请链接，关闭、重开、刷新均无法恢复。[向导](./03-wizard-real.png)、[邀请已遮盖](./03-invitation-masked-real.png) |
| 4 | 邀请可用 | 打开邀请设密码返回 201，成功页清除 token，登录页自动携带租户 ID 4，真实登录成功；重复接受返回 400「邀请或链接无效」。[截图](./04-invite-accepted-real.png) |
| 5 | 隔离 | 新租户用户仅 1 人、商品 0 条；default 用户 4 人、商品 123 条。新租户读取平台租户详情返回 404。[截图](./05-isolation-real.png) |
| 6 | 菜单一致 | 新租户与来源模板的 14 个可见菜单逐项一致，按平台入口规则排除 `/system/tenants`；新租户不显示租户管理，直达为 403 页面。[菜单](./06-menus-real.png)、[平台入口隐藏](./06-platform-entry-hidden-real.png) |
| 7 | code 冲突 | 重复 code 返回真实 409，向导原样显示「资源冲突或仍被引用」，输入保留。[截图](./07-code-conflict-real.png) |
| 8 | 停用 | 确认框列出三条后果；取消不发请求。确认后状态为 `suspended`，该租户登录、刷新令牌均返回 403/20111「租户已停用」。同时核对改名请求只含 `name`。[确认框](./08-disable-confirmation-real.png)、[停用状态](./08-suspended-real.png) |
| 9 | 启用 | 界面启用后状态为 `active`，通过真实登录页再次登录新租户成功。[截图](./09-enabled-real.png) |
| 10 | 平台租户 | 停用按钮禁用，提示「平台租户不可停用」；强制调用接口返回真实 409 同名原文，平台状态不变。[截图](./10-platform-protection-real.png) |
| 11 | 模板删除保护 | 已被租户引用的模板禁用删除并解释原因；强删返回 409「资源仍被引用或受保护」。未使用模板可编辑并删除，返回 200/204。[截图](./11-template-protection-real.png) |
| 12 | 权限 | 移除 manage 的权限响应夹具下，开通/改名/停启/模板写按钮及模板页签均隐藏。真实仅 list 角色账号直连开通、改名、停用、删模板全部 403/20107；非平台超管即使有 list 也无入口。[无 manage](./12-no-manage-ui-fixture.png)、[真实非超管](./12-platform-nonsuper-hidden-real.png) |
| 13 | 构建 | lint、应用 typecheck、应用单测 38 文件/155 项、全仓单测 133 文件/862 项、生产构建均退出 0。命令、日志见下表和 [verification.json](./verification.json)。 |

## 验证命令

| 工作目录 | 实际执行命令 | 证据 |
| --- | --- | --- |
| 仓库根目录 | `bun run lint`（执行 `vsh lint`） | [13-lint.txt](./13-lint.txt) |
| apps/admin | `bun run typecheck`（执行 `vue-tsc --noEmit`） | [13-typecheck.txt](./13-typecheck.txt) |
| apps/admin | `bun run test:unit` | [13-app-unit.txt](./13-app-unit.txt) |
| 仓库根目录 | `bun run test:unit` | [13-unit.txt](./13-unit.txt) |
| apps/admin | `../../node_modules/.bin/vite.cmd build --mode production` | [13-build.txt](./13-build.txt) |

本机 Corepack 的 pnpm 缓存目录访问受限，因此使用已安装的本地命令，执行相同的项目校验和构建入口，没有安装或修改依赖。全仓 typecheck 的 37 个依赖任务命中缓存，应用任务随后单独执行成功；生产构建的依赖同样已就绪。lint 的现有图标名称提示、全仓测试的外部资源 EACCES 输出及 vi.mock 提升警告均未使检查失败。

组件与 API 测试覆盖两步校验、返回保留输入、重复提交、关闭销毁、离开页面后的迟到响应、无模板引导、400/409 原文、分页引用收集、平台保护、停用确认、停用租户仍引用模板及无 manage 隐藏。

最终修复后再次用真实后端和 Edge 复核平台保护、409 原文、快照计数及未使用模板编辑/删除，结果见 [final-smoke.json](./final-smoke.json)。该轮只创建临时模板并删除，没有再开通租户。

## 接口口径与证据边界

- 最新 OpenAPI 的停用值为 `suspended`，卡片中的 `disabled` 按“停用”语义验收。
- 模板列表及详情接口实际都要求 `system:tenant:manage`，无 manage 时不请求模板接口；租户列表的未知来源保留模板 ID。
- 普通租户的列表接口实际返回自身，跨租户详情返回 404；前端仍按卡片要求隐藏租户管理入口。
- 后端平台超管始终获得全量权限，无法用真实超管构造“有 list、无 manage”状态。因此第 12 项按钮分支明确使用权限响应夹具，直连 403 则使用真实受限角色账号。
- 菜单一致性排除仅平台可见的租户管理入口，其余路径、名称和类型逐项比较。

## 数据恢复与复现

完整浏览器验收 12 项通过，`browserErrors=[]`。临时受限用户/角色及未使用模板已删除；default 保持 active，原业务数据未修改。

验收过程创建了租户 2、3、4，均已停用。关联模板 2、3、4 因被引用保留；后端没有删除租户 API。第 2/3 项是前两轮调试遗留，第 4 项是最终完整验收记录，最终复核同时确认三者均为 suspended。最终测试不会打印或保存其密码、邀请链接或令牌。

复现完整验收：启动前后端，设置环境变量 `SF5_ADMIN_PASSWORD`，运行 `pnpm --filter @vben/web-antd test:e2e:sf5`。可选 `SF5_ORIGIN`、`SF5_BACKEND`、`SF5_BROWSER_CHANNEL`、`SF5_TENANT_PASSWORD`。脚本会执行真实写操作；每次完整验收都会保留一个停用租户及引用模板。生成 JSON 后运行仓库 oxfmt，再执行验证命令。
