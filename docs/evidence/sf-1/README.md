# SF-1 验收证据

验收日期：2026-11-13（Asia/Shanghai）。分支：`feat/sf-1-dept`。
页面：[部门管理](http://127.0.0.1:5666/system/depts)，后端：`http://127.0.0.1:18080`。

真实浏览器验收的九项业务断言全部通过，`report.json` 中 `passed=true`、`mode=ui`、`errors=[]`、`cleanupErrors=[]`。完整检查的实际退出码和日志索引见 [verification.json](verification.json)。

## 按 SF-1 §4 逐条验收

| # | 项目 | 证据及实际断言 |
| --- | --- | --- |
| 1 | 树渲染 | [8 部门截图](01-tree-eight-departments.png)。逐节点对照真实 API 的成员数和缩进，确认 1 根、3 一级、4 二级；根直属成员为 3，其余为 0。完整基线在 [report.json](report.json) 的 item=1。 |
| 2 | 新建 | [创建截图](02-created-levels.png)。通过界面新增根部门 17、一级部门 18、二级部门 20，POST 均为 201；path 分别为 `17`、`1.18`、`1.18.20`，保存后无需手工刷新即出现。 |
| 3 | 改名 | [树与详情截图](03-renamed-detail.png)。部门 20 改名后，详情 API、树名称和右侧详情一致；同时回读排序 `-5`、状态 `disabled`。 |
| 4 | 移动 | [移动子树截图](04-moved-subtree.png)。带子部门的 18 移到 19 下，服务端 path 为 `1.19.18`、`1.19.18.20`；子节点 UI 深度为 3。report 的 item=4.network 记录 `PUT /admin/depts/18 → GET /admin/depts`，证明自动重新拉取整棵树。 |
| 5 | 防环 | [父级选择器截图](05-blocked-parent-options.png)。编辑部门 18 时，自身 18 和后代 20 的真实选择器节点带 `ant-select-tree-treenode-disabled`。组件测试另覆盖三代后代递归禁用，以及根和合法上级可选。 |
| 6 | 重名 | [400 原文截图](06-duplicate-400-verbatim.png)。同父重名提交真实返回 HTTP 400；页面精确显示后端原文“同一父部门下名称不可重复”，表单保留。 |
| 7 | 删除保护 | [409 原文截图](07-protected-delete-409-verbatim.png)。二次确认包含“不可恢复”和子部门/在册用户后果；删除带子部门的 18 返回 HTTP 409，页面精确显示“请先删除或移走子部门”。 |
| 8 | 删除成功 | [删除后截图](08-deleted-empty-department.png)。空部门 20 通过确认删除返回 204，整树刷新后对应节点消失；浏览器运行时错误为 0。 |
| 9 | 权限 | [只读账号截图](09-readonly-hidden-buttons.png)。真实只读账号看不到新增根部门、新增子部门、编辑、删除按钮；直接 POST/PUT/DELETE 均为 HTTP 403 / code 20107。详见 report 的 item=9.forbidden。 |
| 10 | 构建 | [检查结果](verification.json) 与 [lint](10-lint.log)、[typecheck](10-typecheck.log)、[仓库单测](10-unit.log)、[应用单测](10-app-unit.log)、[生产构建](10-build.log)。类型检查 38/38，仓库单测 114 文件 / 792 用例，应用单测 19 文件 / 85 用例，生产构建 11/11；全部实际退出码记录在 verification.json。 |

## 实现与回归

- 左树右详情/表单；根/子部门新增、编辑、删除确认；名称搜索保留祖先结构；成员数徽标、启用/停用状态以及两种指定空态。
- 上级选项使用完整原树生成，递归禁用自身与所有后代；仅提交 `parent_id/name/sort/status`，path 完全以服务端响应为准。
- 所有写操作后重新 GET 整棵树并回读选中详情，避免移动后子树层级和 path 过期。
- 部门写请求单独开启 400/409 message 原样展示，其他请求继续现有错误映射。
- 按钮直接使用 `/auth/menus.permissions[]`。真实部门导航 `children=[]`，导航中无按钮节点，仍可显示已授权操作；[前置条件证据](backend-prerequisites.json) 保存投影。路由回归测试另验证撤销权限后按钮码从 access store 消失。
- 真实浏览器发现删除后的 Ant Tree 动画缓存会读取已移除节点；部门树设置 `motion=null` 后复跑全部九项，运行时错误为 0。未修改依赖。

## 环境与数据清理

本轮开始时 `18080` 仍是 2026-11-12 18:47 启动的旧后端进程，部门权限已投影，但 POST 返回 405。读取当前后端源码确认已有 S1 写路由后，编译到被 Git 忽略的前端 `.cache`，先在 18081 验证登录 200、原始 8 条数据和新增路由校验 400，再替换旧进程到 18080。后端源码和数据库结构均未修改，备用进程验收后关闭。

[final-data.json](final-data.json) 的 `restored=true` 验证原始 8 个部门的全部字段、结构与成员数和基线完全一致；`temporaryUsers=[]`、`temporaryRoles=[]`。所有临时部门按子到父顺序清理，临时根部门按后端约束先移动到现有根下再删除。证据未保存密码或令牌。

## 复跑

```powershell
# 前端 5666、包含 S1 写路由与权限投影的后端 18080 需先启动。
$env:SF1_ADMIN_PASSWORD = '<管理员密码>'
pnpm -F @vben/web-antd test:e2e:sf1
pnpm lint
pnpm check:type
pnpm test:unit
pnpm -F @vben/web-antd test:unit
pnpm build:antd
```

[验收脚本](../../../apps/admin/e2e/sf1.mjs) 使用真实 Playwright 浏览器、界面操作和真实后端；退出码 0 表示业务断言和清理全部通过。请求路径、HTTP 状态、业务码与 trace ID 保存在 [report.json](report.json)，本轮控制台输出在 [e2e-run.log](e2e-run.log)。
