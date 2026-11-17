# FE-IDN-007 验收记录

实现分支 `feat/fe-idn-007-template-editor`，基线 `d0f2b442489aa7e0f91373cde665722ead7ab865`；后端模板契约 `de01599667f926c69dbf5b0d7f4411c0411ce95f`。真实验收使用本地前端 `127.0.0.1:5666` 和后端 `127.0.0.1:18080`。

列表支持角色数、角色权限码去重数、使用数、独立复制与引用删除保护。编辑器复用角色页的 `PermissionGroupsView`，保存时同时提交必填 `name` 与完整 `roles`，保留角色状态、备注和只读菜单。提供空白与租户快照创建、五种数据范围、角色增删及校验、空权限保存确认、向导空态与零角色警告、站内导航和刷新离开保护。

## 十二项验收

| # | 断言与实测结果 | 证据 |
| --- | --- | --- |
| 1 | 模板 `8` 显示 `1 个`角色、`1 个`权限、`1 个租户`使用；删除按钮禁用，直接 DELETE 返回 `409/10004`。去重计数另有单测覆盖。 | [列表截图](01-template-counts-protection-real.png)、[请求与断言](acceptance.json) |
| 2 | 空白创建 POST 不含 `source_tenant_id`，真实返回 `201`、`roles=[]`，自动进入详情编辑路由；框架菜单保留。 | [空白截图](02-blank-editor-real.png)、[请求与断言](acceptance.json) |
| 3 | 新增 code=`reader`、名称「只读」、范围 `self` 的角色，选择 `product:spu:list`；PUT 同时包含 `name` 与完整 `roles`，返回 `200`。 | [保存截图](03-role-permission-saved-real.png)、[完整脱敏请求](acceptance.json) |
| 4 | 默认模块折叠，搜索自动展开；搜索单个权限后全选 product 模块，角色显示 `10 个权限`，包含被搜索隐藏的权限。 | [分组全选截图](04-module-search-select-all-real.png)、[断言](acceptance.json) |
| 5 | `all/dept/dept_and_child/custom/self` 逐个切换并真实 PUT 保存；每次回包与选择一致，最终恢复 `self`。 | [五种范围截图](05-five-data-scopes-real.png)、[五次状态与 trace ID](acceptance.json) |
| 6 | 刷新后角色名称、锁定 code、范围与已选权限回填；保存按钮禁用；模板菜单图前后相同、树不可编辑。 | [刷新截图](06-reloaded-real.png)、[快照比对](acceptance.json)、[编辑器单测](unit-final-editor.log) |
| 7 | 专用 clone 接口返回 `201`，副本 `9` 改角色名并添加第二个权限；原模板 `8` 的角色和单个权限保持原样。 | [副本截图](07-independent-clone-real.png)、[原副本完整比对](acceptance.json) |
| 8 | **真实开通**租户 `21`，code=`feidn007_1794874285618_tenant`；接受邀请、设置随机密码并以新租户身份登录，`/auth/me` 回读 tenant_id=`21`；该租户角色列表只有 `reader/只读/self`，关联权限 ID=`2397`，用该租户自己的权限字典映射为唯一的 `product:spu:list`。 | [开通成功截图（链接已遮罩）](08-provisioned-real.png)、[租户内角色截图](08-tenant-roles-real.png)、[真实接口状态、trace ID 和角色权限](acceptance.json) |
| 9 | 无模板时显示指定空态和「去创建模板」；模板下拉不存在，确认开通禁用，点击跳到模板列表。此项使用浏览器空列表响应夹具，避免删除已有模板。 | [空态截图](09-empty-templates-ui-fixture.png)、[明确标注的夹具证据](acceptance.json) |
| 10 | 零角色模板 `10` 显示完整警告，确认开通仍可用，真实开通租户 `22` 返回 `201`。 | [警告截图](10-zero-role-warning-real.png)、[开通成功截图](10-zero-role-provisioned-real.png)、[响应证据](acceptance.json) |
| 11 | 修改模板后站内离开弹确认；取消保留草稿；真实浏览器刷新触发 `beforeunload`，取消后草稿保留；放弃离开后服务端未写入修改。 | [离开确认截图](11-unsaved-route-confirm-real.png)、[浏览器断言](acceptance.json)、[组件测试](unit-final-editor.log) |
| 12 | lint、全仓 typecheck、全仓和应用 unit、生产 build 全部退出 `0`，结果见下表。 | [工程检查](verification.json) |

