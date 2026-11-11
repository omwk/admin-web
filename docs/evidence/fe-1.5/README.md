# FE-1.5 验收证据

验收日期：2026-11-12（Asia/Shanghai）。分支：`feat/fe-1.5-system`。
后端：`http://127.0.0.1:18080`，前端：`http://127.0.0.1:5666`。
四步依次通过用户、邀请、角色、菜单联调，再执行完整静态检查、单测与生产构建。

## §5 十二项验收

| # | 结果与实测断言 | 证据 |
| --- | --- | --- |
| 1 | 通过。界面生成邀请、复制链接；接收人自行设密，HTTP 201；浏览器登录成功，`auth/me` 确认部门 1、角色运营 2 与销售 3。 | [邀请报告 item 1](report-invites.json)、[生成并复制](01-invite-created.png)、[接收成功](01-invite-accepted.png) |
| 2 | 通过。列表显示「已用完」「已撤销」；界面撤销返回 204，使用撤销链接返回 400。 | [邀请报告 item 2](report-invites.json)、[撤销后列表](02-invite-revoked.png) |
| 3 | 通过。PUT 用户后自动 GET 列表并显示新昵称和根部门；真实表单单测另验证部门从 11 改为 12、昵称变更及刷新事件。 | [菜单阶段用户编辑 item 3](report-menus.json)、[即时刷新截图](03-user-edit.png)、[跨部门表单测试](../../../apps/admin/src/views/system/user/__tests__/user-form.test.ts)、[应用单测日志](12-app-unit.log) |
| 4 | 通过。界面勾选运营、销售并保存，关闭后重新打开仍同时选中；GET 回读 `[2,3]`。 | [报告 item 4](report-menus.json)、[双角色回显](04-user-two-roles.png) |
| 5 | 通过。生成重置链接并验证剪贴板内容完全一致；接收人成功设密，随后生成新链接，旧链接返回 400、新链接成功；成功页清除 fragment 凭证。 | [邀请报告 item 5](report-invites.json)、[复制链接](05-reset-link-copy.png)、[旧链接失效](05-reset-old-invalid.png) |
| 6 | 通过。菜单授权保存 `[1,2]`、接口权限保存 system 模块 18 项；关闭抽屉后回显一致；半选父菜单不会额外授予兄弟菜单。菜单页明确提示接口权限须单独授权。 | [角色报告 item 6](report-roles.json)、[菜单选择回归测试](../../../apps/admin/src/views/system/role/__tests__/permission-selection.test.ts) |
| 7 | 通过。后端实测 103 权限、9 模块，初始全部折叠；搜索 `system:user:create` 命中 1 项，整组选中仍包含 system 全部 18 项。 | [角色报告 item 7](report-roles.json)、[搜索及整组选中](07-permissions-module-search.png) |
| 8 | 通过。`all/dept/dept_and_child/self/custom` 五种范围逐一保存并 API 回读；自定义根部门回读 `[1]`；真实授权抽屉单测点击两个独立部门并一次发送 `[11,12]`。 | [角色报告 item 8](report-roles.json)、[自定义范围截图](08-custom-data-scope.png)、[双部门抽屉测试](../../../apps/admin/src/views/system/role/__tests__/role-grants.test.ts)、[应用单测日志](12-app-unit.log) |
| 9 | 通过。界面新增目录、子菜单，编辑名称/排序/可见状态后树表刷新；新浏览器会话登录后侧栏出现新增子菜单；含子节点目录删除返回 409，删除子菜单再删目录成功。 | [菜单报告 item 9](report-menus.json)、[树表 CRUD](09-menu-tree-crud.png)、[重新登录的侧栏](09-menu-sidebar-after-login.png)、[菜单删除保护](09-menu-delete-409.png) |
| 10 | 通过。绑定临时用户的角色删除返回 HTTP 409 / code 20105；页面提示先解除用户关联及授权；解除引用后界面删除成功且列表刷新。 | [角色报告 item 10 与 role-crud](report-roles.json)、[409 提示](10-role-delete-409.png) |
| 11 | 通过。仅授予 `system:user:list` 的账号看不到新增用户和新建邀请按钮；直接 POST `/admin/users` 与 `/admin/invites` 均为 403。临时账号先通过后端要求的个人改密流程。 | [角色报告 item 11 与 limited-api 响应](report-roles.json)、[无创建按钮](11-user-create-hidden.png) |
| 12 | 通过。完整 lint、完整 typecheck、仓库 unit、管理端生产 build 均退出 0，详见下表。 | [lint](12-lint.log)、[typecheck](12-typecheck.log)、[unit](12-unit.log)、[build](12-build.log) |

目前后端只提供根部门，且部门接口为只读。因此第 3 项的真实跨部门切换、第 8 项的双部门多选由挂载真实 Vue/Ant Design 组件的单测补足；真实后端联调验证根部门的写入与回读。没有创建部门或修改数据库。

## 构建和回归

| 命令 | 实际结果 |
| --- | --- |
| `pnpm lint` | 退出 0，格式、oxlint、ESLint、Stylelint 通过 |
| `pnpm check:type` | 退出 0，38/38 任务通过 |
| `pnpm test:unit` | 退出 0，111 文件、764 测试通过 |
| `pnpm -F @vben/web-antd test:unit` | 退出 0，16 文件、57 测试通过 |
| `pnpm build:antd` | 退出 0，11/11 任务通过，生成 `apps/admin/dist` 与 `apps/admin/dist.zip` |
| `node apps/admin/e2e/fe1.5.mjs --phase=users` | [通过](report-users.json) |
| `node apps/admin/e2e/fe1.5.mjs --phase=invites` | [通过](report-invites.json) |
| `node apps/admin/e2e/fe1.5.mjs --phase=roles` | [通过](report-roles.json) |
| `node apps/admin/e2e/fe1.5.mjs --phase=menus` | [通过](report-menus.json) |

日志保留仓库既有的图标解析、happy-dom 请求中止及 sortable mock 提示；上述命令均退出 0，没有失败测试。

API 报告保留请求路径、方法、状态码、错误码与 trace_id；不记录请求体、密码、鉴权头或链接 token。截图中的账号链接已遮罩。不同阶段重复用户基础流程时会更新相应截图，以最新菜单阶段报告为准。

## 清理与复现

[最终数据核对](final-data.json)：3 用户、3 角色、10 菜单；没有遗留的 `fe15_` 用户/角色或 FE1.5 菜单，没有有效邀请。临时邀请已撤销，审计记录由后端保留；原有账号的密码和授权未改动。

复现前启动后端与 `pnpm -F @vben/web-antd dev --host 127.0.0.1`，在环境变量中设置 `FE15_ADMIN_PASSWORD` 和 `FE15_TEST_PASSWORD`。使用四个 `--phase` 参数按顺序验收；`pnpm -F @vben/web-antd test:e2e:fe1.5` 可一次运行全部。匿名账号接口限流时脚本等待正常补充额度，不绕过限流。

实现到 FE-1.5 为止，未继续 FE-2 其他部分；未提交或推送。
