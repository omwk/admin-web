# SF-3 验收证据

日期：2026-11-13（Asia/Shanghai）；分支：`feat/sf-3-audit`。

真实验收使用现有前端 `127.0.0.1:5666` 和用户指定的后端 `127.0.0.1:18080`。未模拟审计、登录、解锁或权限响应，也未修改后端源码、数据库结构或运行进程。浏览器结果见 [real-ui.json](real-ui.json)：§5 第 1–10 条均通过，浏览器运行时错误为 0。

| # | 项 | 结果与证据 |
| --- | --- | --- |
| 1 | 审计列表 | 真实审计总数 667，本页 20 行；断言 `created_at DESC, id DESC`，时间、操作者、动作、资源、结果、IP 六列齐全。[列表](01-audit-real.png) |
| 2 | 审计筛选 | action 单筛 198 条；result=failure 单筛 18 条；时间单筛 341 条；action/result/resource/time 组合 18 条；action+success 翻至第 2 页参数保持。`2026-11-13 00:00:00` 本地时间提交 `2026-11-12T16:00:00.000Z`；另验证 actor_id 精确筛选。[筛选截图](02-audit-filter-real.png) / [查询参数与总数](real-ui.json) |
| 3 | 差异视图 | 真实审计 ID 662，before/after 两棵 JSON 树，嵌套 name 修改与 added 新增有标记，password/secret 均原样为 `***`。[差异树](03-json-diff-real.png)；单测另覆盖数组、移除、null、类型变化和对象键顺序。 |
| 4 | 截断标记 | 真实审计 ID 663 的源快照超过 4KB；返回 before+after 共 4096 字节且 `truncated=true`，列表和展开区均显示「内容已截断」。[截断截图](04-truncated-real.png) |
| 5 | 登录历史 | 同页存在 success/failure，真实 IP `127.0.0.1` 与 API 一致；192 字符 UA 的省略布局和全文 tooltip 已断言。[登录历史](05-login-history-real.png)；另验证 user_id/result/time 组合筛选及清空。 |
| 6 | 未知账号 | 真实未知账号审计 ID 664，`user_id=null`、`resource_id=unknown`、`username=未知账号`；断言登录列表的网络响应和页面 DOM 均不含提交的随机账号串。[未知账号](06-unknown-account-real.png)。补充组件单测故意在 username/额外 input/快照混入输入串，三种未知身份组合均不渲染该串。 |
| 7 | 解锁 | 专用用户 ID 55：取消确认不改变 locked；确认 POST=200，响应 active，状态列立即显示启用且解锁入口消失；随后登录和 `/auth/me` 均 200。[确认](07-unlock-confirm-real.png) / [解锁后](07-unlocked-active-real.png) |
| 8 | 解锁保护 | disabled 专用用户无解锁按钮；直调 POST 返回 409/code=10004；另在确认期间将 locked 变为 disabled，真实 409 后显示「该用户已禁用，无法解锁，请刷新列表」并刷新状态。[409 提示](08-disabled-conflict-real.png) |
| 9 | 只读 | 浏览器逐页断言没有导出、编辑、删除、新增、保存按钮，仅查询、清空筛选、刷新和只读展开。[审计](09-audit-readonly-real.png) / [登录](09-login-readonly-real.png) |
| 10 | 权限 | 真实角色仅含 `system:user:list`，保留审计/登录菜单授权仍无这两个菜单，也无解锁按钮；两页直连显示 403；直接两接口均 HTTP 403/code=20107，trace_id 已记录。[审计 403](10-audit-forbidden-real.png) / [登录 403](10-login-forbidden-real.png) / [HTTP 结果](real-ui.json) |
| 11 | 构建 | lint、typecheck、应用单测（28 文件 / 124 项）、全仓单测（123 文件 / 831 项）、生产 build 均退出 0。最终退出码汇总见 [checks.json](checks.json)；原始输出：[lint](11-lint.txt)、[typecheck](11-typecheck.txt)、[应用单测](11-app-unit.txt)、[全仓单测](11-unit.txt)、[build](11-build.txt)。 |

空态同时验证：「当前筛选条件下没有记录」和「暂无登录记录」均有「清空筛选」入口，见 [审计空态](empty-audit-real.png) / [登录空态](empty-login-real.png)。筛选分页单测还覆盖提交后修改草稿、翻页、页大小变化、倒置时间范围、失败清空、过期响应和卸载后响应。

验收脚本仅创建专用用户、角色、隐藏按钮菜单。成功执行后，3 个用户、1 个角色、1 个菜单均已清理，见 real-ui.json 的 cleanup；审计证据按后端只追加语义保留。日志与截图不保存访问令牌、随机密码或未知账号的输入串。

复现：前后端启动后，在仓库根目录执行（管理员密码通过环境变量提供）：

```powershell
$env:SF3_ADMIN_PASSWORD = '<本地管理员密码>'
pnpm --filter @vben/web-antd test:e2e:sf3
pnpm lint
pnpm --filter @vben/web-antd typecheck
pnpm --filter @vben/web-antd test:unit
pnpm test:unit
pnpm --filter @vben/web-antd build
```

没有新增依赖、提交、推送、PR 或部署。
