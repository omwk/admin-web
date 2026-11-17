# FE-IDN-010 · 通知渠道表单修正

- ID: FE-IDN-010
- 类型: 修复
- 仓库: 前端
- 状态: 待实现
- 预计: 0.5 人日
- 分支: `feat/fe-idn-010-channel-form`
- 依赖: BE-IDN-014（错误可诊断）

---

## 1. 现象

新建 SMTP 渠道的截图里：

```
SMTP 地址（host:port）  [•••••••••]   ← 掩码显示
SMTP 用户名             [请输入]
SMTP 密码               [•••••••••]
发件人邮箱              [•••••••••]   ← 掩码显示
```

三个问题：

1. **非敏感字段被掩码**：`smtp_addr`、`from_address`、`username` 在
   `provider-fields.ts` 里都标了 `private: true`，于是渲染成 `Input.Password`。
   用户看不见自己填的地址，无法核对。
2. **无占位与格式提示**：`host:port` 只写在标签里，用户直接填 `smtp.163.com`。
3. **错误无定位**：只显示顶部「通道配置无效」，不知道哪个字段有问题。

## 2. 改动

### 2.1 修正 private 标记

只有真正的秘密才掩码：

| 字段 | 掩码 | 说明 |
| --- | --- | --- |
| `password`、`api_key`、`access_key_secret`、`secret` | ✅ | 秘密 |
| `access_key_id` | ⚠️ 不掩码 | 标识而非秘密 |
| `smtp_addr`、`from_address`、`from_name`、`username`、`endpoint`、`region`、`sign_name`、`template_code` | ❌ | 可见可核对 |

编辑态仍保留「已配置」提示（值不回显），这条逻辑不变。

### 2.2 占位与提示

| 字段 | 占位 | 提示 |
| --- | --- | --- |
| `smtp_addr` | `smtp.163.com:465` | 587 端口通常配 STARTTLS，465 配 TLS |
| `username` | `appvae@163.com` | 163/QQ 邮箱需填写完整邮箱地址 |
| `password` | 输入授权码 | 163 等邮箱使用授权码，不是登录密码 |
| `from_address` | `noreply@example.com` | 必须与发件人权限一致 |
| `endpoint` | `https://example.com/hook` | 必须是 http(s) |
| `from_name` | `订单通知` | 显示在收件人邮箱里 |

提示文案用 `text-xs text-gray-500`，与现有风格一致。

### 2.3 后端字段错误定位

BE-IDN-014 起，400 响应带 `details.field` 与具体 message：

```json
{
  "code": 10001,
  "message": "SMTP 地址需包含端口，例如 smtp.163.com:465",
  "details": { "field": "smtp_addr" }
}
```

前端：

- 有 `details.field` 时，把 message 显示在该输入框下方（红框）
- 无 `field` 时，显示在顶部横幅（保持现状）
- 用户修改该字段后清除错误

### 2.4 类型切换

切换「类型」（SMTP → 阿里云邮件等）时：

- 清空上一个 kind 的 config 值（避免把 smtp_addr 带到 sendgrid）
- 保留 name/priority/enabled
- 清除已显示的字段错误

## 3. 验收

| #   | 项         | 断言                                                      |
| --- | ---------- | --------------------------------------------------------- |
| 1   | 地址可见   | SMTP 地址、发件人邮箱、用户名输入框为明文                 |
| 2   | 密码仍掩码 | 密码、api_key、access_key_secret 仍为掩码                 |
| 3   | 占位       | 各字段显示对应占位与提示                                  |
| 4   | 字段错误   | 填 `smtp.163.com`（无端口）→ 错误显示在 SMTP 地址下方     |
| 5   | 认证错误   | 只填密码不填用户名 → 错误显示在用户名下方，文案提到用户名 |
| 6   | 清除       | 修改该字段后错误消失                                      |
| 7   | 顶部兜底   | 后端未给 field 时，错误仍显示在顶部横幅                   |
| 8   | 类型切换   | 切换类型后 config 清空、错误清除、name 保留               |
| 9   | 成功       | 完整配置提交成功（201）并出现在列表                       |
| 10  | 构建       | lint / typecheck / unit / build 全绿                      |

## 4. 不做

- 连接测试按钮（已有 `/providers/:id/test`，本卡不改）
- 各邮件服务商的预设模板（可后续加）

## 5. Codex prompt

```
实现 docs/tasks/FE-IDN-010.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-010-channel-form（从最新 main 6053954 开）

后端已就绪（BE-IDN-014 合并后）：
  400 响应带 message（中文具体原因）与 details.field

必读：本卡、apps/admin/src/views/system/notification/provider-fields.ts、
provider-form.vue、components.test.ts、options.ts（掩码判定）

改动：
1. 修正 private 标记：只有 password/api_key/access_key_secret/secret 掩码
2. 各字段加占位与提示（见卡片 §2.2）
3. details.field 存在时把错误显示在对应字段下方，修改后清除
4. 切换类型时清空 config 与错误，保留 name/priority/enabled

验收按卡片 §3 十条逐条贴证据：
- 第 1、2 条贴表单截图
- 第 4、5 条贴字段级错误截图（真实后端）
完成后停下报告，并按 AGENTS §12 清理测试数据。
```
