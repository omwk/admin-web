# FE-IDN-011 · 投递记录页改造

- ID: FE-IDN-011
- 类型: 修复
- 仓库: 前端
- 状态: 已实现，验收通过（2026-11-18）
- 预计: 0.5 人日
- 分支: `feat/fe-idn-011-delivery-page`
- 依赖: BE-IDN-015（投递记录可读与可操作）

---

## 1. 现状问题

| 列       | 现在                  | 应该                                  |
| -------- | --------------------- | ------------------------------------- |
| 模板     | `identity.verify`     | 「身份验证」+ 悬浮显示 code           |
| 收件人   | `hash: —` `域: —`     | `a***@163.com`                        |
| 状态     | 待发送 / 已发送       | 四态：待发送 / 已发送 / 失败 / 已跳过 |
| 失败原因 | `message_unavailable` | 「消息内容已过期或模板已删除」        |
| 操作     | 空                    | 失败/卡住可重试                       |

## 2. 改动

### 2.1 列表

| 列       | 内容                                                     |
| -------- | -------------------------------------------------------- |
| 时间     | 本地时间，精确到秒，悬浮显示 UTC                         |
| 模板     | `template_name`，悬浮显示 `template_code`                |
| 渠道     | 邮件 / 短信 / 企微 / 钉钉 / Webhook                      |
| 收件人   | `recipient_masked`；为空显示 `—`（旧记录）               |
| 状态     | 四态标签：pending 橙、sent 绿、failed 红、skipped 灰     |
| 尝试次数 | 数字                                                     |
| 失败原因 | 中文 `last_error_message`，悬浮显示原始码                |
| 操作     | 「重试」（failed / skipped / 卡住 5 分钟以上的 pending） |

### 2.2 筛选

顶部筛选条：

```
状态 [全部▾]  渠道 [全部▾]  模板 [全部▾]  [查询] [重置]
```

模板下拉从模板列表接口取（`code - name`）。

### 2.3 重试

- 单条：行内「重试」，成功后该行变为「待发送」并提示
- 批量：勾选多行 → 顶部「批量重试」，结果提示 `成功 N 条，跳过 M 条`
- 不可重试的行（sent / 5 分钟内的 pending）按钮禁用并说明原因

### 2.4 空态与卡住提示

- 无记录：显示「暂无投递记录」，并说明「通知触发后会出现在这里」
- 存在 5 分钟以上、`attempts=0` 的 pending：顶部提示条

```
有 N 条投递长时间未发送，可能是 worker 未启动。
[全部重新入队]
```

这条提示是本次问题的直接解法——**让「worker 没起」一眼可见**。

## 3. 验收

| #   | 项       | 断言                                      |
| --- | -------- | ----------------------------------------- |
| 1   | 模板列   | 显示中文名，悬浮显示 code                 |
| 2   | 收件人   | 显示掩码邮箱/手机；旧记录显示 `—`         |
| 3   | 状态四态 | 颜色与文案正确                            |
| 4   | 失败原因 | 中文原因；悬浮原始码                      |
| 5   | 单条重试 | failed 行重试后变待发送                   |
| 6   | 批量重试 | 勾选 3 条混合状态 → 提示成功/跳过数       |
| 7   | 禁用     | sent 行重试按钮禁用并说明                 |
| 8   | 筛选     | 状态/渠道/模板单独与组合生效              |
| 9   | 卡住提示 | 存在超时 pending 时显示提示条并可批量入队 |
| 10  | 空态     | 无数据显示空态文案                        |
| 11  | 构建     | lint / typecheck / unit / build 全绿      |

验收记录（2026-11-18）：§3 十一项证据、真实接口 trace、截图与检查日志见 [FE-IDN-011 验收记录](../evidence/fe-idn-011/README.md)。第 2 项掩码邮箱/手机及旧记录 `—`、第 9 项两条超时 pending 提示条均已截图；单条重试刷新后为 pending，三条混合批量重试成功 2 / 跳过 1。

已清理：本卡五次验收/调试夹具共 127 行已按 ID/code/User-Agent 限定删除；`go run ./cmd/cli audit-prune --before 2026-11-18T11:14:02.3794858+00:00` → `deleted=0`。用户、模板、投递、outbox、会话及本卡审计余量为 0，原数据哈希校验一致。逐条 SQL 与影响行数见 [清理记录](../evidence/fe-idn-011/cleanup.json)，全局复核见 [cleanup-verify.json](../evidence/fe-idn-011/cleanup-verify.json)。

## 4. 不做

- 查看收件人明文
- 投递记录导出
- 模板内容预览

## 5. Codex prompt

```
实现 docs/tasks/FE-IDN-011.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-011-delivery-page（从最新 main 开）

后端已就绪（BE-IDN-015 合并后）：
  GET /deliveries?status=&channel=&template_code=
  返回 template_name、recipient_masked、last_error、last_error_message
  POST /deliveries/{id}/retry；POST /deliveries/retry {ids}

必读：本卡、apps/admin/src/views/system/notification/deliveries.vue、
docs/tasks/SF-3.md（通知页现状）

改动：
1. 列改造：模板名/掩码收件人/四态/中文失败原因/重试
2. 筛选条：状态、渠道、模板
3. 单条与批量重试
4. 卡住 pending 的提示条与批量入队
5. 空态

验收按卡片 §3 十一条逐条贴证据；
第 2 条贴掩码显示截图，第 9 条贴卡住提示截图。
完成后停下报告，并按 AGENTS §12 清理测试数据。
```
