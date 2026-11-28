# FE-IDN-020 · API 网关控制台

- ID: FE-IDN-020
- 类型: 新增
- 仓库: 前端
- 状态: 前端实现与验收已完成，第 4 项部分符合；客户端元数据编辑已按 BE-IDN-034 补齐
- 预计: 3 人日
- 分支: `feat/fe-idn-020-gateway-console`
- 依赖: BE-IDN-029（已合并）
- 依据: `docs/design/api-gateway-console.md`

---

## 1. 后端接口（已实现，注意响应形状不同）

### 1.1 客户端（返回**数组**，无分页）

```
GET  /api/v1/admin/api-clients          → data: [ {id, app_id, name, owner_user_id, status, version, ip_whitelist} ]
POST /api/v1/admin/api-clients          { name, owner_user_id, ip_whitelist } → 创建状态固定为 active，传入 status 当前被忽略
PUT  /api/v1/admin/api-clients/{id}     { name?, ip_whitelist?, status?, version }
                                         → version 必填；缺失字段不变；ip_whitelist: [] 清空
```

字段校验：

| 字段 | 规则 |
| --- | --- |
| `name` | 创建时必填，≤100；更新可选，trim 后非空且 ≤200 |
| `owner_user_id` | 创建时必填，必须本租户有效用户 |
| `ip_whitelist` | 创建/更新可空；IP 或 CIDR；`0.0.0.0/0`、`::/0` 拒绝；`[]` 清空 |
| `status` | 创建默认 `active`；更新可选 `active` / `suspended` |
| `version` | 更新时必传（乐观锁），取列表里的值；冲突返回 409/10409 |

### 1.2 密钥

```
GET    /api/v1/admin/api-clients/{id}/secrets          → data: [ {id, secret_prefix, status, expires_at, last_used_at} ]
POST   /api/v1/admin/api-clients/{id}/secrets          { overlap_seconds? } → 创建，**只返回一次明文**
DELETE /api/v1/admin/api-clients/{id}/secrets/{sid}    → 吊销
```

明文在创建响应出现一次；之后可通过 `GET .../secrets/{sid}/reveal` **随时查看**
（BE-IDN-031）。UI 提供「查看」按钮 + 二次确认 + 显示后 60 秒自动隐藏。

### 1.3 路由（返回**数组**，无分页）

```
GET  /api/v1/admin/api-routes      → data: [ {id, code, name, capability, method, path,
                                             route_group, visibility, status, billing_mode,
                                             version, price_cents, units_per_call, currency} ]
POST /api/v1/admin/api-routes      { code, name, capability, method, path,
                                     route_group, visibility, billing_mode,
                                     price_cents, units_per_call, currency }
PUT  /api/v1/admin/api-routes/{id} 同上 + version
```

| 字段                             | 取值                                   |
| -------------------------------- | -------------------------------------- |
| `method`                         | GET / POST / PUT / DELETE              |
| `path`                           | 以 `/open/` 开头，如 `/open/v1/orders` |
| `visibility`                     | `public` / `internal`                  |
| `billing_mode`                   | `free` / `metered` / `subscription`    |
| `price_cents` / `units_per_call` | `metered` 时必填且 > 0                 |
| `capability`                     | 能力标识，如 `orders.read`             |

`code` 创建后不可改（被授权与日志引用）。

### 1.4 授权与配额

```
GET    /api/v1/admin/api-clients/{id}/routes   → 已有授权（含 route_code/name/method/path、配额、状态）
POST   /api/v1/admin/api-clients/{id}/routes   { route_id, status, expires_at, quota_daily, quota_monthly }
DELETE /api/v1/admin/api-clients/{id}/routes/{grant_id}   → 204 撤销
GET    /api/v1/admin/api-clients/{id}          → 单个客户端
```

授权抽屉打开时必须先拉 `GET .../routes` 回显已勾选项与配额（BE-IDN-033）。

- `quota_*` 为 0 表示不限
- 同一客户端同一路由只有一条授权（重复提交按更新处理）

### 1.4.1 网关信息（BE-IDN-032）

```
GET /api/v1/admin/gateway/info
→ data: { public_base_url, allowed_origins }
```

