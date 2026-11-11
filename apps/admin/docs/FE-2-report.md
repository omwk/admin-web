# FE-2 商品列表与详情验收报告

分支：`feat/fe-2-catalog`。本次只处理 FE-2。列表、详情、独立权限和导出入口已接入真实接口；由于下面的后端契约与数据限制，不能将十条验收标记为全部通过。

验证日期：2026-11-11（Asia/Shanghai）。后端：`http://127.0.0.1:18080`。浏览器验证服务：`http://127.0.0.1:5667`，使用本仓库 Vite 配置代理 `/api`。原 5666 服务登录代理返回 502，因此另启服务验证。没有拦截或替换 API 响应，没有前端 mock 数据。

按用户要求顺序实施：先运行列表类型检查、45 个单测和真实浏览器列表脚本，再实现并验证详情，最后实施权限/导出和完整验收。原任务卡只统一了 Markdown 格式，以通过仓库全量格式检查，验收断言没有改动。

## 任务卡 §4 十条证据

| # | 验收项 | 结果 | 真实证据和限制 |
| --- | --- | --- | --- |
| 1 | 列表渲染 | 部分通过 | [browser-full.json](evidence/fe-2/browser-full.json) 的 `list-render`：20 行，ID 120→101，七列完整。[列表截图](evidence/fe-2/list.png)。列表响应没有 `category_id` 或类目名称，所以类目列显示「—」，该字段等待后端补充。 |
| 2 | 分页 | 通过 | 同文件 `page-2`：第 2 页 ID 100→81，每页 20 条；每页 1 条时总数仍为 120。所有渲染行 ID 与响应逐条匹配，总数与 `data.total` 相同。 |
| 3 | 四种排序 | 通过 | 同文件 `four-sorts`：依次 `updated_at` 首行 1、`-price_min_cents` 首行 120、`price_min_cents` 首行 1、`-updated_at` 首行 120；相邻切换首行都变化且回到第 1 页。演示数据价格与更新时间的 ID 顺序一致，因此不宣称四种排序拥有四个不同首行。 |
| 4 | 父类目含子类目 | 后端阻塞 | `parent-category-contract-gap`：选择电子产品发送 `category_id=1`，total=8。[契约探测](evidence/fe-2/contract-probes.json) 中子类目 6、7 各有 8 条，父类目查询未包含它们。[截图](evidence/fe-2/parent-category.png)。页面明确提示当前接口仅精确筛选；没有虚构后代参数，也没有在前端拼接分页结果。 |
| 5 | 深分页 | 默认排序通过，其他排序受限 | `offset-100-cursor-101-through-120`：`page_size=1`，第 100 页用 offset，ID 21；101→120 页只发 cursor、不发 page，ID 连续 20→1，无重复/遗漏。`cursor-backward-cache` 验证返回第 101 页；`cursor-direct-jump-bridge` 验证直接跳 105 自动从 100 衔接。[截图](evidence/fe-2/cursor-page-101-plus.png)。其他排序超过 100 页会给出提示，原因见后文。 |
| 6 | 详情数量一致 | 现有数据通过 | `nested-detail` 和 [详情截图](evidence/fe-2/detail.png)：SPU 20 显示 2 条 SKU、0 条 listing，与响应一致；详情直接刷新成功。读取的是 `data.product / data.skus / data.listings`。[原始详情样本](evidence/fe-2/detail-response.json) 另保留 SPU 120 的真实结构。库中 listing 总数为 0，所以非空 listing 行尚无真实数据覆盖。 |
| 7 | 无 SKU / listing、空字段 | 部分通过 | 无 listing 显示「—」，空主图/缺失类目/缺失 SKU 库存均显示「—」，浏览器无未捕获异常。`empty-product-data-blocked`：通过真实创建接口准备无 SKU 商品，后端返回 HTTP 500 / code 10002，trace_id=`01M73TM8N0D0C0CFZ0D37CTXZ8`，因此无 SKU 浏览器场景未覆盖。组件已按空数组显示「—」，未用 mock 替代证据。 |
| 8 | 金额 | 通过 | `browser-integer-cents`：12345→`123.45`，0→`0.00`，int64 最大值字符串→`92233720368547758.07`。单测覆盖负数、缺失值、非整数及不安全 Number。金额先按整数标准化后切分字符串；API 在 JSON.parse 前保留超出安全整数范围的原文，无金额浮点运算。 |
| 9 | 无列表权限访问 403 | 通过 | `sales-direct-route-403`：真实无角色账号权限数量 0，直接访问 `/catalog/products`、`/catalog/products/120` 都进入 `/403`。[截图](evidence/fe-2/sales-403.png)。`sales-guard-before-api`：守卫拦截期间商品/类目 API 请求为 0，菜单与导出按钮隐藏。list/read/export 的独立性由权限单测覆盖。 |
| 10 | lint / typecheck / unit / build | 通过 | [lint](evidence/fe-2/lint.txt)、[typecheck](evidence/fe-2/typecheck.txt)、[unit](evidence/fe-2/unit.txt)、[build](evidence/fe-2/build.txt) 记录完整命令、退出码和输出。lint 零错误（保留仓库原有 21 条警告）；admin 单测 9 文件、47 条通过；类型检查和生产构建退出 0。 |

