# FE-1 真实后端联调验收

验收日期：2026-11-10。前端 `http://127.0.0.1:5666`，后端 `http://127.0.0.1:18080`。浏览器请求通过 Vite 的 `/api` 代理到后端，客户端继续使用 `/api/v1`。

## 修改

- `.env.development` 保持 `VITE_NITRO_MOCK=false`，代理端口从 8080 改为 18080。
- 登录、用户信息、菜单和用户列表沿用真实接口封装；浏览器验收脚本已删除响应拦截、生成账号、生成菜单和生成用户数据。
- BE-1 已支持 keyword/status：已删除临时过滤开关，`getUsersApi` 直接发送归一化后的 keyword/status/page/page_size；关键词会去除首尾空格，空筛选不发送，页面说明已恢复可筛选。
- 删除共享 Vite 配置中的 Nitro 插件、选项类型、环境转换及 `nitropack` 依赖；锁文件移除 120 个包条目、121 个快照，保留依赖版本不变。
- 个人资料中的固定角色选项改为来自真实用户信息的只读选项。
- 新增 `pnpm --dir apps/admin test:e2e` 命令，密码只从环境变量读取，网络证据不保存密码、Authorization 或令牌。

## 验收结果

| 验收项 | 结果与证据 |
| --- | --- |
| admin 真实登录，菜单来自后端 | 通过。POST `/auth/login`、GET `/auth/me`、GET `/auth/menus` 均成功；后端返回 103 个权限，侧边栏渲染系统 `/system`、交易 `/trade`、客户 `/crm` 三个顶级菜单。 |
| 用户列表显示三条 | 通过。GET `/admin/users?page=1&page_size=20` 返回 total=3；表格渲染 admin、sales01、sales02 三行。 |
| 关键词搜索 | 通过。UI 输入 sales，真实请求带 keyword=sales，后端及表格均返回 sales01/sales02 共 2 条；改为 sales01 后返回 1 条。每次查询均为 page=1。 |
| disabled 状态筛选 | 通过。UI 选择停用，真实请求带 status=disabled。当前三名种子用户均为 active，后端 total=0/list=[]，页面显示空表格；未修改用户数据来构造停用账号。 |
| 组合筛选与重置 | 通过。keyword=sales 与 status=active 同时发送，返回 2 名 active 销售用户；重置后请求只带 page/page_size，恢复 3 行。 |
| 刷新页面保持登录 | 通过。admin 刷新后恢复用户列表，只发送一次 `/auth/refresh`；sales01 刷新后仍处于公共首页，也只发送一次刷新请求。 |
| sales01 无角色、空菜单且不报错 | 通过。在同一浏览器中退出 admin 后登录 sales01，后端 roles=[]、permissions=[]、menus=[]；页面显示“暂无可用菜单”，未残留 admin 菜单，也未请求用户列表。 |
| 并发刷新只发一次 | 通过。五次同时调用真实刷新协调器共享同一 Promise，只产生一次 POST `/auth/refresh`；之后五次 `/auth/me` 均成功。另验证五个并发会话恢复也只刷新一次。 |
| 无应用或构建侧模拟服务依赖 | 通过。下列源码搜索无匹配，Nitro 包已从构建配置、声明和锁文件移除。隔离单元测试中的测试替身不参与运行或浏览器联调。 |

筛选验证同时断言浏览器实际请求参数、真实响应中的用户名/状态/总数，以及表格行数，不在浏览器中替换响应或做本地数据筛选。disabled 的非空结果未覆盖，因为当前真实种子没有停用用户。

并发会话恢复检查通过清空浏览器内存中的 access、保留真实 sessionStorage refresh 触发恢复，未伪造服务端过期响应。自然过期的 401 重放和 20109 退避逻辑由现有隔离单元测试覆盖。

## 验证

- 管理端 Vitest：6 个文件、41 项测试通过。筛选参数测试先在临时屏蔽实现上失败，再在恢复真实参数发送后通过。
- 管理端和共享 Vite 配置的 `vue-tsc --noEmit`：退出码 0。
- 修改文件 ESLint：退出码 0。
- 共享 Vite 配置 tsdown 构建、管理端 Vite 生产构建：退出码 0。生产构建保留一条 Ant Design Vue 既有的动态导入分包提示。
- 真实 Playwright：10 组验收通过，`errors=[]`，退出码 0；所有观察到的 API 响应均为 HTTP 200 或 204。覆盖关键词、状态、组合筛选、重置和原有会话验收。
- `git diff --check`：通过。

源码排查命令（均无匹配）：

```powershell
rg -n -i 'mock|fixture|route\.fulfill|page\.route|context\.route' apps/admin/src apps/admin/e2e internal/vite-config/src internal/vite-config/package.json --glob '!**/__tests__/**'
rg -n -i 'nitropack|backend-mock' pnpm-lock.yaml pnpm-workspace.yaml internal/vite-config
```

## 复现

后端保持运行；在第一个终端启动前端：

```powershell
pnpm --dir apps/admin dev --host 127.0.0.1 --port 5666 --strictPort
```

在第二个终端设置 `FE1_ADMIN_PASSWORD` 和 `FE1_SALES_PASSWORD` 为提供的真实账号密码，然后运行：

```powershell
pnpm --dir apps/admin test:e2e
pnpm --dir apps/admin test:unit
pnpm --dir apps/admin typecheck
pnpm --dir apps/admin build
```

默认用户名为 admin、sales01，前端地址默认为 `http://127.0.0.1:5666`。可用 `FE1_ADMIN_USERNAME`、`FE1_SALES_USERNAME`、`FE1_ORIGIN` 覆盖。Windows 默认使用已安装的 Chrome；可用 `FE1_CHROME_EXECUTABLE` 指定浏览器路径。其他平台默认使用 Playwright Chromium。

## 证据

- [真实网络与断言结果](./evidence/browser-results.json)
- [真实用户列表截图](./evidence/users.png)
- [关键词 sales 返回两条](./evidence/search-sales.png)
- [关键词 sales01 返回一条](./evidence/search-sales01.png)
- [disabled 状态空结果](./evidence/status-disabled.png)
- [sales01 空菜单截图](./evidence/sales01.png)
- [登录页](./evidence/login.png)

## 既有依赖安装限制

当前环境提供 pnpm 11.25.0，项目声明 pnpm 11.16.0。执行 `install --lockfile-only --ignore-scripts --frozen-lockfile --offline` 会报 `ERR_PNPM_OUTDATED_LOCKFILE`。已把修改前 HEAD 的完整工作区依赖清单和锁文件复制到独立临时目录，使用同一命令确认也报相同错误；此问题在本次修改前已存在。

普通离线重算还会因缺少 vite 的 registry 元数据而失败。因此本次仅按锁定依赖图裁剪 Nitro 独占分支，校验所有保留快照仍可解析、内容不变，并保留原锁文件格式；未升级其他包。当前安装依赖下的类型检查、测试和生产构建均已通过。
