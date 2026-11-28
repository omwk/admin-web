# API 网关控制台 · 现状与分阶段计划

- 日期：2026-11-23
- 决定：**两个方向都要，先对外后对内**
  1. 对外：别人调我们（`api_clients` / `api_routes` / 配额 / 计费 / 调用日志）
  2. 对内：我们调别人（平台/接口定义、调试、字段映射）
- 国外平台（Shopee 等）优先级最后，先不接真实业务

---

## 1. 现状盘点

### 1.1 对外网关（后端已有，缺界面与观测）

| 能力 | 后端 | 说明 |
| --- | --- | --- |
| 客户端 | ✅ 列表 / 创建 / 更新 | `api_client`：app_id、状态、IP 白名单 |
| 密钥 | ✅ 列表 / 轮换 / 删除 | `api_client_secret`，支持双密钥过渡 |
| 路由 | ✅ 列表 / 创建 / 更新 | `api_route`：code、方法、路径、版本、计费模式、价格 |
| 授权 | ✅ 绑定路由 / 解绑 / 配额 | `api_client_route` + 每日/每月配额 |
| 签名 | ✅ v1 / v2 | 鉴权、防重放 |
| 调用执行 | ✅ | 配额预留、幂等、计费、结果指纹 |
| 用量查询 | ✅ 客户端侧 | `GET /open/v1/usage` |
| 计费与对账 | ✅ | `api_call_meter`、`open_billing`、`reconcile` |
| **管理端调用日志** | ❌ | 表 `api_call_log` 有数据，无查询接口 |
| **管理端用量统计** | ❌ | 无按客户端/路由/日聚合 |
| **在线试调** | ❌ | 只能在外部用 curl 调 |

### 1.2 对内接入（后端仅 Shopee 硬编码）

| 能力                  | 现状                                                 |
| --------------------- | ---------------------------------------------------- |
| 平台元数据            | `platform` 表 3 条（shopee/taobao/shopify），无 CRUD |
| 平台适配器            | 仅 Shopee 有代码；taobao/shopify 只有记录            |
| API 定义（任意 HTTP） | ❌ 无                                                |
| 在线调试              | ❌ 无                                                |
| 调用日志              | 仅 ingestion 原始报文，无「接口调用」视角            |
| 字段映射              | 有 mapping profile（商品/订单），但绑定平台代码      |

---

## 2. 阶段一：对外网关控制台

### 2.1 后端补三块

**A. 管理端调用日志查询**

```
GET /admin/api-calls
  ?client_id=&route_id=&status=success|failed&from=&to=&page=&page_size=
→ { list:[{ id, client_name, route_code, method, path, status_code,
            latency_ms, billing_mode, cost_units, error_code, called_at,
            trace_id, state }], total }
```

- 默认最近 24 小时；最多查 30 天
- 不含请求体/响应体（隐私）
- 支持按 trace_id 精确查

**B. 用量与质量统计**

```
GET /admin/api-calls/summary?from=&to=&group_by=client|route|day
→ { items:[{ key, calls, success_rate, p95_latency_ms, cost_cents }], total_calls }
```

**C. 在线试调**

```
POST /admin/api-clients/{id}/try
{ "route_id": 3, "method": "GET", "path": "/open/v1/orders",
  "query": {"page":"1"}, "body": null }
→ { "status_code": 200, "latency_ms": 42, "response": {...},
    "billing": { "mode": "metered", "units": 1, "billed": false } }
```

要求：

- 以该客户端的真实鉴权链执行（签名、配额、白名单都生效）
- 标记 `test=true`：**不写入计费**，但写入调用日志（`charge_source=manual_test`）
- 响应体截断 256KB，超长提示
- 只能试调已授权给该客户端且在 `visibility=public` 的路由
- 权限 `gateway:client:manage`（新增或复用）

### 2.2 前端控制台

