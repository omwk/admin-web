# FE-IDN-008 验收记录

2026-11-17，在 `feat/fe-idn-008-tenant-lifecycle` 实现；基线为 `origin/main d82c8c6`。后端为本地 `http://127.0.0.1:18080`，包含 `32e2c42`；前端为 `http://127.0.0.1:5666`，浏览器为 Edge，时区 Asia/Shanghai。

最终真实验收运行时间：`2026-11-17T01:00:30.706Z` 至 `2026-11-17T01:01:00.381Z`。租户 `25 / feidn008_1794877230706_tenant`、模板 `14`、类目 `17` 均已清理。请求状态、后端原文、trace ID、夹具来源、SQL 影响行数见 [acceptance.json](acceptance.json)；浏览器异常为 0。

## 卡片 §3：十二条逐项证据

| # | 验收项 | 结果与证据 |
| --- | --- | --- |
| 1 | 状态展示 | 通过。真实租户依次显示绿色「正常」、灰色「已停用」、红色「已归档」；归档时 `status=suspended`，优先显示归档。截图：[active](01-active-real.png)、[suspended](01-suspended-real.png)、[archived](03-includes-archived-time-real.png)。组件测试另覆盖 `status=active + deleted_at` 的归档优先级。 |
| 2 | 默认隐藏 | 通过。默认 GET 查询为 `?page=1&page_size=100`，未带 `include_archived`；归档后真实 API 列表与 UI 都不含租户 25。[截图](02-default-hides-archived-real.png)、[请求记录](acceptance.json)。 |
| 3 | 筛选 | 通过。打开开关请求带 `include_archived=true`；显示后端 `2026-11-17T01:00:38.708686Z` 对应本地时间 `2026-11-17 09:00:38`。关闭后参数取消且行消失。[截图](03-includes-archived-time-real.png)、[请求记录](acceptance.json)。 |
| 4 | 归档 | 通过。确认框说明登录受阻、列表隐藏、数据保留；真实 POST 返回 200，`deleted_at` 非空。原租户管理员再登录返回 HTTP 403 / code 20111「租户已停用」。[确认截图](04-archive-confirm-real.png)、[归档与登录响应](acceptance.json)。 |
| 5 | 恢复 | 通过。真实 POST restore 返回 200、`status=active`、`deleted_at=null`；原账号密码登录恢复 200。[截图](05-restored-login-real.png)、[恢复与登录响应](acceptance.json)。 |
| 6 | 平台保护 | 通过。真实平台行归档禁用，悬停显示「平台租户不可归档/删除」；直调归档和删除都返回 409。[真实截图](06-platform-archive-real.png)。平台不能真实归档，使用明确标注的列表响应夹具补充验证「彻底删除」禁用及同一提示：[夹具截图](06-platform-delete-ui-fixture.png)。 |
| 7 | 确认码 | 通过。空值、错误 code、大小写差异、首尾空格均禁用提交；完全一致才可提交。弹窗没有虚构统计数字。[错误输入](07-wrong-code-disabled-real.png)、[精确输入](07-exact-code-enabled-real.png)。适配器单测验证保留原始 code 并 URL 编码；组件单测验证取消重置和重复提交保护。 |
| 8 | 宽限期 409 | 通过。真实 DELETE 返回 409；弹窗逐字显示「归档未满 7 天」，保留输入可重试。[截图](08-grace-409-real.png)、[响应](acceptance.json)。 |
| 9 | 业务数据 409 | 通过。只将测试租户归档时间回拨 366 天并插入 1 条测试类目；真实 DELETE 返回 409「租户仍有业务数据，暂不支持彻底删除」。数据库断言该类目和用户均仍存在。[截图](09-business-data-409-real.png)、[响应与夹具 SQL](acceptance.json)。 |
| 10 | 删除成功 | 通过。移除测试类目后，真实 DELETE 携带精确 `confirm` 返回 204；列表刷新行消失，提示「租户已删除」，数据库租户和用户数量均为 0。[截图](10-deleted-row-gone-real.png)、[响应](acceptance.json)。 |
| 11 | 权限 | 通过。平台超管实际总有 manage，故只在真实菜单权限响应中移除 `system:tenant:manage`；真实租户列表不替换。开通、编辑、停启、邀请、归档、恢复、删除全部隐藏，归档行也不显示成员入口。[明确标注的权限夹具截图](11-no-manage-ui-fixture.png)。单测同时覆盖普通与归档状态。 |
| 12 | 构建与检查 | 通过。lint、全仓类型检查 38/38、全仓单测 151 文件 / 1007 项、应用单测 56 文件 / 300 项、生产构建 11/11 全部 exit 0。见 [verification.json](verification.json) 和下方原始日志。 |

## 补充回归与证据边界