用于客户端页展示调用示例：`{public_base_url}/open/v1/usage`。
**只读**——域名由部署配置决定，界面不提供修改入口。

### 1.5 调用日志与统计（新增）

```
GET /api/v1/admin/api-calls?client_id=&route_id=&status=&from=&to=&trace_id=&page=&page_size=
    → data: { list:[{id, client_name, route_code, method, path, status_code,
                     latency_ms, billing_mode, cost_units, cost_cents, error_code,
                     called_at, trace_id, state}], total, page, page_size }
    默认最近 24h；范围最大 30 天（超限 400）

GET /api/v1/admin/api-calls/summary?from=&to=&group_by=client|route|day
    → data: { total_calls, items:[{key, calls, success_rate, p95_latency_ms, cost_cents}] }
```

### 1.6 在线试调（新增）

```
POST /api/v1/admin/api-clients/{id}/try
     { route_id, query?, body? }
  → data: { status_code, latency_ms, response, truncated,
            billing: {mode, units, billed} }
```

- 真实鉴权链；`billed=false`
- 响应 >256 KB 截断
- 未授权路由返回 `status_code=403`、`error_code=80104`

## 2. 页面

菜单：「系统 → API 网关」（`/system/gateway`），或独立一级菜单「开放平台」。

建议一级菜单：

```
开放平台 /open-platform  (dir)
├ API 客户端   /open-platform/clients     gateway/client/list
├ 路由        /open-platform/routes      gateway/route/list
├ 调用日志    /open-platform/calls       gateway/call/read
└ 用量统计    /open-platform/usage       gateway/call:read
```

### 2.1 客户端

列表：名称 / AppID / 状态 / 最近调用 / 操作（编辑、密钥、授权、试调）

- 新建后自动生成 `app_id`，展示并提示「请记录」
- 编辑抽屉支持名称、IP 白名单和状态更新。保存带列表行的 version，409/10409 提示冲突并刷新列表；清空非空白名单前需确认「清空后将允许所有 IP」。
- 「密钥」抽屉：列表显示前缀 + 「查看」按钮（可随时取明文）+ 「生成新密钥」
  支持双密钥过渡（`overlap_seconds`）
- 「授权」抽屉：勾选路由（只列 `visibility=public`），设置每日/每月配额与过期时间
- 「试调」：见 2.4

### 2.2 路由

列表：code / 名称 / 方法 + 路径 / 计费模式 / 可见性 / 状态 / 操作

- 新建/编辑弹窗：按 1.3 的字段与校验
- `billing_mode=metered` 时显示价格与单位（分/次）
- 编辑时传 `version`（并发冲突提示「已被他人修改，请刷新」）

### 2.3 调用日志与统计

**日志**

```
筛选：客户端 / 路由 / 状态（成功·失败） / 时间范围（默认 24h） / trace_id
```

列：时间 / 客户端 / 路由 / 方法+路径 / 状态码 / 耗时 / 计费 / 费用

详情抽屉：trace_id（可复制）、状态码、耗时、错误码、计费明细、state。

**统计**

- 时间范围 + 分组（客户端 / 路由 / 日期）
- 表格：调用量、成功率、P95、费用
- 空态：「所选范围内没有调用」

### 2.4 试调

```
客户端 [已选]   路由 [下拉：该客户端已授权的 public 路由]
Query  [key=value 多行]    Body [JSON 编辑器]
[发送]  → 结果：状态码 / 耗时 / 响应体（只读）
```

- 明确标注「测试调用：不计费，但会记录日志」
- 响应体超长提示已截断
- 失败时展示 `status_code` 与 `error_code`，不显示为前端异常

## 3. 验收

