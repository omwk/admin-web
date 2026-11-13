# SF-4 验收证据

分支：`feat/sf-4-system-config`。实测时间：2026-11-14（Asia/Shanghai）。前端 `http://127.0.0.1:5666`，真实后端 `http://127.0.0.1:18080`。

按最新要求验收四组 14 项（security 6、system 3、notification 2、sync 3），覆盖任务卡 §5 第 7 项旧的“三组 11 项”口径。

## 实现

- 字典页：系统/业务两个可折叠分组，真实项数，右侧分页表格，业务字典及项 CRUD，删除确认；系统项仅开放标签与排序。
- 配置页：根据后端 schema 渲染数字、枚举、布尔、文本及 JSON 控件，显示描述、默认值、范围、生效提示；只提交变更的可写字段。
- 使用精确权限码控制菜单与写操作，缺少查看权限时直达显示 403。当前后端未投影的两个菜单由前端按 API 权限补齐，已有投影不重复添加。
- 字典写入保留后端业务文案；商品列表/详情、用户列表/表单、字典状态从 `/meta/dicts/{type}` 取文案，未知值展示原值。修改字典后通知已挂载的消费页面刷新。

## §5 逐条验收

完整断言、HTTP 状态、错误原文、trace ID、当前配置值、清理结果见 [real-ui.json](./real-ui.json)。浏览器运行记录见 [real-ui-run.txt](./real-ui-run.txt)。

| # | 验收项 | 结果与证据 |
| --- | --- | --- |
| 1 | 字典分组 | 真实 scope：系统 2 类、业务 1 类；`user_status` 3 项、`sync_run_status` 4 项、`order_status` 6 项，均与 item page.total 一致。[截图](./01-groups-real.png) |
| 2 | 系统字典只读 | `user_status` 无新增项、删除项及删除类型按钮；编辑时值、状态、颜色禁用，标签/排序可改。直调后端新增 400，删除 409「系统字典项不可删除」。[截图](./02-system-restrictions-real.png) |
| 3 | 业务字典 CRUD | `order_status` 新增/编辑/删除项返回 201/200/204，另验证取消删除；专用业务字典类型新增/编辑/删除同样为 201/200/204。[项编辑截图](./03-business-item-edited-real.png)、[类型编辑截图](./03-business-type-edited-real.png) |
| 4 | 删除保护 | 删除仍有项的 `order_status` 返回真实 409，页面原样显示「请先清空字典项」。[截图](./04-nonempty-conflict-real.png) |
| 5 | 值唯一 | 重复 value 返回真实 409，表单保留输入，原样显示「资源冲突或仍被引用」。[截图](./05-duplicate-conflict-real.png) |
| 6 | 前端取值 | 通过字典页面修改标签后，真实商品 ID 124 的状态列显示新文案；捕获 `/meta/dicts/product_status` 200 并核对返回标签。[截图](./06-product-metadata-real.png) |
| 7 | 配置读取 | 四页签共 14 项，逐项核对真实 schema 描述、默认值、当前值与控件。[security](./07-settings-security-real.png)、[system](./07-settings-system-real.png)、[notification](./07-settings-notification-real.png)、[sync](./07-settings-sync-real.png) |
| 8 | 范围校验 | 密码最小长度填 3，按真实 schema 的 8–64 范围显示错误；捕获的配置 PUT 数为 0。[截图](./08-range-validation-real.png) |
| 9 | 只读项 | **schema 测试响应**：仅将 GET 返回的 `timezone.read_only` 设为 true，验证禁用、标注「不可修改」，真实保存请求仅含 `system_name`，无 timezone。[截图](./09-readonly-schema-fixture.png) |
| 10 | 保存 | 通过界面修改系统名称，真实 PUT 200；刷新后输入值与独立 GET 均保留新值，成功提示含「部分配置对新会话生效」。[截图](./10-saved-after-refresh-real.png) |
| 11 | 权限 | 创建真实仅有 dict:list/setting:list 的账号：保存/CRUD 按钮隐藏，配置输入禁用；直接 PUT 返回 403/20107。再移除 list 权限：菜单隐藏、页面 403，两 GET 均 403。[配置只读](./11-settings-readonly-real.png)、[字典只读](./11-dictionaries-readonly-real.png)、[无查看权限](./11-no-list-forbidden-real.png) |
| 12 | 构建 | lint、typecheck、应用单测、全仓单测、生产构建均退出 0；应用 34 个文件/141 项测试，全仓 129 个文件/848 项测试，构建耗时 31.87 秒。日志见下表。 |

## 校验命令

| 命令 | 日志 |
| --- | --- |
| `pnpm lint` | [12-lint.txt](./12-lint.txt) |
| `pnpm --filter @vben/web-antd typecheck` | [12-typecheck.txt](./12-typecheck.txt) |
| `pnpm --filter @vben/web-antd test:unit` | [12-app-unit.txt](./12-app-unit.txt) |
| `pnpm test:unit` | [12-unit.txt](./12-unit.txt) |
| `pnpm --filter @vben/web-antd build` | [12-build.txt](./12-build.txt) |

各命令退出码同时记录在 [verification.json](./verification.json)。全仓单测输出含 happy-dom AbortError 与 vi.mock 提升警告，lint 输出含图标名称提示，均未导致校验失败。

## 证据边界与恢复

真实后端的 14 项 schema 全部为 `read_only=false`，因此第 9 项使用单独标注的 schema 测试响应，不代表真实后端已有只读配置。组件测试同时验证禁用与提交时省略只读字段。

后端初始仅有任务指定的三个字典，没有 `product_status`，因此第 6 项创建临时业务字典及与真实商品状态一致的值，再从页面修改标签；断言结束后删除。未配置或请求失败时消费端显示原始状态值，不硬编码中文状态名。

最终浏览器测试的 11 项断言全部通过，`browserErrors=[]`；预期 HTTP 错误为第 4/5 项两个 409。测试已恢复原系统名称 `CommerceHub`，删除临时字典项、字典、用户、角色，5 项清理全部成功。后端源代码没有修改。

复现：启动前后端，设置环境变量 `SF4_ADMIN_PASSWORD`（可选 `SF4_ORIGIN`、`SF4_BACKEND`），运行 `pnpm --filter @vben/web-antd test:e2e:sf4`。脚本会执行真实写操作并在 finally 中恢复；生成证据后运行 `pnpm exec oxfmt --write docs/evidence/sf-4/real-ui.json`，再执行上述校验。
