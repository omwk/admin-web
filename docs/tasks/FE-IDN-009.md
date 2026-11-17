# FE-IDN-009 · 移除硬编码路由，菜单完全由后端驱动

- ID: FE-IDN-009
- 类型: 重构
- 仓库: 前端
- 状态: 待实现
- 预计: 1 人日
- 分支: `feat/fe-idn-009-menu-driven`
- 依赖: BE-IDN-012（菜单种子补全）

---

## 1. 问题

前端为了让「菜单里没有、但页面已写」的页面能打开，在 `router/` 里合成路由：

| 文件 | 合成内容 | 注释自述 |
| --- | --- | --- |
| `catalog.ts` | `/catalog/products`、`/:id`、`/403` | “The live menu seed has no catalog entry” |
| `configuration-menus.ts` | `/system/dicts`、`/system/settings` | “fill absent backend projections” |
| `tenant-menus.ts` | `/system/tenants`、`/templates`、`/templates/:id` | 租户页与模板页 |

后果：

1. 菜单与路由**两套来源**，改一处漏一处
2. 侧边栏看不到，但地址栏能进——权限与可见性不一致
3. 归类无法维护（没有父目录概念）

## 2. 改动

### 2.1 删除路由合成

删除：

```
router/catalog.ts                     整个文件
router/configuration-menus.ts         整个文件（其中 configurationMenus 若是权限过滤需保留则改名保留）
router/tenant-menus.ts                整个文件
router/audit-menus.ts                 保留（只做权限过滤，不合成路由）
router/notification-menus.ts          保留（同上）
```

`access.ts` 中相应 import 与 `extraRoutes` 组装全部移除，只保留：

```
shell 路由（/home、/profile、/profile/sessions、/403）
+ 后端菜单生成的路由
```

### 2.2 详情页与子页

商品详情、模板编辑这类隐藏页由 **后端菜单的 `visible=false` 行**提供（BE-IDN-012）：

- 不出现在侧边栏
- 直接访问与刷新可用
- 仍受 permission_code 约束

要求：粘贴 `/catalog/products/7` 或 `/system/tenants/templates/3` 直接刷新，
不出现 404 或空白。

### 2.3 组件注册表

`component-registry.ts` 已有映射，保持不变；补充断言：

- 后端菜单中出现的每个 component 都必须在注册表内
- 注册表里有、但菜单从未引用的组件允许存在（未来页面）

### 2.4 缺失时的行为

如果后端菜单缺少某页（配置错误），前端应：

- 侧边栏不显示（符合预期）
- 直接访问该路径 → **404**，而不是悄悄用硬编码路由打开

这是本卡的核心验收：**让「菜单没配」变成可见的 404，而不是隐藏的可用**。

## 3. 验收

| # | 项 | 断言 |
| --- | --- | --- |
| 1 | 文件删除 | 三个 router 文件已删除，`access.ts` 无相关引用 |
| 2 | 菜单驱动 | 侧边栏出现：商品管理（商品目录下）、数据字典、系统配置（系统目录下） |
| 3 | 归类 | 目录顺序 系统/交易/商品/客户；子项归属正确 |
| 4 | 隐藏页 | 商品详情、模板编辑不出现在侧边栏 |
| 5 | 刷新直达 | 粘贴详情 URL 刷新正常打开 |
| 6 | 404 语义 | 临时从菜单删掉数据字典后，直接访问 `/system/dicts` 得到 404 |
| 7 | 权限 | 无 `product:spu:list` 的账号看不到商品菜单，直接访问 404/403 |
| 8 | 注册表覆盖 | 菜单中出现的 component 全部可在注册表解析 |
| 9 | 租户页 | 租户管理与模板页由菜单驱动，非平台管理员不可见 |
| 10 | 构建 | lint / typecheck / unit / build 全绿 |

## 4. 不做

- 页面视觉调整
- 菜单图标体系
- 保留任何「菜单缺失时自动补路由」的兜底

## 5. Codex prompt

```
实现 docs/tasks/FE-IDN-009.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-009-menu-driven（从最新 main d82c8c6 开）

后端已就绪（BE-IDN-012 合并并重跑 seed 后）：
  菜单补齐商品目录/商品管理/商品详情、数据字典、系统配置、租户模板
  隐藏页 visible=false；/auth/menus 结构不变

必读：本卡、apps/admin/src/router/access.ts、catalog.ts、
configuration-menus.ts、tenant-menus.ts、component-registry.ts、
docs/tasks/SF-5.md（菜单驱动方式）

改动：
1. 删除三个合成路由文件与 access.ts 中的组装逻辑
2. 仅保留 shell 路由 + 后端菜单路由
3. 详情/子页依赖后端 visible=false 菜单
4. 组件注册表覆盖断言

约束：
- 不保留「缺失时自动补路由」的兜底
- 不删 audit-menus / notification-menus 的权限过滤
- 不改 /auth/menus 的消费结构

验收按卡片 §3 十条逐条贴证据，第 6 条要贴 404 截图。
完成后停下报告，并按 AGENTS §12 清理测试数据。
```
