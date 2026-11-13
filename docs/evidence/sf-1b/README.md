# SF-1b 验收证据

日期：2026-11-13（Asia/Shanghai）。分支：`fix/sf-1b-root`。

## 按任务卡 §3 逐条验收

前四项通过真实 Vue / Ant Design Vue 组件的 DOM、交互与提交参数断言验证，运行环境为 happy-dom，API 使用测试替身。逐条用例状态见 [unit-report.json](unit-report.json)，完整输出见 [应用单测日志](05-app-unit.txt)。

| # | 项目 | 证据与断言 |
| --- | --- | --- |
| 1 | 按钮 | [页面测试](../../../apps/admin/src/views/system/dept/__tests__/department-page.test.ts) 的 `reloads a newly created department under parent 1/2` 断言「新增根部门」数量为 0、「新增一级部门」为 1；`gates each operation independently` 同时验证行内「新增子部门」及各权限独立生效。 |
| 2 | 一级部门 | 同一页面用例断言 POST 输入 `parent_id=1`，保存后整树重新加载，详情 path 为 `1.9`，新节点缩进为 1。`uses the existing root ID even when search hides the entire tree` 另外验证根 ID 为 73、搜索无结果时仍提交 `parent_id=73`。 |
| 3 | 子部门 | 页面用例 `reloads a newly created department under parent 2` 点击 ID=2 行内「新增子部门」，断言 POST 输入 `parent_id=2`，保存后详情 path 为 `1.2.9`，树节点缩进为 2。 |
| 4 | 表单 | [表单测试](../../../apps/admin/src/views/system/dept/__tests__/department-form.test.ts) 的 `creates with the chosen parent 1/2` 断言一级创建时不存在 `[aria-label="上级部门"]`，更深层创建保留该字段；页面集成测试也验证同一 DOM 条件。 |
| 5 | 构建 | 命令、实际退出码与日志索引见 [verification.json](verification.json)。已运行完整仓库 lint、38 个任务的 typecheck、114 文件 / 796 用例的仓库 unit、19 文件 / 89 用例的应用 unit，以及 11 个任务的生产 build。 |

## 错误原文与边界回归

- `shows the backend message verbatim and retains the form: 已存在根部门，请选择上级部门` 已通过：HTTP 400 的 ApiError 保留该字符串，页面 `.ant-alert-message` 与原文完全相等，名称输入保留，未发出保存成功事件。重名错误仍独立覆盖。
- [API 请求测试](../../../apps/admin/src/api/__tests__/system.test.ts) 验证部门写请求使用 `preserveBusinessMessage: true`；[请求客户端测试](../../../apps/admin/src/api/__tests__/client.test.ts) 验证 HTTP 400/409 原文透传。
- 缺少种子根时禁用「新增一级部门」，点击不会打开表单或发送 POST。新增及非根编辑不再提供「无（根）」选项，创建时 `parent_id=0` 在本地校验失败。
- 编辑既有根时继续提交其原始 `parent_id=0`；用例 `still saves the existing root with its original parent` 验证改名保存能力。
- 部门回归经历实际红绿验证：[旧实现 8 个失败](00-unit-red.txt) → [修正后 3 文件 / 27 用例通过](00-unit-green.txt)。

## 复跑

```powershell
pnpm lint
pnpm check:type
pnpm test:unit
pnpm -F @vben/web-antd test:unit -- --reporter=verbose --reporter=json --outputFile=../../docs/evidence/sf-1b/unit-report.json
pnpm build:antd
node --check apps/admin/e2e/sf1.mjs
```

既有 [SF-1 浏览器脚本](../../../apps/admin/e2e/sf1.mjs) 已同步唯一根契约：复用现有根、改点「新增一级部门」、核对父级字段隐藏，以及只读权限按钮的新文案。JavaScript 语法检查通过。

## 验证范围与配套格式修正

本轮真实浏览器取证未执行完成：已有部门标签页处于 Chrome 扩展的挂起页面，浏览器工具的 URL 安全策略拒绝读取。以上第 1–4 项为组件级验收；没有真实后端写操作或数据清理。

首次完整 lint 检出了当前 HEAD 两张任务卡的 Markdown 表格格式问题。`docs/tasks/SF-1b.md` 与 `docs/tasks/SF-2.md` 只应用仓库格式化规则；逐单元格归一化后与 HEAD 内容比较一致。没有实现 SF-2 功能。

完整日志保留工具原有的非失败警告；每条命令的最终状态以 `verification.json` 的退出码及测试汇总为准。
