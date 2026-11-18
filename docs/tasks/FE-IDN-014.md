# FE-IDN-014 · 个人通知方式与偏好

- ID: FE-IDN-014
- 类型: 新增
- 仓库: 前端
- 状态: 待实现
- 预计: 1.5 人日
- 分支: `feat/fe-idn-014-personal-channels`
- 依赖: BE-IDN-019
- 依据: `docs/design/notification-routing.md`

---

## 1. 页面

### 1.1 个人资料 →「通知方式」

路径：`/profile/notifications`

```
账号渠道
  邮箱    zhang@acme.com        [已验证]  （不可在此修改，去基本资料）
  手机    138****1234            [已验证]

通知方式（对应参考布局的四个入口，**不含短信**）
  [邮件]     已启用   zhang@acme.com
  [Webhook]  未配置   [配置]
  [Bark]     https://api.day.app/****  [已验证] [测试] [删除]
  [Gotify]   未配置   [配置]

说明：企业微信/钉钉机器人由管理员配置，仅用于系统公告，个人不可用。
短信不作为个人通知方式（按条计费）。
```

配置弹窗：

```
渠道：Bark
地址：https://api.day.app/xxxxxxxx/通知标题
提示：填 App 里显示的完整推送地址
[发送测试]  [保存]
```

- 保存后自动发测试；成功才算「已验证」
- 列表只显示掩码
- 删除需二次确认

### 1.2 偏好页改造

`/system/notifications/preferences`：

| 渠道                | 显示条件             |
| ------------------- | -------------------- |
| 邮箱                | 有邮箱               |
| 短信                | 有手机且租户启用短信 |
| Webhook/Bark/Gotify | 已配置并验证         |

未满足条件时该列显示「未配置」+「去配置」链接（跳 `/profile/notifications`）。

事务性模板（验证/重置/邀请）：邮箱列固定开启且禁用，提示「安全邮件不可关闭」。

### 1.3 渠道配置页（管理员）

机器人渠道（企微/钉钉）下方加说明：

> 机器人渠道用于系统告警与公告，不发送个人通知。个人通知请让用户在「个人资料 → 通知方式」配置。

## 2. 验收

| #   | 项         | 断言                                 |
| --- | ---------- | ------------------------------------ |
| 1   | 个人页     | 展示账号渠道与个人渠道状态           |
| 2   | 配置 Bark  | 保存 → 测试成功 → 状态变「已验证」   |
| 3   | 掩码       | 列表显示掩码，不含完整 URL           |
| 4   | 测试失败   | 测试失败时提示原因，不置为已验证     |
| 5   | 删除       | 删除后偏好页对应列变「未配置」       |
| 6   | 偏好联动   | 配置 Bark 后偏好页出现 Bark 列       |
| 7   | 事务性     | 邮箱列禁用并有说明                   |
| 8   | 管理员说明 | 渠道配置页显示机器人用途提示         |
| 9   | 权限       | 普通用户看不到渠道配置页（已有）     |
| 10  | 构建       | lint / typecheck / unit / build 全绿 |

## 4. 不做（2026-11-19 确认）

以下项**本期一律不加**，等真实业务接入再规划：

- 配额告警阈值
- 通知邮箱覆盖（当前通知邮箱 = 账号邮箱，不可单独指定）
- 定价偏好（接受未定价模型等业务开关）
- 通知频率/静默时段/摘要模式

本卡只做：四个渠道的配置与验证 + 偏好页按可用性展示。

## 3. Codex prompt

```
实现 docs/tasks/FE-IDN-014.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-014-personal-channels（从最新 main 开）

后端已就绪（BE-IDN-019 合并后）：
  GET/PUT/DELETE /auth/notification-channels[/{channel}]，POST /{channel}/test
  偏好返回 available 与 reason

必读：本卡、docs/design/notification-routing.md、
views/_core/profile/（个人资料页结构）、views/system/notification/preferences.vue、
providers.vue（管理员渠道页）

改动：
1. 新增 /profile/notifications 页面（账号渠道 + 个人渠道 CRUD + 测试）
2. 偏好页按 available 显示，未配置给跳转
3. 事务性模板邮箱列禁用
4. 管理员渠道页加机器人用途说明

验收按卡片 §2 十条逐条贴证据，第 2、6 条要截图。
完成后停下报告，并按 AGENTS §12 清理测试数据。
```