- 400 原文：为绕过正常 UI 的精确匹配守卫，仅将一次浏览器 DELETE 的 `confirm` 改为错误值；**响应来自真实后端**，HTTP 400 / code 10001，弹窗原样展示「确认码不匹配」。随后取消请求改写，重试成功。[截图](supplement-confirmation-400-real-backend.png)、[confirmation400](acceptance.json)。
- 模板引用：切换模板页始终查询包含归档的完整目录，真实模板显示「1 个租户」且删除禁用；归档租户不出现在「从租户创建」来源选项中。[截图](supplement-archived-template-reference-real.png)、[templateReference](acceptance.json)。
- #6 的归档平台状态和 #11 的无 manage 状态是前端响应夹具；其余生命周期、登录、宽限期、业务数据保护和删除均访问真实后端。SQL 仅构造本卡租户的时间及业务数据条件，不修改全局宽限期或其他配置。
- 适配器与生命周期单测覆盖 400/409 原文、分页筛选参数、URL 编码、状态操作矩阵、过滤响应竞态、平台保护、权限隐藏和重试。根单测保留既有 happy-dom 外部资源连接及 sortable mock 提示；测试失败数为 0。lint 保留既有图标扫描提示，进程 exit 0。

## 验证命令

| 命令 | exit | 证据 |
| --- | --- | --- |
| `bun run lint` | 0 | [lint](12-lint.txt) |
| `pnpm check:type` | 0 | [typecheck](12-typecheck.txt) |
| `bun run test:unit --maxWorkers=4` | 0 | [root unit](12-unit-root.txt) |
| `bun run --cwd apps/admin test:unit --maxWorkers=4` | 0 | [admin unit](12-unit-admin.txt) |
| `pnpm build:antd` | 0 | [build](12-build.txt) |
| `bun run --cwd apps/admin test:e2e:fe-idn-008` | 0 | [E2E](e2e.txt)、[结构化结果](acceptance.json) |

复跑需已启动本地前后端，并通过环境变量提供 `FE_IDN_008_ADMIN_PASSWORD` 与指向同一开发库的 `FE_IDN_008_DATABASE_URL`；脚本不保存密码、令牌或数据库凭据。浏览器由 Node 运行，SQL 子进程使用现有 Bun；可选设置 `FE_IDN_008_ORIGIN`、`FE_IDN_008_BACKEND`、`FE_IDN_008_BROWSER_CHANNEL`。未新增依赖。

## AGENTS §12 清理

最终运行已清理：租户 25 已在验收中经 DELETE API 返回 204 删除（其用户等框架数据随之删除）；模板 14 经 DELETE API 返回 204；测试类目 SQL 删除 1 行；本卡审计删除 24 行、平台刷新会话删除 6 行。保留测试数据：无。系统配置修改：无，前后对比设置哈希完全一致。[最终清理记录](cleanup.json)。

审计使用 `audit-prune` 同一事务级 cutoff guard，并增加本卡 UA 与本轮开始时间谓词；CLI 仅接受上界，直接调用会误删验收前已有的 2 条审计。下列事务保留了这 2 条无关记录，且断言本卡审计、会话均为 0。完整参数及影响行数在 cleanup JSON 中。

```sql
-- 本轮 tenant_id=25，name='feidn008_1794877230706_tenant'；影响 1 行。
DELETE FROM category WHERE tenant_id=$1 AND name=$2 RETURNING id;

BEGIN;
-- cutoff='2026-11-17T01:00:59.021Z'
SELECT set_config('commercehub.audit_prune_before',$1,true);
-- $1/$2 为本卡两个固定 UA；$3 为开始时间，$4 为 cutoff；影响 24 行。
DELETE FROM audit_log
WHERE user_agent IN ($1,$2) AND created_at >= $3 AND created_at < $4
RETURNING id;
-- 同一 UA 与开始时间谓词；影响 6 行。
DELETE FROM sys_refresh_token
WHERE user_agent IN ($1,$2) AND created_at >= $3
RETURNING id;
COMMIT;
```

UA 为 `FE-IDN-008 acceptance API` 和 `FE-IDN-008 acceptance browser`；本轮开始时间 `2026-11-17T01:00:30.706Z`。清理后：本卡租户、模板、业务行、审计、会话均为 0；验收前 1 个租户、1 个模板、2 条审计保留，配置一致。

此前两轮运行的清理也留有独立记录：[第一轮](cleanup-first-run.json) 删除租户 23、模板 12、1 条类目、22 条审计、6 条会话；[第二轮](cleanup-second-run.json) 删除租户 24、模板 13、21 条审计、4 条会话，尚未创建类目。三轮合计清掉 3 个测试租户、3 个模板、2 条测试类目、67 条审计、16 条平台会话。第二轮是补充测试脚本关闭弹窗的定位超时，finally 清理成功，修正脚本后最终整轮通过。
