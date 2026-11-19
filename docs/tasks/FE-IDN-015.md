# FE-IDN-015 · 个人资料可编辑与通知设置页

- ID: FE-IDN-015
- 类型: 修复
- 仓库: 前端
- 状态: 已完成，九项验收通过
- 预计: 1 人日
- 分支: `feat/fe-idn-015-profile-editable`
- 依赖: BE-IDN-019（个人渠道）

---

## 1. 现象

用户反馈「个人资料前端仍然是不可修改状态」。核查：

| 项 | 现状 |
| --- | --- |
| 昵称 | 可编辑 |
| 邮箱 | 可编辑 |
| 头像 | 可编辑（URL） |
| **手机** | **`disabled`，提示「暂不可修改，请联系管理员」** |
| 通知设置 tab | 是 vben 模板占位（账户密码/系统消息/待办任务），**与真实通知无关** |

所以「不可修改」的直接原因：手机禁用、以及通知设置页是假的。

## 2. 改动

### 2.1 手机可编辑

- 去掉 `disabled`，允许填写，按 E.164 校验（`+8613800138000`）
- 提示「仅用于联系，不用于短信通知」；保存手机号成功后显示「手机号已更新，仅用于联系，不用于短信通知」
- 冲突（已被他人占用）→ 显示后端 409 文案

后端 `ProfileInput` 已支持 `phone`，无需改接口。

### 2.2 头像

保留 URL 方式；增加实时预览（圆形头像）。

### 2.3 邮箱两步验证（BE-IDN-020 补充契约）

- 基本资料 PUT 仅提交昵称、头像、手机号；邮箱变化时另调 `POST /api/v1/auth/profile/email/change`。
- 202 后提示「验证邮件已发送到新邮箱，24 小时内有效」。验证前仍使用原邮箱，不能提前同步新邮箱。
- 新增公开页面 `/auth/email/verify`，仅从 URL fragment 读取 token，匿名调用 `POST /api/v1/auth/profile/email/verify`。
- 成功显示后端返回的新邮箱，3 秒后前往登录；保留企业代码。清除 URL 与浏览器历史中的 token，兼容生产 hash 路由。
- 失效或重复使用链接显示恢复入口，不直接展示后端错误细节。

### 2.4 通知设置 tab 替换

删除 vben 占位（`notification-setting.vue` 现在的内容），改为：

- 四个渠道入口：邮件 / Webhook / Bark / Gotify（卡片样式参考用户提供的布局）
- 每张卡显示状态：已启用 / 未配置 / 已验证
- 点击进入配置（与 FE-IDN-014 的 `/profile/notifications` 合并或复用同一组件）

> 如果 FE-IDN-014 已经新建独立页面，此 tab 直接复用其组件，不重复实现。

### 2.5 保存反馈

- 保存成功后同步更新全局用户信息（头像、昵称即时生效）
- 失败时字段级提示（邮箱格式、手机格式、冲突）

## 2.6 不做

通知设置 tab 只包含四渠道状态与配置入口；
**不含**配额阈值、通知邮箱覆盖、定价偏好等业务条件（后续业务层再规划）。

## 3. 验收

| #   | 项       | 断言                                                      |
| --- | -------- | --------------------------------------------------------- |
| 1   | 昵称     | 修改保存后右上角与资料页同步更新                          |
| 2   | 邮箱     | 申请变更 202；验证前旧邮箱有效，验证 200 后新邮箱登录成功 |
| 3   | 手机     | 可编辑并按 E.164 校验；保存成功后回显                     |
| 4   | 手机冲突 | 占用他人号码时显示后端 409 文案                           |
| 5   | 头像     | URL 有效时预览并保存生效                                  |
| 6   | 通知 tab | 显示邮件/Webhook/Bark/Gotify 四张卡，不再是占位内容       |
| 7   | 状态     | 未配置/已验证状态正确                                     |
| 8   | 无短信   | 全页不出现短信选项                                        |
| 9   | 构建     | lint / typecheck / unit / build 全绿                      |

