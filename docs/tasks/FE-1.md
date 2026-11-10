# FE-1 · 登录与聚合菜单

- 依赖：后端 `v0.M9c`，接口见 `api/openapi/identity.yaml` 与 `docs/api/integration.md`
- 预计：**6–9 人日**
- 分支：`feat/fe-1-auth`
- 完成标志：真实账号登录 → 拉取 `/auth/menus` → 动态生成路由 → 渲染用户只读列表

---

## 1. 范围

| 做 | 不做 |
|---|---|
| 登录页接真实后端 | 注册、找回密码、第三方登录 |
| access/refresh 存储与并发刷新 | 修改后端鉴权逻辑 |
| `/auth/menus` → 动态路由 | 菜单管理 CRUD |
| 权限码工具与按钮级演示 | 完整 RBAC 管理界面 |
| 用户只读列表（分页/筛选） | 用户增删改、角色分配 |

## 2. 后端契约（已确认，勿自行改动）

### 2.1 登录

```
POST /api/v1/auth/login
{ "username": "...", "password": "..." }
```

```json
{ "code": 0, "message": "ok", "trace_id": "…",
  "data": { "access_token": "…", "refresh_token": "…",
            "token_type": "Bearer", "expires_in": 900 } }
```

### 2.2 刷新

```
POST /api/v1/auth/refresh
{ "refresh_token": "…" }
```

- 轮换制：旧 refresh 用后失效
- 并发刷新返回 **`20109`**，表示「刷新正在进行」，前端必须**静默重试**
- 会话失效返回 `20101`

### 2.3 菜单与权限

```
GET /api/v1/auth/menus   (Bearer)
```

- `data.menus`：菜单树，节点含 `id/parent_id/name/type/sort/keep_alive/is_external/meta/children`
- `data.permissions`：当前用户权限码数组（三段式 `module:resource:action`）
- 超管返回全部租户权限码

### 2.4 用户列表

```
GET /api/v1/admin/users?page=1&page_size=20&keyword=&status=
```

- 返回 `data.list / total / page / page_size`
- `page_size` 上限 100

### 2.5 响应信封

统一 `{ code, message, trace_id, data }`；`code = 0` 为成功。前端**按 code 映射文案**，不直接展示 `message`。

## 3. 现有代码与改动点

| 文件 | 现状 | 要改成 |
|---|---|---|
| `apps/admin/.env.development` | `VITE_NITRO_MOCK=true`、`VITE_GLOB_API_URL=/api` | `VITE_NITRO_MOCK=false`；保留 `/api` 并加 Vite 代理 |
| `apps/admin/vite.config.ts` | 无代理 | `/api` → `http://127.0.0.1:8080` |
| `apps/admin/src/api/request.ts` | `responseReturn: 'data'`，无业务码处理 | 响应拦截解信封；错误按 code 映射；注入 Bearer |
| `apps/admin/src/api/core/auth.ts` | 期望 `{ accessToken }`；refresh 走 cookie | 改为 `TokenPair`（snake_case）；refresh 带 `refresh_token` |
| `apps/admin/src/api/core/user.ts` | `GET /user/info` | `GET /auth/me` |
| `apps/admin/src/api/core/menu.ts` | `GET /menu/all` | `GET /auth/menus`，并转换为 vben 的 `RouteRecordStringComponent[]` |
| 新增 `src/api/model/` | — | 与 OpenAPI 对齐的接口类型 |
| 新增 `src/auth/token.ts` | — | access 内存 + refresh sessionStorage |
| 新增 `src/auth/refresh.ts` | — | 并发刷新协调（20109 静默重试） |

## 4. 关键实现要求

### 4.1 并发刷新

- 同一时刻只允许一个刷新请求
- 其余 401 请求排队等待刷新结果，成功后重放原请求
- 收到 `20109` **不得弹错**，按「稍后重试」处理
- 刷新失败（`20101`）→ 清空状态 + 跳登录

### 4.2 菜单 → 路由

- 后端菜单的 `component` 是字符串路径，前端维护「路径 → 组件」注册表
- 未注册的组件路径 → 归到 404，不得白屏
- `type=button` 的节点不进路由，只用权限码

### 4.3 权限判断

- 提供 `hasPermission(code)` 工具，数据源为 `/auth/menus` 返回的 `permissions`
- 演示：用户列表页放一个「新增用户」按钮，无权限时隐藏（**仅作演示，后端仍会拒绝**）

### 4.4 金额与时间

- 本批无金额字段；时间统一 `dayjs` 解析 RFC3339 UTC 后转本地展示

## 5. 验收

| # | 项 | 断言 |
|---|---|---|
| 1 | 登录 | 真实账号登录成功，token 落地，跳转首页 |
| 2 | 菜单渲染 | 侧边栏与后端菜单一致；刷新页面后保持 |
| 3 | 无权限菜单 | 移除某角色菜单后重新登录，该菜单消失 |
| 4 | 未知组件 | 菜单指向未注册组件 → 404 页面，不白屏 |
| 5 | 并发刷新 | 同时触发 5 个接口且 access 过期 → 只发 1 次 refresh，5 个请求全部成功，无错误提示 |
| 6 | 会话撤销 | 后台注销该会话 → 前端下一次请求跳登录 |
| 7 | 用户列表 | 分页、关键词、状态筛选正确；`page_size=200` 被压到 100 |
| 8 | 错误提示 | 401/403/409/429 分别给出正确提示，不展示后端 `message` |
| 9 | 构建 | `pnpm build:antd` 通过；`pnpm typecheck` 通过 |
| 10 | 无回归 | 未接的页面显示占位，不报错 |

## 6. 联调前置

后端需提供：

1. 可登录的测试账号（含 `system:user:list`）
2. 种子数据：≥3 用户、2 角色、完整菜单树
3. 本地后端监听 `127.0.0.1:8080`（Vite 代理目标）

## 7. 风险

| 风险 | 缓解 |
|---|---|
| vben 登录流程内置 mock 逻辑 | 先跑通 `VITE_NITRO_MOCK=false` 下的真实链路，再改 UI |
| 菜单 `component` 与前端注册表不匹配 | 先打印一次真实菜单树，逐个对齐后再写映射 |
| 刷新轮换导致多标签页互相踢下线 | 本批接受；多标签协调放 FE-2 |
