# FE-IDN-020 API 网关控制台实施计划

**目标：** 在 `apps/admin` 实现 API 客户端、路由、调用日志与用量统计四个动态菜单页，并满足任务卡 15 条验收。

**架构：** API 模型和请求集中在 `apps/admin/src/api`。四个页面位于 `apps/admin/src/views/open-platform/`，客户端页用抽屉承载客户端编辑、密钥、授权和试调。动态菜单继续由后端驱动，前端只注册允许的组件映射并使用现有权限门禁。

**技术栈：** Vue 3、TypeScript、Ant Design Vue、Vben `Page`、`requestClient`、Vitest、Playwright。

**设计：** `docs/design/api-gateway-console.md`，方案一已由用户确认。

## 全局约束

- 不修改 `packages/**`。
- API 使用 `/api/v1/admin` 相对路径，不硬编码后端域名。
- 不新增静态业务路由，页面从后端动态菜单加载。
- 密钥明文仅保存在组件内存，展示 60 秒后清空，不写入 localStorage、URL 或日志。
- 不保留试调请求体或响应体。
- 所有列表页分别呈现加载、空、错误和正常状态。
- 日期展示本地时间，API 使用 RFC3339 UTC；金额存分并换算展示。
- 授权读取与撤销使用 BE-IDN-033 的 `/api-clients/{id}/routes` 契约；客户端创建响应保持 `{ client, key }` 嵌套形状。
- 试调路由只从当前客户端的有效 active 授权中生成，提交授权项的 `route_id`。
- 路由使用后端 wire 枚举 `status=enabled|disabled`、`billing_mode=free|per_call`，按量计费映射到 `per_call`，capability 与 code 必须匹配后端注册项。
- 客户端元数据更新遵循 BE-IDN-034 的可选字段和必填 version 契约；空白名单确认后以 `[]` 清空。
- 密钥明文只在当前弹窗内存保留，60 秒后清空；不写浏览器存储、URL 或日志。

---

### 任务 1：网关 API 模型与请求

**文件：**

- 新建 `apps/admin/src/api/model/gateway.ts`
- 新建 `apps/admin/src/api/core/gateway.ts`
- 新建 `apps/admin/src/api/__tests__/gateway.test.ts`

- [x] 定义客户端、密钥、路由、授权、调用日志、统计、试调及网关信息类型，显式区分扁平列表客户端和 `{ client, key }` 创建响应。
- [x] 封装客户端列表/详情/创建/状态更新、密钥创建/吊销/reveal、路由、授权列表/upsert/撤销、调用、摘要、试调和 gateway/info 请求。
- [x] 用 mock `requestClient` 验证数组/分页/嵌套创建响应的类型、授权路径与 payload、204 撤销、试调 payload 与 409 原始错误传播。
- [x] 运行 `pnpm --filter @vben/web-antd test:unit -- src/api/__tests__/gateway.test.ts`，6 项通过。

### 任务 2：客户端及其抽屉

**文件：**

- 新建 `apps/admin/src/views/open-platform/clients/index.vue`
- 新建 `apps/admin/src/views/open-platform/clients/client-form-drawer.vue`
- 新建 `apps/admin/src/views/open-platform/clients/secrets-drawer.vue`
- 新建密钥状态 helper 与单测

- [x] 客户端列表显示名称、AppID、状态和最近调用时间，支持刷新、错误重试与空态。
- [x] 新建支持名称、用户和 IP 白名单；按嵌套响应展示 AppID 与首次密钥。新建默认为 active，因为后端忽略创建请求中的 status。
- [x] 初版在 BE-IDN-034 尚未合并时仅开放状态更新；FE-IDN-020 客户端编辑收尾现已启用名称和 IP 白名单更新。
- [x] 密钥抽屉显示前缀和状态；创建/查看都二次确认，明文支持复制并在关闭、卸载、60 秒超时后清空。
- [x] 授权抽屉加载 public 路由与客户端既有授权，回显勾选、状态、每日/月配额及有效期；保存用 POST upsert，撤销用 grant `id` DELETE 并即时移除。
- [x] 试调表单只从该客户端 status=active 且未过期的授权项生成路由选项，提交对应 `route_id`，解析 key=value 查询行与 JSON body，即时显示状态码、耗时、响应、截断和计费结果，并标注不计费。
- [x] 单测覆盖授权请求、有效授权路由筛选、secret 超时清理、查询解析、JSON 校验和 403/80104 业务响应。

