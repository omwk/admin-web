# FE-IDN-005 验收记录

日期：2026-11-16。分支：`feat/fe-idn-005-audit-readability`，从最新 `origin/main` 的 `3b25bf5` 创建。后端开发服务包含 BE-IDN-009 与迁移 31。

卡片原 §3 只有六条；按本次执行指令和 §2.4–§2.7 补齐第 7–11 条，保留原六条编号。

真实后端用于验证名称、操作提示、查询参数与结果、用户 ID 复制。缺失的读操作、差异、空来源和失败形态使用 **Playwright 响应夹具**，仅拦截审计查询响应，未往开发库插入样例审计。各项证据标明来源。

| # | 验收项 | 结果与证据 |
| --- | --- | --- |
| 1 | 读操作 | **响应夹具**：显示「访问范围：12 个租户」，没有字段对比；同时验证 0 个租户，以及成员查询 `count=8`、`accessed_tenants=[2]` 时正确显示 1 个租户。[截图](02-read-scope-fixture.png)、[浏览器断言](ui.json) |
| 2 | 更新操作 | **响应夹具**：只显示 `name`、`profile.status`、`profile.removed`、`profile.added` 四个变化字段；相同字段不展示；旧值 `<del>` 的计算样式为 `line-through`，新值高亮。[截图](03-update-fields-fixture.png)、[断言](ui.json) |
| 3 | 新建 / 删除 | **响应夹具**：仅 after 显示「新建」与字段表（包含后端掩码 `***`）；仅 before 显示「删除」与字段表。[新建](04-created-fixture.png)、[删除](04-deleted-fixture.png) |
| 4 | 无变化 / 都空 | **响应夹具与单元测试**：忽略对象字段顺序，相同快照显示「无变化」；都空显示「—」。false、0、数组、null 与字段缺失、嵌套变更和 HTML 文本转义另有单元测试。[无变化](05-unchanged-fixture.png)、[都空](06-empty-source-fallback-fixture.png)、[单测输出](unit.txt) |
| 5 | 空来源 | **响应夹具**：IP 列及展开详情的来源 IP / User-Agent 均显示「—」。[截图](06-empty-source-fallback-fixture.png) |
| 6 | 构建 | `pnpm lint`、`pnpm -F @vben/web-antd typecheck`、`pnpm -F @vben/web-antd test:unit`、`pnpm -F @vben/web-antd build` 均退出 0；单测 53 个文件、250 项通过。[lint](lint.txt)、[typecheck](typecheck.txt)、[unit](unit.txt)、[build](build.txt)、[退出码](verification.json) |
| 7 | 可读名称 | **真实后端**显示 `admin（default）`；**响应夹具**显示「租户 acme」「用户 sales01」「字典 order_status」，缺名时回退「用户 #7」「#2」。不额外请求用户 / 租户资源进行反查。[真实截图](01-real-names-actions.png)、[回退截图](06-empty-source-fallback-fixture.png)、[响应快照](real-audits.json) |
| 8 | 中文操作 | **真实后端**：身份登录显示中文，悬停为原始 `identity.login`；**响应夹具**的未知动作 `future.action` 保留原值。映射覆盖后端登记的 83 个 action。[中文与 tooltip](01-real-names-actions.png)、[未知 action](06-empty-source-fallback-fixture.png)、[映射核对](action-labels.json) |
| 9 | 筛选搜索 | **真实后端**：关键字 `admin` / `identity.login`，模块 `system.tenant.`，成功 / 失败，时间范围及组合查询参数与返回值匹配；失败筛选真实返回 0 行，另用夹具验证失败展示。时间按本地选择并提交 RFC3339。空态与清空筛选通过。**响应夹具**另验证翻页 / 刷新保留已提交条件、未提交草稿不影响分页、切换 50 条/页回到第一页。[查询记录](real-queries.json)、[组合筛选](08-real-combined-filters.png)、[空态](08-real-empty.png)、[分页参数](fixture-queries.json) |
| 10 | 用户 ID | **真实后端**：用户表显示等宽 ID，复制后剪贴板为该行 `3`；横向滚动到最右时 ID 仍完整可见。[截图](10-real-copyable-user-id.png)、[可见性及剪贴板断言](ui.json) |
| 11 | 失败记录 | **响应夹具**：失败结果有红色标记，悬停显示原因；展开原样显示 `error_code=20107`、`error_message=没有权限执行此操作`。同时验证 after 元数据的目标租户 `acme`，并保留截断提示。[截图](07-failure-details-fixture.png)、[断言](ui.json) |

浏览器脚本：`apps/admin/e2e/fe-idn-005.mjs`（运行前设置 `FE_IDN_ADMIN_PASSWORD`）。输出：10 项页面验收通过（对应 #1–5、#7–11），`browserErrors=0`；#6 由四条构建检查单独验证。[完整输出](ui.txt)、[结构化结果](ui.json)。审计页面没有编辑、删除、导出等写操作按钮。

## 阶段清理（AGENTS §12）

验收前在开发库 `commercehub_test`（迁移 31）记录了 **3 条**基线审计：1804、1805、1806。任务提示的两条之外，开工基线已包含一条租户模板创建记录；一并保留。[基线](baseline.json)

已清理：带本卡 User-Agent 的审计 1807–1814 共 **8 条**；清理后保留 1804、1805、1806，残留本卡审计 **0**。本卡未创建测试租户、用户、角色、菜单或模板，未修改系统配置；响应夹具持久化行数为 0。[清理结果与 SQL](cleanup.json)、[清理后只读复核](cleanup-verify.json)

执行命令：`go run D:/code/admin-web/.temp/fe005-cleanup.go --apply`。实际事务如下（影响行数 8）：

```sql
BEGIN;
SELECT set_config('commercehub.audit_prune_before',
                  '2026-11-16T03:59:55.0358144Z', true);
DELETE FROM audit_log
WHERE created_at >= '2026-11-16T03:03:53.317825Z'
  AND created_at < '2026-11-16T03:59:55.0358144Z'
  AND user_agent = 'FE-IDN-005 acceptance browser'
  AND actor_id = 1 AND tenant_id = 1 AND id > 1806;
COMMIT;
```

CLI `audit-prune --before` 只能按截止时间删除，会连带清除三条基线真实记录。因此使用其相同的事务局部维护标志，增加时间下界、User-Agent、操作者、租户与 ID 条件精确清理。事务内核对删除行数与全部保留 ID，不符合即回滚；未禁用 append-only 触发器。

## 偏差说明

- 缺失审计形态通过明确标注的浏览器响应夹具验证；没有为凑行数创建开发库样例审计。
- 卡片原六条验收补齐为十一条；清理用上述精确 SQL 保留本卡开始前的真实记录。
- lint 的图标扫描输出既有 `Invalid icon name` 提示，但检查退出码为 0；未调整图标配置或放宽规则。
- 工作保留在当前分支，未推送、未创建 PR、未合并。