| #   | 项         | 断言                                                |
| --- | ---------- | --------------------------------------------------- |
| 1   | 客户端列表 | 显示 app_id/状态/最近调用；空态正确                 |
| 2   | 新建客户端 | 成功后 app_id 可见                                  |
| 3   | 密钥       | 创建后显示完整 secret 并可复制；关闭后列表只剩前缀  |
| 4   | 密钥吊销   | 吊销后状态变化，再次吊销/使用返回失败               |
| 5   | 路由       | 新建 metered 路由（价格/单位）成功，列表回显        |
| 6   | 路由校验   | 非 `/open/` 开头 400；metered 缺价格 400            |
| 7   | 授权       | 勾选路由 + 配额保存成功，重开回显；可撤销并即时消失 |
| 8   | 调用日志   | 筛选与分页正确；trace 精确查询命中                  |
| 9   | 时间范围   | 默认 24h；选 31 天提示超限                          |
| 10  | 统计       | 三种分组切换正确，成功率与 P95 有值                 |
| 11  | 试调成功   | 返回 200 与响应体，提示「不计费」                   |
| 12  | 试调失败   | 未授权路由显示 403/80104，不报前端错误              |
| 13  | 权限       | 无 `gateway:*` 时菜单不可见，直访 403               |
| 14  | 调用示例   | 客户端页示例 URL 与 gateway/info 返回一致           |
| 15  | 构建       | lint / typecheck / unit / build 全绿                |

## 4. 不做

- 请求/响应体留存
- 计费账单页面（后续）
- 路由版本历史

## 5. Codex prompt

```
实现 docs/tasks/FE-IDN-020.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-020-gateway-console（从最新 main 0887e4f 开）

后端已合并（cf589bf，含 BE-IDN-033）：
  clients / routes 返回数组（无分页）
  calls / summary 返回分页与聚合
  try 返回 status_code/latency_ms/response/truncated/billing
  api-clients/{id}/routes 支持读取、upsert 和撤销
  reveal 可随时查看密钥，需二次确认并在 60 秒后隐藏
  客户端创建状态固定为 active，更新接口当前只支持状态

必读：本卡、docs/design/api-gateway-console.md、
apps/admin/src/views/system/（列表页与抽屉写法）、
api/core/ 模式

改动：
1. 开放平台菜单：客户端 / 路由 / 调用日志 / 统计
2. 客户端：列表、新建、编辑、密钥抽屉（一次性明文）、授权抽屉（配额）、试调
3. 路由：列表、新建/编辑（metered 价格校验，版本乐观锁）
4. 调用日志：筛选 + 详情抽屉；统计：三种分组
5. 试调：选路由 + 参数 + 实时响应，标注不计费

约束：
- 密钥可随时查看（调用 reveal 接口），但需二次确认并在 60 秒后自动隐藏
- 不做请求/响应体留存
- 权限码沿用 gateway:*

验收按卡片 §3 十五条逐条贴证据；第 3、8、11、14 条要截图。
完成后停下报告，并按 AGENTS §7 清理测试数据。
```

## 早期实施记录（2026-11-26）

当时四个页面的 API、校验和权限映射已完成，但授权读取接口、真实登录验收和四张截图仍待处理。该阶段没有创建验收数据。

## 实施与验收记录（2026-11-28）

授权回显、撤销和试调已按 BE-IDN-033 实现。真实环境完成 15 项逐项验收，第 3、8、11、14 项截图及完整结果见[验收记录](../evidence/fe-idn-020/acceptance.md)。第 4 项记录为部分符合，因后端重复吊销仍返回 200。

此前端实现阶段后端只支持更新客户端状态与版本，因此名称和 IP 白名单当时只读。创建接口仍固定创建为 active，因此新建表单不显示无效的状态选项。

清理命令已执行并复核为零：`go run ./scripts/cleanup/fe-idn-020 delete`。临时清理脚本已移除。

## 客户端元数据编辑收尾（2026-11-28）

后端 BE-IDN-034 `1b1602a` 已支持按 version 乐观锁更新 name、ip_whitelist、status。编辑抽屉现开放名称和白名单输入，提示 IP/CIDR 格式；将非空白名单清空时先确认清空后会允许所有 IP。提交包含列表行 version；HTTP 409 或业务码 10409 显示「已被他人修改，请刷新」、重新加载客户端列表并保留抽屉以便查看提示。成功保存复用列表刷新事件，后端规范化后的白名单会在列表重载后回显。

该收尾的 API、错误映射及抽屉定向测试共 17 项通过。完整 lint、typecheck、unit 与 build 结果见本轮最终检查。
