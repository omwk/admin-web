# FE-IDN-020 验收记录

验收时间：2026-11-28 03:48–03:50（Asia/Shanghai）  
前端分支：`feat/fe-idn-020-gateway-console`  
后端：`D:\code\go-admin-api` 的 `main`，HEAD 为 `370f989`，包含 BE-IDN-033 `cf589bf`  
环境：本地管理端与 `http://127.0.0.1:18080`，租户 `default`

真实环境运行记录见 [acceptance-runtime.json](acceptance-runtime.json)。第 3、8、11、14 项截图均已保存。

## 15 项验收

| # | 项目 | 结果与证据 |
| --- | --- | --- |
| 1 | 客户端列表 | 通过。真实页面显示名称、AppID、状态和最近调用时间，客户端列表可加载。 |
| 2 | 新建客户端 | 通过。真实创建响应按嵌套 `{ client, key }` 读取，AppID 与首次密钥可见并可复制。 |
| 3 | 密钥 | 通过。Reveal 前二次确认，明文只在弹窗显示并可复制，60 秒自动隐藏。截图已遮挡密钥明文。[03-secret.png](03-secret.png) |
| 4 | 密钥吊销 | 部分符合。吊销后状态为 revoked，界面禁用重复吊销，吊销后 reveal 返回 404。后端重复 DELETE 返回 200，与卡片要求的再次吊销失败不同。 |
| 5 | 路由 | 通过。`per_call` 路由价格 5 分、每次 2 单位可回显，旧版本更新返回 409 并显示刷新提示。验收复用了此前中断运行留下的专用验收路由。 |
| 6 | 路由校验 | 通过。非 `/open/` 路径和缺少按量价格的请求均由后端返回 400。 |
| 7 | 授权 | 通过。保存路由与每日/月配额，重新打开回显，DELETE 204 后立即从列表移除。 |
| 8 | 调用日志 | 通过。客户端、路由、状态、时间和 trace 筛选及分页生效，trace 精确查询命中，详情不展示请求/响应体。截图已保存。[08-calls.png](08-calls.png) |
| 9 | 时间范围 | 通过。默认 24 小时，31 天范围被拒绝并显示提示。 |
| 10 | 统计 | 通过。client、route、day 三种分组均返回非空汇总，页面显示调用量、成功率、P95 和费用。 |
| 11 | 试调成功 | 通过。使用已 seed 的 `usage.read` 路由，`route_id=1`，返回 200 和响应体，`billed=false`。截图已保存。[11-try.png](11-try.png) |
| 12 | 试调失败 | 通过。未授权路由作为业务结果显示 403 和 `80104`，页面保持可用。 |
| 13 | 权限 | 通过。网关菜单权限过滤单测验证缺少 `gateway:*` 时菜单不可见，四个页面使用 `Forbidden` 门禁。真实会话使用管理员账号。 |
| 14 | 调用示例 | 通过。示例 URL 由 `gateway/info.public_base_url` 拼接，与接口返回一致。截图已保存。[14-example.png](14-example.png) |
| 15 | 构建与检查 | 通过。lint、类型检查、全量单测、定向单测和构建结果见下方检查记录。 |

## 原始验收时记录的后端契约差异

- 当前 `POST /admin/api-clients` 创建客户端时固定为 active，传入的 `status` 不生效。新建表单不再展示无效的状态选择。
- 当前 `PUT /admin/api-clients/{id}` 只更新状态与版本，名称和 IP 白名单字段被静默忽略。编辑表单保留名称和白名单只读回显，只允许修改状态。后端任务 BE-IDN-034 仍待实现，名称与 IP 白名单编辑需其支持后再启用。
- 密钥吊销后界面阻止重复操作，后端重复 DELETE 仍返回 200；reveal 返回 404。第 4 项据此记录为部分符合。

BE-IDN-034 已消除名称与 IP 白名单更新差异，编辑实现及本轮自动化证据见下方「客户端编辑收尾」。

## 检查记录

- `pnpm lint`：通过，格式检查覆盖 1,734 个文件。
- `pnpm check:type`：通过，38 个 workspace task。
- `pnpm test:unit`：通过，173 个测试文件、1,251 项通过。Vitest 报告一个既有 `use-sortable.test.ts` mock hoisting 警告。
- 定向单测：通过，`gateway.test.ts` 与 `menu-permissions.test.ts` 共 16 项。
- `pnpm run build:antd`：通过，11 个 task。
- 密钥安全检查：网关页面/API 未发现 localStorage、sessionStorage 或 console 日志写入；试调体不进入持久存储或 URL。
- `packages/**` 未修改。

## 数据清理

已清理：`go run ./scripts/cleanup/fe-idn-020 delete` → `commercehub_test` 删除 4 个验收客户端、1 条验收路由、4 条调用、4 条密钥和 37 条审计记录。前置预览确认目标路由没有外部授权或调用引用。清理后再次 dry-run，客户端、路由及关联数据均为 0。临时清理脚本已从后端工作区移除。

## 客户端编辑收尾（BE-IDN-034，2026-11-28）

后端 `1b1602a` 支持按客户端 version 更新名称、白名单和状态。客户端编辑抽屉已启用名称与 IP/CIDR 输入，清空原有白名单前显示「清空后将允许所有 IP」确认，确认后提交 `ip_whitelist: []`。版本冲突（HTTP 409 或业务码 10409）提示「已被他人修改，请刷新」并刷新客户端列表。成功保存后同样刷新列表，以回显后端规范化白名单。

自动化定向验收：`gateway.test.ts`、`gateway-error.test.ts`、`client-form-drawer.test.ts` 共 17 项通过，覆盖更新 payload 与 version、空数组清理、清空确认/取消、冲突提示与刷新事件、名称/IP 可编辑。真实 API 下改名及 CIDR 规范化尚未在本轮浏览器环境重复操作。

收尾代码验证：`pnpm lint` 通过，格式检查覆盖 1,736 个文件；`pnpm check:type` 38 个任务通过；`pnpm test:unit` 174 个文件、1,256 项通过；`pnpm run build:antd` 11 个任务通过；`git diff --check` 通过。Lint 输出六条既有的图标名警告，Vitest 输出既有 sortable mock hoisting 警告。
