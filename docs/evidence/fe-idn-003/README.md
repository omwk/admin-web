# FE-IDN-003 验收证据

2026-11-15（Asia/Shanghai），分支 `feat/fe-idn-003-session-modes`，基线 `77f7f77`。

使用 Vite `http://127.0.0.1:5670`、真实后端 `http://127.0.0.1:18080` 和 Microsoft Edge（1440 × 1000、中文、上海时区）完成验收。浏览器请求通过开发代理，未模拟业务响应。[acceptance.json](acceptance.json) 记录实际状态码、撤销数量、trace ID、请求顺序与清理结果；[verification.json](verification.json) 记录检查命令及退出码。

## 卡片 §3 七条

| # | 项 | 结果与证据 |
| --- | --- | --- |
| 1 | 按钮 | 通过。本人存在 3 条会话时，顶部「下线其他设备」可用；只剩 1 条时禁用。组件测试另覆盖总数为 0、1 和服务端总数 21 的跨页情况。[多会话截图](01-multiple-sessions-real.png)、[单会话截图](05-single-disabled-real.png)，`acceptance.json` 第 1、5 项。 |
| 2 | 行操作 | 通过。后端返回唯一 `current=true` 行；该行显示「当前设备」且下线按钮数为 0；其余 2 行各有「下线」。组件测试还验证服务端标记优先于本地 sid、缺少标记时不提供撤销按钮。[截图](01-multiple-sessions-real.png)，第 2 项。 |
| 3 | 单条下线 | 通过。取消确认不发送写请求；确认后真实 DELETE 返回 204，目标行消失，列表由 3 条变 2 条；目标令牌的 me 返回 401/20103，当前及另一个会话仍为 200。[确认](03-single-confirm-real.png)、[完成](03-single-complete-real.png)，第 3 项。 |
| 4 | 下线其他 | 通过。确认文案为「将下线除当前设备外的 2 个会话，确定？」；真实 POST 返回 200、`revoked=2`，刷新后只剩当前 1 条并提示「已下线 2 个会话」。其他两个令牌 me 均为 401/20103，当前 me 为 200，刷新浏览器并使用当前 refresh token 恢复会话成功。取消确认不发送写请求。[确认](04-others-confirm-real.png)、[成功提示](04-others-complete-real.png)，第 4 项。 |
| 5 | 幂等 | 通过。仅剩当前会话时按钮禁用，点击不发送写请求；额外直接重复调用真实接口返回 200、`revoked=0`。[禁用截图](05-single-disabled-real.png)，第 5 项。 |
| 6 | 全部下线 | 通过。保留原二次确认；取消后当前会话仍可用。确认后 logout-all 返回 204，跳转 `/auth/login`，sessionStorage 为 0，当前令牌 me 返回 401/20103。[确认](06-all-confirm-real.png)、[登录页](06-all-login-real.png)，第 6 项。 |
| 7 | 构建 | 通过。lint、全仓 typecheck、全仓 unit、管理端 unit 和生产 build 均退出 0；定向 21 个会话测试复验也通过。命令、数量和完整日志见下表及 [verification.json](verification.json)。 |

## 检查命令

| 命令 | 实际结果 | 完整日志 |
| --- | --- | --- |
| `pnpm lint` | 退出 0 | [lint.txt](lint.txt) |
| `pnpm check:type` | 38/38 任务成功（37 个缓存命中） | [typecheck.txt](typecheck.txt) |
| `pnpm test:unit --maxWorkers=2` | 145 文件、942 测试通过 | [unit.txt](unit.txt) |
| `pnpm -F @vben/web-antd test:unit --maxWorkers=2` | 50 文件、235 测试通过 | [unit-admin.txt](unit-admin.txt) |
| `pnpm -F @vben/web-antd test:unit src/api/__tests__/self-service.test.ts src/views/_core/profile/__tests__/sessions.test.ts --maxWorkers=2` | 2 文件、21 测试通过 | [unit-focused.txt](unit-focused.txt) |
| `pnpm build:antd` | 11/11 任务成功（10 个缓存命中），生成 `apps/admin/dist` 和 `dist.zip` | [build.txt](build.txt) |
| `git diff --check` | 退出 0，无输出 | [verification.json](verification.json) |

新增测试先于实现运行，观察到 12 项因接口和页面操作尚不存在而失败；实现后定向 21 项全部通过。组件测试覆盖加载/操作锁、确认取消、失败恢复、服务端实际撤销数量、当前会话保护和删除后分页回退。lint 的三处静态规范问题修正后已复验通过。

日志包含现有依赖的图标名称提示、happy-dom 关闭请求的 AbortError 和 Vitest mock 提升提示；对应检查退出码均为 0。

## 复现及清理

从安全的本地配置向环境变量 `FE_IDN_003_ADMIN_PASSWORD` 注入默认租户管理员密码，启动开发服务后执行验收脚本：

```powershell
$env:VITE_ROUTER_HISTORY='history'
pnpm dev:antd --host 127.0.0.1 --port 5670 --strictPort
```

```powershell
pnpm exec node apps/admin/e2e/fe-idn-003.mjs
```

可使用 `FE_IDN_003_ORIGIN`、`FE_IDN_003_BACKEND` 覆盖地址。脚本通过现有管理 API 创建独立普通账号并完成初始密码修改；会话及撤销行为全部经过真实 API。

本次临时账号 ID 90 已删除（DELETE 204，随后 GET 404）；本次准备数据所用的管理员会话已登出（204）。浏览器错误为 0。证据不保存密码、访问令牌或刷新令牌，请求中的 sid 已替换为 `[sid]`。密码输入框统一遮罩。

偏差：无。实现及验收改动保留在指定功能分支的工作区。
