# FE-IDN-013 · 通知完整性（前端）

- ID: FE-IDN-013
- 类型: 修复
- 仓库: 前端
- 状态: 待实现
- 预计: 2 人日
- 分支: `feat/fe-idn-013-notification-complete`
- 依赖: BE-IDN-018
- 依据: `docs/design/notification-audit-2.md`

---

## 1. 模板编辑器

### 1.1 变量面板

编辑器右侧（或下方）展示**当前模板可用变量**，数据来自
`GET /admin/notifications/templates/variables`：

| 列   | 内容                           |
| ---- | ------------------------------ |
| 变量 | `{{.UserName}}`                |
| 说明 | 收件人昵称，空则用户名         |
| 示例 | 张三                           |
| 必填 | 是 / 否                        |
| 操作 | 「插入」按钮（插入到光标位置） |

同一面板提供「必填变量缺失」提示。

### 1.2 预览

「预览」按钮：调用 preview 接口，在抽屉中显示渲染后的**主题 + 正文**，
并显示「用示例值渲染」的说明。

### 1.3 测试发送

「发送测试」按钮：调用 test 接口，成功后提示「已发送测试邮件，可在投递记录查看」。

### 1.4 保存前校验

正文引用了不在变量列表中的 `{{.Xxx}}` → 阻止保存并指出变量名。

## 2. 偏好页

- 显示模板**名称**（`name`），悬浮显示 code
- 事务性模板：开关禁用 + 提示「安全邮件（验证/重置/邀请）不可关闭」
- 分组：按 `transactional` 分为「安全邮件」「业务通知」

## 3. 角标与通知中心

### 3.1 角标

- `count === 0` 时**不显示角标**（去掉 `show-zero`）
- 60 秒轮询 + 窗口 focus 时刷新
- 请求失败时角标不显示，Tooltip 显示错误

### 3.2 通知中心

| 列   | 内容                  |
| ---- | --------------------- |
| 标题 | `title`（含未读圆点） |
| 摘要 | `summary`（两行截断） |
| 模板 | `template_name`       |
| 状态 | 未读 / 已读           |
| 时间 | 本地时间              |

- 点击行：标记已读（已有接口），并在详情抽屉显示完整正文
- 筛选：模板下拉用名称，未读/全部切换
- 「全部已读」保留

## 4. 公告发布

新页面 `/system/notifications/broadcasts`：

```
标题 [___________]
正文 [多行文本，最多 2000 字]
范围  ( ) 全部用户  ( ) 指定角色 [多选]  ( ) 指定用户 [搜索多选]
渠道  [x] 站内信  [x] 邮件
       发送前预览：将发送给 42 人
[预览人数] [发布]
```

- 发布前二次确认，显示人数与渠道
- 成功后提示「已发送给 N 人」并跳转历史
- 历史表格：标题、时间、范围、渠道、人数
- 无 `system:notify:broadcast` 权限时整页 403

## 5. 验收

| # | 项 | 断言 |
| --- | --- | --- |
| 1 | 变量面板 | 身份模板显示 AppName/UserName/TenantName/Link/ExpiresInHours/ExpiresAt/SupportEmail 及说明 |
| 2 | 插入 | 点击「插入」把变量插入光标处 |
| 3 | 未知变量 | 保存时阻止并指明变量名 |
| 4 | 预览 | 抽屉显示渲染后的主题与正文，无 `{{` |
| 5 | 测试发送 | 提示成功，投递记录出现一条 |
| 6 | 偏好名称 | 显示中文名，悬浮 code |
| 7 | 事务性 | 开关禁用并有说明；普通模板可切换 |
| 8 | 角标为 0 | 不显示角标 |
| 9 | 角标轮询 | 60 秒内新消息出现（或 focus 刷新） |
| 10 | 通知中心 | 显示标题与摘要，点击标记已读 |
| 11 | 模板筛选 | 下拉显示名称 |
| 12 | 公告页 | 三种范围人数正确，发布成功 |
| 13 | 公告权限 | 无权限 403 |
| 14 | 构建 | lint / typecheck / unit / build 全绿 |

## 6. Codex prompt

```
实现 docs/tasks/FE-IDN-013.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-013-notification-complete（从最新 main b6873ed 开）

后端已就绪（BE-IDN-018 合并后）：
  GET /admin/notifications/templates/variables
  POST /templates/{id}/preview 与 /test
  GET /preferences 返回 name + transactional
  POST /notifications/broadcasts/preview 与 /broadcasts
  GET /notifications 返回 title/summary/template_name

必读：本卡、docs/design/notification-audit-2.md、
template-form.vue、templates.vue、preferences.vue、
notification-badge.vue、index.vue、options.ts

改动：
1. 模板编辑器变量面板 + 插入 + 预览 + 测试发送 + 保存校验
2. 偏好页名称与事务性约束
3. 角标去掉 show-zero，0 隐藏，60s 轮询 + focus 刷新
4. 通知中心标题/摘要/模板名/点击已读/模板筛选
5. 公告发布页与历史（预览人数、二次确认、权限 403）

验收按卡片 §5 十四条逐条贴证据；第 1、3、4、10、12 条要截图。
完成后停下报告，并按 AGENTS §12 清理测试数据。
```