补充验证：从真实租户 `21` 创建模板快照 `11`，POST 含 `source_tenant_id=21` 返回 `201`，角色数 `1`、权限仍为 `product:spu:list`。[快照截图](supplement-snapshot-real.png)、[结果](supplement.log)、[详情](acceptance.json)。浏览器运行时错误 `0`；截图遮罩邀请链接，证据不保存密码、访问令牌和邀请令牌。

## 工程检查

| 命令 | 结果 | 日志 |
| --- | --- | --- |
| `bun run lint` | 退出 `0`，格式、oxlint、eslint、stylelint 通过 | [lint.log](lint.log) |
| `pnpm check:type` | `38 successful, 38 total` | [typecheck.log](typecheck.log) |
| `bun run test:unit --maxWorkers=2` | `150 passed` 文件、`983 passed` 测试 | [unit-root.log](unit-root.log) |
| `bun run --cwd apps/admin test:unit --maxWorkers=2` | `55 passed` 文件、`276 passed` 测试 | [unit-admin.log](unit-admin.log) |
| 最后源码调整后再次运行两个编辑器测试文件 | `2 passed` 文件、`16 passed` 测试，包含 Unicode 长度边界 | [unit-final-editor.log](unit-final-editor.log) |
| `pnpm build:antd` | `11 successful, 11 total`，生产包生成 | [build.log](build.log) |

全仓单测输出了既有 happy-dom 外部资源网络错误和 sortable mock 提升警告，但测试无失败、进程退出 `0`；未放宽断言或修改现有测试配置。lint 的共享样式图标扫描提示不影响退出码。

## 按 AGENTS §12 清理

已清理：`bun .temp/fe-idn-007-cleanup.mjs` → 删除本卡租户 `19/20/21/22`，模板 `4–11` 均通过真实 DELETE API 返回 `204`；删除 `4` 个用户、`3` 个角色及其关联、`84` 个菜单、`472` 个权限字典条目、字典/部门/邀请/密码历史等附属资源；删除 `75` 条本卡审计和 `23` 条平台测试刷新会话。[逐条 SQL、影响行数与 API 状态](cleanup.json)、[命令输出](cleanup.log)。

租户及附属数据在事务中按外键顺序删除，ID 与本卡 code 同时核验。审计使用 `audit-prune` 相同的事务局部维护标记与严格截止时间，再加本卡 User-Agent/首次运行的确切 ID 条件；CLI 只支持时间上界，会误删无关记录，因此未直接执行全量 CLI。未关闭 append-only 触发器，保留的 `2` 条非本卡审计逐 ID 比对一致。

清理后执行 `bun .temp/fe-idn-007-verify-cleanup.mjs` 只读复核所有带 `tenant_id` 的公共表，本卡租户附属资源、模板、审计及测试会话均残留 `0`；原租户 `default(1)`、模板 `base(2)` 保留。[只读复核](cleanup-verify.json)。无系统配置修改，无测试业务数据保留。

## 偏差说明

功能范围无偏差。第 9 项空态使用明确标注的浏览器响应夹具；第 8 项与第 10 项开通均为真实后端。审计采用精确条件执行同等维护清理，原因及证据见上文。未修改后端、依赖、锁文件或模板菜单图。

## 重跑

启动真实后端和前端后，设置 `FE_IDN_007_ADMIN_PASSWORD` 并运行 `bun run --cwd apps/admin test:e2e:fe-idn-007`；可选 `FE_IDN_007_ORIGIN`、`FE_IDN_007_BACKEND`、`FE_IDN_007_BROWSER_CHANNEL`。脚本会创建独立 code 的临时资源，清单实时写入 `acceptance.json`；重新验收后须再次按 §12 清理该次清单，现有清理 SQL 仅对应本次已清理的 ID。