### 任务 3：路由列表与编辑

**文件：**

- 新建 `apps/admin/src/views/open-platform/routes/index.vue`
- 新建 `apps/admin/src/views/open-platform/routes/route-form-drawer.vue`
- 新建路由校验 helper 与单测

- [x] 显示 code、名称、方法/路径、计费、可见性和状态，支持空态、加载、错误重试。
- [x] 创建/编辑实现后端登记 capability；code 与 capability 一致，路径必须以 `/open/` 开头；`per_call` 价格和单位必须为正整数；code 在编辑时禁用。
- [x] 更新提交原 `version`；HTTP 409 显示「已被他人修改，请刷新」。
- [x] 单测覆盖路径校验、价格/单位边界与冲突文案映射。

### 任务 4：调用日志与统计

**文件：**

- 新建 `apps/admin/src/views/open-platform/calls/index.vue`
- 新建 `apps/admin/src/views/open-platform/calls/call-detail-drawer.vue`
- 新建 `apps/admin/src/views/open-platform/usage/index.vue`
- 新建日期、调用范围 helper 与单测

- [x] 日志按客户端、路由、成功/失败、时间和 trace ID 筛选，默认最近 24 小时，服务器分页，trace ID 精确查询。
- [x] 拒绝超过 30 天的时间范围并显示可理解错误，不发送请求。
- [x] 日志详情展示可复制 trace ID、状态码、耗时、错误码、计费和 state，不请求或展示请求/响应体。
- [x] 统计页支持 client、route、day 三组，显示调用量、成功率、P95 和费用，按本地时间展示日期、按分换算金额。
- [x] 两页均呈现加载、空、错误和正常状态；空统计显示「所选范围内没有调用」。

### 任务 5：动态菜单映射、全量验证与证据

**文件：**

- 修改 `apps/admin/src/router/component-registry.ts`
- 修改/新建 `apps/admin/src/router/__tests__/menu-permissions.test.ts`
- 更新 `docs/evidence/fe-idn-020/acceptance.md` 并生成四张指定截图
- 修改 `docs/tasks/FE-IDN-020.md` 验收记录

- [x] 将四个动态菜单组件映射到实际页面，不创建静态路由。
- [x] 单测验证缺少对应 `gateway:*` 权限时动态菜单不可见；四个页面均使用 `Forbidden` 门禁。
- [x] 运行前端 lint、typecheck、相关单测、完整 unit 和 `pnpm run build:antd`，结果见验收记录。
- [x] 登录真实 API 完成 15 条逐项验收，第 3、8、11、14 项截图已保存，第 4 项按后端重复 DELETE 返回 200 记录为部分符合。
- [x] 清理本卡创建的客户端、密钥、路由、授权和调用日志测试数据，并记录删除数与复核结果。
- [x] 检查无空实现、敏感信息、格式问题和无关源码改动，并记录验收阻塞。工作树另有 `AGENTS.md` 与设计稿格式变更，已保留。

## BE-IDN-033 实施记录（2026-11-28）

设计稿第 6 节按确认的「四页面 + 客户端抽屉」补齐授权回显、幂等保存、撤销、有效授权试调、失败态和安全边界。后端仓库 `D:\code\go-admin-api` 的 `main` 与 `origin/main` 同步，HEAD `370f989` 包含 `cf589bf`。

按以下顺序实施完成，先更新 API 类型与封装，再恢复授权/试调抽屉，最后完成真实浏览器验收、截图与数据清理。

1. 更新网关 API 模型与请求，覆盖客户端授权读取、upsert、撤销与试调契约，并补定向单测。
2. 完成授权抽屉的读取回显、配额编辑、保存、撤销及加载/错误/空态。
3. 完成试调路由筛选、请求参数解析、业务失败响应展示和不计费标记。
4. 执行 lint、类型检查、定向单测、全量 unit 与构建，修复回归。
5. 用本地真实 API 完成 15 项验收并保存指定截图，按 AGENTS §7 清理测试数据并复核。

## BE-IDN-034 客户端编辑收尾（2026-11-28）

后端 `1b1602a` 支持可选的 name、ip_whitelist、status 和必填 version。前端编辑表单启用名称与白名单输入，空白名单通过确认后传空数组。收到 HTTP 409 或业务码 10409 时保留抽屉提示冲突并刷新列表；保存成功也刷新列表以读取规范化后的 IP 值。