### 验收记录（2026-11-20）

分支 `feat/fe-idn-015-profile-editable`，基于 `main 3a7d566`。使用生产 hash 路由、真实 API / SMTP / worker 验收；[完整记录与清理 SQL](../evidence/fe-idn-015/README.md)、[HTTP 结果](../evidence/fe-idn-015/acceptance.json)。

| # | 结果 | 证据 |
| --- | --- | --- |
| 1 | 昵称保存 200，右上角与资料页立即同步 | [昵称截图](../evidence/fe-idn-015/01-nickname-global.png) |
| 2 | 申请 202，匿名验证 200，新邮箱页面登录 200；验证前旧邮箱 200，之后 401。token 清除，跳登录保留企业代码 | [待验证](../evidence/fe-idn-015/02-email-pending.png)、[验证成功](../evidence/fe-idn-015/02-email-verified.png)、[新邮箱登录](../evidence/fe-idn-015/02-new-email-login.png) |
| 3 | 手机可编辑；E.164 错误拦截 0 次写入，保存 200 后刷新回显；真实冲突 409 | [格式校验](../evidence/fe-idn-015/03-phone-invalid.png)、[编辑保存成功](../evidence/fe-idn-015/03-phone-saved.png)、[409 冲突](../evidence/fe-idn-015/04-phone-conflict.png) |
| 4 | 后端 409 文案原样显示「该手机号已被使用」 | [409 文案](../evidence/fe-idn-015/04-phone-conflict.png) |
| 5 | URL 图片加载、圆形预览、保存后全局头像同步 | [头像截图](../evidence/fe-idn-015/05-avatar-preview.png) |
| 6 | tab 显示邮件 / Webhook / Bark / Gotify 四卡，共用 FE-IDN-014 组件 | [四渠道截图](../evidence/fe-idn-015/06-notification-tab.png) |
| 7 | 邮件已启用、Webhook 未配置、Bark 已验证、Gotify 未验证；Bark 实际投递 sent | [状态截图](../evidence/fe-idn-015/06-notification-tab.png)、[item 7](../evidence/fe-idn-015/acceptance.json) |
| 8 | 无短信选项；手机仅用于联系，未新增业务条件 | [手机提示](../evidence/fe-idn-015/03-phone-saved.png)、[通知选项](../evidence/fe-idn-015/06-notification-tab.png) |
| 9 | lint / typecheck / 应用 435 项 / 工作区 1142 项 / build 均退出 0 | [命令、退出码与日志](../evidence/fe-idn-015/verification.json) |

已清理：API DELETE + tenant/time 定向 SQL + 独立 schema 的 `audit-prune --before` + 删除自建 schema / 清空独占 Redis DB15 → 24 张相关表本卡记录为 0、原有 13 条审计与原数据保留、临时进程停止，未保留测试数据。见 [SQL 与影响行数](../evidence/fe-idn-015/cleanup.json)、[runtime](../evidence/fe-idn-015/runtime.json)、[最终资源复核](../evidence/fe-idn-015/final-resource-check.json)。

## 4. Codex prompt

```
实现 docs/tasks/FE-IDN-015.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-015-profile-editable（从 main 3a7d566 开）

后端已就绪（acae5f0）：PUT profile；POST profile/email/change；POST profile/email/verify。
个人渠道接口见 BE-IDN-019。

必读：本卡、views/_core/profile/base-setting.vue、index.vue、
notification-setting.vue（vben 占位，需替换）、
docs/design/notification-routing.md

改动：
1. 手机可编辑 + E.164 校验 + 冲突文案
2. 头像预览
3. 通知设置 tab 换成真实的四渠道（邮件/Webhook/Bark/Gotify），不含短信
4. 保存后同步全局用户信息
5. 邮箱通过变更申请与 fragment 验证两步生效

验收按卡片 §3 九条逐条贴证据，第 3、6 条要截图。
完成后停下报告，并按 AGENTS §12 清理测试数据。
```
