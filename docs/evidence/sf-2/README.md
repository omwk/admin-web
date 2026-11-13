# SF-2 验收证据

验收日期：2026-11-13；分支：`feat/sf-2-notify`。

## 验收环境

真实验收使用后端提交 `12a50e93f52adda7ed12a042c3c463151ffc40a3` 构建的 API、worker、PostgreSQL、Redis，以及本机回环 SMTP 服务。浏览器通知请求转发至真实 API，未模拟通知响应。脚本创建独立 schema、独占空 Redis DB、随机账号凭据与临时邮箱；25 条通知真实入库。SMTP 分别接收、拒绝和重试接收邮件。测试完成后停止自建进程、删除 schema、清空占用的 Redis DB 并删除临时构建产物，见 [运行与清理结果](real-runtime.json)。

原有 `127.0.0.1:18080` 进程未更新到 S3a：通知权限和菜单投影缺失，偏好接口 404，见 [原进程探测](backend-prerequisites.json)。本次未重启该进程；真实验收通过隔离后端完成。

## §4 十一条验收

1–10 的断言、HTTP 状态、trace_id 和零浏览器错误记录在 [真实验收结果](real-ui.json)。下表每条均可单独核对。

| # | 项 | 结果与证据 |
| --- | --- | --- |
| 1 | 列表 | 25 条真实入库通知；未读加粗；分页 20 / 5。[列表截图](01-inbox-real.png) |
| 2 | 未读筛选 | 仅未读 23 条，与顶栏角标 23 一致。[未读截图](02-unread-real.png) |
| 3 | 单条已读 | 点击详情后真实 API 的 read_at 已保存，角标 23 → 22；payload 按文本转义。[详情截图](03-read-real.png) |
| 4 | 全部已读 | 真实 API 未读总数归零，页面角标为零，行全部已读。[全部已读截图](04-read-all-real.png) |
| 5 | 偏好继承 | 未设置的开关置灰并显示「继承租户设置」，展示租户生效值。[继承截图](05-inheritance-real.png) |
| 6 | 偏好保存 | 仅提交 notification.default / email=false 一项；重开页面与 API 均保持关闭；提示「站内通知仍会收到」。[保存截图](06-preference-saved-real.png) |
| 7 | 服务商 CRUD | SMTP 新建、修改、删除及取消删除通过；API 和页面仅配置标记，编辑时私密字段为空并显示「已配置」。[私密字段截图](07-provider-private-real.png) |
| 8 | 测试发送 | 已确认按后端发送给当前账号；真实 SMTP 接收成功，显示「已发送，请查收」；真实 SMTP 拒绝后显示失败和 provider_delivery_failed。[成功](08-test-sent-real.png) / [失败原因](08-test-failed-real.png)。模拟 HTTP 失败补充验证后端 message 原文展示，见 [错误文案](08-test-backend-message-fixture.png)。 |
| 9 | 投递记录 | 失败记录真实重试后 sent，attempts 1 → 2；收件人只显示 hash / 域。模板编辑同时完成验证。[重试截图](09-delivery-retry-real.png) / [模板截图](09-template-real.png) |
| 10 | 权限 | 真实只读角色仅有 system:notify:list，即使保留渠道菜单授权也看不到渠道菜单、入口或管理视图；直接 GET providers 返回 HTTP 403、code=20107。[只读截图](10-read-only-real.png) / [真实 HTTP 记录](real-ui.json) |
| 11 | 构建 | lint / typecheck / unit / build 的最终退出码见 [检查汇总](checks.json)；输出见 [lint](lint.log)、[typecheck](typecheck.log)、[unit](unit.log)、[build](build.log)。 |

## 复现命令

先按仓库现有开发方式启动前端（默认 `http://127.0.0.1:5666`），确保 PostgreSQL 与 Redis 可用。验收脚本使用后端已有 smoke 工具，接收后端目录和 Redis 地址，不修改后端源码。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps/admin/e2e/sf2-real.ps1 -BackendRoot D:\code\go-admin-api -RedisAddress 127.0.0.1:16379
```

本次输出：

```text
Isolated schema=s3_smoke_c6287348a610467e92c9bf0028e44b01 Redis DB=1 migration=27 dirty=false (up/down/up)
{"source":"real-isolated-backend","passed":10,"browserErrors":0}
Owned processes stopped; remaining_schemas=0; remaining_redis_keys=0
```

补充确定性浏览器场景使用 [sf2.mjs](../../../apps/admin/e2e/sf2.mjs) 与 [sf2-fixtures.mjs](../../../apps/admin/e2e/sf2-fixtures.mjs)，通过现有本地后端登录后模拟通知响应；只用于验证排队状态、异常文案和界面交互，不作为真实持久化或 SMTP 的证据。结果为 10 项通过、浏览器错误 0，见 [模拟场景结果](fixture-ui.json) 和 [运行日志](fixture.log)。

```powershell
$env:SF2_ADMIN_PASSWORD = '<本地管理员密码>'
pnpm --filter @vben/web-antd test:e2e:sf2
pnpm lint
pnpm --filter @vben/web-antd typecheck
pnpm --filter @vben/web-antd test:unit
pnpm --filter @vben/web-antd build
```

## 安全与交付边界

保存后的配置通过允许字段和 *_configured 标记投影；私密表单字段不从响应填充，使用不可切换明文的 password 输入，提交成功与组件卸载时清空。测试发送失败保留后端业务文案；配置保存错误会替换本次填写的私密值。通知 payload 使用 Vue 文本插值；无富文本渲染。投递收件人沿用后端 hash / domain，不拼接完整地址。验收截图、JSON 与日志不保存 token、随机密钥或完整收件地址。

偏差：任务卡“填写收件人”已由用户确认调整为“发送给当前账号”，符合已合并 OpenAPI 与后端实现。未新增依赖、修改后端契约或数据库结构。保留工作区已有 SF-1b 与任务卡改动；本次不提交、推送、创建 PR 或合并。