```
API 网关
├ 客户端      列表 / 新建 / 启停 / IP 白名单 / 密钥轮换（一次性展示）
├ 路由        列表 / 新建 / 编辑 / 版本 / 计费模式与价格
├ 授权与配额  某客户端 → 勾选路由 + 每日/每月配额 + 过期时间
├ 调用日志    筛选（客户端/路由/状态/时间）+ 详情抽屉（trace_id、耗时、计费）
├ 统计        按客户端 / 路由 / 日期；成功率、P95、费用
└ 试调        选客户端 + 选路由 + 参数 → 实时响应与耗时
```

关键交互：

- 密钥创建后**只展示一次**，关闭即不可再取（现状后端如此）
- 路由 `code` 创建后不可改（被授权与日志引用）
- 配额 `0` 表示不限，UI 要说清
- 试调结果标注「测试调用，不计费」

## 3. 阶段二：对内 API 接入（后续设计）

先只定方向，不做卡片：

```
概念：API 定义（base URL + 认证 + 超时/重试）→ 端点（方法/路径/参数/响应映射）
      → 调试（发真实请求，看响应与耗时）→ 日志（调用记录、成功率）
      → 被业务模块引用（店铺同步、订单拉取）
```

与阶段一的关系：阶段一的签名/日志/重放等基础设施可复用（调用日志模型、trace、脱敏）。

## 4. 交付顺序

| 顺序 | 卡片                          | 端     | 人日 |
| ---- | ----------------------------- | ------ | ---- |
| 1    | BE-IDN-029 网关日志/统计/试调 | 后端   | 1    |
| 2    | FE-IDN-020 网关管理控制台     | 前端   | 3    |
| 3    | （阶段二设计）                | 文档   | 0.5  |
| 4    | 对内 API 接入                 | 前后端 | 待估 |

## 5. 如何新增一个对外 API

1. 后端实现 `/open/v1/xxx` 处理器，在 `gateway.Capabilities()` 登记 code、方法、路径模板和路由分组，并注册到独立 open 分发链。数据库中的路由只能配置已实现的能力，不能转发到任意 URL。
2. 在管理端「开放平台 → 路由」新建路由，填写 code、capability、方法、路径、分组、可见性和计费模式；需试调的路由设为 `public` 并启用。收费路由同时设置价格、每次用量与币种。
3. 创建或选择 API 客户端，授权该路由并设置每日／每月配额及有效期；配额 `0` 表示不限。保留客户端的一次性密钥供外部签名调用。
4. 用该客户端的「试调」验证。试调通过真实签名、客户端状态、IP 白名单、路由授权和配额校验，返回响应及耗时；`test=true` 且不计费、不消耗配额，只记录调用元数据。

`go run ./cmd/cli seed` 会为 `tenant.platform_id`（环境变量 `CH_TENANT_PLATFORM_ID`）配置的平台租户补入内置路由 `usage.read`：`GET /open/v1/usage`、`public`、`free`、已启用。按 `(tenant_id, code)` 判断是否已存在，重复 seed 跳过并保留管理员修改。其他路由由管理员按上述步骤添加；seed 不会自动向客户端授权。

## 6. FE-IDN-020 前端实现决策

已确认采用方案一，交付开放平台的客户端、路由、调用日志、用量统计四个动态菜单页面。客户端编辑、密钥、授权和试调作为客户端页的抽屉或弹窗，不新增静态路由。页面组件继续由后端动态菜单提供，前端注册组件映射并沿用 `gateway:*` 权限门禁。

### 6.1 管理端 API 契约

以下路径均相对于管理端 API 前缀 `/api/v1/admin`。

