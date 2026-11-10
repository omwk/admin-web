# FE-2 · 商品列表与详情

- 依赖：FE-1（已合并，`v0.FE-1`）、后端 `v0.M9c`
- 预计：**8–12 人日**
- 分支：`feat/fe-2-catalog`
- 完成标志：真实数据下渲染商品列表（筛选/排序/深分页），点开详情看到 SKU 与关联 listing

---

## 1. 范围

| 做 | 不做 |
|---|---|
| 商品列表：分页、排序、状态/类目筛选 | 商品新建/编辑表单 |
| 深分页游标（`page > 100`） | 归并操作 UI（`/merge` 留 FE-3） |
| 商品详情：基本信息 + SKU + 关联 listing | 图片上传 |
| 类目下拉（`/admin/categories`） | 类目管理页面 |
| 导出入口（仅触发，不做进度页） | 库存调整 |

## 2. 后端契约（已在 `api/openapi/catalog.yaml`）

| 接口 | 用途 |
|---|---|
| `GET /api/v1/admin/products` | 列表：`page`、`page_size`（≤100）、`cursor`、`sort`、`category_id`、`status` |
| `GET /api/v1/admin/products/{id}` | 详情 |
| `GET /api/v1/admin/products/{id}/listings` | 该 SPU 关联的平台 listing |
| `GET /api/v1/admin/listings` | 平台商品列表 |
| `GET /api/v1/admin/categories` | 类目树 |
| `POST /api/v1/admin/products/export` | 触发导出（需 `Idempotency-Key`） |

排序枚举：`updated_at` / `-updated_at` / `title` / `-title` / `price_cents` / `-price_cents` / `price_min_cents` / `-price_min_cents`。

关键字段（以 spec 为准）：`id`、`title`、`status`、`category_id`、`price_min_cents`、`price_max_cents`、`sku_count`、`main_image`、`updated_at`。

## 3. 实现要求

### 3.1 列表

- 表格列：主图、标题、类目、价格区间、SKU 数、状态、更新时间
- 筛选：状态（多选）、类目（级联选择）、排序
- 翻页：`page ≤ 100` 用 offset；超过 100 自动切 `cursor`（沿用 FE-1 的分页组件）
- 空态与加载态区分；筛选变更后重置到第 1 页

### 3.2 详情

- 顶部：标题、状态、类目、价格区间、SKU 数
- SKU 表格：规格、编码、价格、库存
- 关联 listing：平台、外部 ID、状态、最后同步时间
- 未归并的 SPU 或缺失字段显示「—」，不渲染空白

### 3.3 金额与时间

- 金额 `int64` 分 → 展示层除以 100，保留两位；**禁止浮点运算后再格式化**
- 时间 RFC3339 UTC → 本地时区展示

### 3.4 权限

- 列表 `catalog:product:list`，详情 `catalog:product:read`，导出 `catalog:product:export`
- 无权限时菜单不出现（FE-1 已实现），直接访问路由 → 403 页面

## 4. 验收

| # | 项 | 断言 |
|---|---|---|
| 1 | 列表渲染 | 真实数据显示 ≥10 行，列与 spec 一致 |
| 2 | 分页 | 每页切换正确，总数与后端 `total` 一致 |
| 3 | 排序 | 四种排序切换后首行确实变化 |
| 4 | 类目筛选 | 选择父类目能带出子类目商品 |
| 5 | 深分页 | 造 >100 页数据（或用小 `page_size`）时自动走 cursor，无重复/遗漏 |
| 6 | 详情 | SKU 与 listing 数量与后端一致 |
| 7 | 空值 | 无 SKU / 无 listing 时显示「—」，不报错 |
| 8 | 金额 | 12345 → `123.45`；0 → `0.00` |
| 9 | 权限 | 无 `catalog:product:list` 的账号访问 → 403 页面 |
| 10 | 构建 | lint / typecheck / unit / build 全绿 |

## 5. 数据准备

FE-2 需要真实商品数据。二选一：

1. 跑一次 mock 平台同步（后端 `docs/api/local-dev.md` 的启动流程 + 触发同步）
2. 若同步不便，由后端同事在开发库插 100 条 SPU + 300 条 SKU 的种子脚本

**不要用前端 mock 数据代替**——FE-1 已经证明「夹具绿、真实接口红」。

## 6. 风险

| 风险 | 缓解 |
|---|---|
| 深分页游标与筛选组合行为未验证 | 先用 `page_size=5` 造 30 页，确认第 101 页正确 |
| 商品列表性能（10 万行） | 后端已验证 P95 109ms；前端只关心渲染，虚拟滚动留 FE-3 |
| 类目树结构未知 | 先打印一次真实 `/categories` 响应再写组件 |