## 额外范围证据

- 状态筛选：`status-draft` 返回 total=40，20 行全部 draft；筛选/排序/类目/每页条数变更重置分页并清除游标。
- 请求竞态：最终 [browser-detail.json](evidence/fe-2/browser-detail.json) 的 `live-filter-race-cancels-old-response` 使用真实接口验证旧请求取消后只显示草稿结果。
- 导出：`real-export-trigger` 从页面触发真实 `POST /admin/products/export`，携带 `Idempotency-Key`，body 为 `{ "filters": {}, "sort": "-updated_at" }`；HTTP 201，返回 export_id=1、status=running。[导出截图](evidence/fe-2/export.png)。请求只包含已应用的筛选和排序，不包含分页；失败后相同查询重试复用幂等键。未实现进度页。
- 首次真实类目响应已在写组件之前打印并保存到 [categories-response.json](evidence/fe-2/categories-response.json)。实际是 15 条平铺数组，通过 `parent_id` 构成 5 个父类目、10 个子类目的级联选项。
- 所有页面日期沿用 FE-1 的 RFC3339→本地时区格式化。缺失或非法时间显示「—」。

## 待补契约和数据

| 差异 | 观察/证据 | 当前前端处理与后端需要补充的内容 |
| --- | --- | --- |
| 权限名称 | 任务卡为 `catalog:product:list/read/export`；真实权限/OpenAPI 为 `product:spu:list/read/export` | 显式逐项兼容这两组名称，不推导其他权限或接受通配符。后端需要统一文档命名。 |
| 后端商品菜单缺失 | `/auth/menus` 只提供系统、交易、客户 | 根据真实 list 权限补充本地商品入口；保留后端菜单；同路径去重。详情路由隐藏；已验证无权限账号不出现菜单。 |
| 列表类目缺失 | [products-response.json](evidence/fe-2/products-response.json) 无 `category_id` | 列表展示「—」；需要列表投影补充类目 ID/名称，未逐行额外请求详情来伪造列表字段。 |
| 状态只支持一个值 | `status=active,draft` 返回空集；后端使用 `p.status=?` | UI 保留多选输入，多选时提示仅支持单个状态并停止请求；单选和全部状态可用。后端需约定并实现多状态 OR 参数后才能通过完整多选要求。 |
| 父类目精确筛选 | 父类目 1 total=8，子类目 6/7 各 total=8 | 提示当前结果不含子类目；需要后端实现子树筛选。 |
| 游标排序不通用 | [final-contract-probes.json](evidence/fe-2/final-contract-probes.json)：升序在第 100 页 ID 100 后，第 101 页错误返回 ID 1；后端固定按 `(updated_at,id)<` 续页 | 仅 `-updated_at` 保证续页正确。其他排序超过 100 页阻止请求并提示切换排序。价格倒序在当前演示数据偶然一致，不能推广到任意数据。后端需按排序列和方向生成/消费游标。 |
| SKU 库存不在详情投影 | `ProductSKUView` 明确省略内部库存；真实 SKU 没有库存字段 | 每条 SKU 库存显示「—」，没有将聚合 `reported_stock` 当成单 SKU 库存。需要安全的 SKU 库存契约。 |
| listing 平台只有 ID | 详情 listing 投影只有 `platform_id`，无平台名；当前库 listing total=0 | 表头标为“平台 ID”，不虚构平台名称和映射接口。需真实关联 listing 数据补足非空场景验收。 |
| 无 SKU 数据准备失败 | 真实创建请求 HTTP 500 / code 10002，trace 见第 7 项 | 未改后端或数据库，未加入商品编辑/归并页面。现有商品 total 保持 120；等待可用空 SKU 商品或修复开发数据创建问题。 |
| OpenAPI schema 不完整 | 商品列表只描述返回页；详情 product/skus/listings 仍是无字段 object；sort/status 未完整列在列表 parameters | 本次类型以真实响应及只读后端代码核实；需后端补全 schema 和过滤/游标约束。 |

## 复现

在仓库根目录执行：

```powershell
pnpm --filter @vben/web-antd dev --host 127.0.0.1 --port 5667
```

另开终端配置 `FE2_ORIGIN=http://127.0.0.1:5667`、`FE2_ADMIN_PASSWORD`、`FE2_SALES_PASSWORD`（使用后端本地开发文档中的密码，密码不写入仓库），执行：

```powershell
pnpm --filter @vben/web-antd test:e2e:fe2
```

脚本会访问真实后端、触发一次导出，并尝试创建和清理无 SKU 验证商品。若仅需只读验证列表和详情：`node apps/admin/e2e/fe2.mjs --phase=detail`。验收脚本在明确的契约/数据阻塞处记录 blocked；退出 0 代表脚本中的可运行断言通过，不代表十条验收全部满足。

最终停在 FE-2，未实现 FE-3、归并、新增/编辑表单或库存调整。