| 操作 | 响应与用途 |
| --- | --- |
| `GET /api-clients` | `data` 是客户端数组。列表项为扁平字段，含 `id`、`app_id`、`name`、`status`、`version`、`ip_whitelist`。 |
| `POST /api-clients` | 请求包含 `name`、`owner_user_id` 与 `ip_whitelist`，`data` 是 `{ client, key }`。当前后端创建状态固定为 `active`，请求中的 `status` 不生效。创建成功后在弹窗内展示 `client.app_id` 和 `key.secret`。 |
| `GET /api-clients/{id}` | 单客户端详情。 |
| `PUT /api-clients/{id}` | BE-IDN-034 支持 `{ name?, ip_whitelist?, status?, version }`。`version` 必填，缺失字段不变，白名单传 `[]` 表示清空；拒绝 `0.0.0.0/0` 与 `::/0`，成功响应包含规范化白名单和递增版本，冲突返回 409/10409。 |
| `GET /api-clients/{id}/routes` | 客户端授权数组，含 `grant_id` 对应的 `id`、`route_id`、路由信息、状态、配额、有效期和版本。已删除路由的 `route_code` 为 `#{route_id}`。 |
| `POST /api-clients/{id}/routes` | 以 `{ route_id, status, expires_at, quota_daily, quota_monthly }` 创建或更新授权。同一路由重复提交为幂等 upsert。 |
| `DELETE /api-clients/{id}/routes/{grant_id}` | 撤销授权，成功响应为 `204`。 |
| `GET /api-routes`、`POST /api-routes`、`PUT /api-routes/{id}` | 路由列表与维护。当前可登记 capability 必须来自后端代码注册表；wire 值使用 `status=enabled | disabled`和`billing_mode=free | per_call`。按量计费对应 `per_call`，价格、单位为正整数，币种为 CNY。 |
| `GET /api-clients/{id}/secrets/{sid}/reveal` | 返回 `{ secret, prefix, expires_at }`。响应禁止缓存，每租户每日最多 20 次，超限显示后端 `429` 错误。 |
| `POST /api-clients/{id}/try` | 以 `{ route_id, query?, body? }` 试调，返回状态码、耗时、响应、截断标记及计费信息。 |
| `GET /gateway/info` | 返回 `{ public_base_url, allowed_origins }`，调用示例 URL 使用返回的 `public_base_url` 拼接。 |

客户端创建响应与列表项形状不同，模型和表单提交必须显式区分这两种结构。客户端和路由列表为数组；调用日志与统计使用各自的分页和聚合响应。

路由 capability、code、method、path 和 route_group 必须与后端注册项完全匹配。当前已登记项为 `order.status` 和 `usage.read`，其余任意路径或 capability 不能通过后端校验。任务卡中的「metered」在前端显示为按量计费，API 使用 `per_call`。

### 6.2 抽屉交互与状态

- 打开授权抽屉时读取该客户端的路由授权，并加载可授权的 public 路由。现有授权按 `route_id` 勾选并回显状态、每日/月配额和过期时间。已删除路由仍展示服务端回退的 `route_code`。
- 保存勾选项时逐项提交授权 upsert。撤销授权使用服务端 `grant_id` 调用 DELETE，成功后立即从当前列表移除。保存部分失败时保留服务端错误并可重试。
- 试调路由选项来自该客户端已授权项，仅保留 `status=active` 且有效期为空或尚未过期的路由，并提交授权项的 `route_id`。试调失败的业务响应仍展示 `status_code` 与后端提供的错误字段，不把 403 当作页面级网络异常。
- 每个页面和抽屉都覆盖加载、空、错误、正常状态。错误展示后端 `message` 并提供重试入口。路由更新遇到版本冲突时提示「已被他人修改，请刷新」。
- 密钥明文仅留在当前弹窗组件内存，关闭或显示满 60 秒即清除。Reveal 需二次确认，失败响应包含 429 时按后端错误展示。不得把密钥写入 URL、浏览器存储或日志。
- 客户端编辑允许修改名称、IP 白名单与状态，提交客户端列表项的 version。遇到 409/10409 时显示「已被他人修改，请刷新」并刷新列表。清空原有白名单前需确认「清空后将允许所有 IP」。新建客户端固定为 active。
- 试调请求体和响应体仅供当前页面查看，不保存到后端以外的前端持久存储，也不进入 URL 或日志。
