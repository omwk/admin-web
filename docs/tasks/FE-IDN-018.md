# FE-IDN-018 · 组件注册表简写化

- ID: FE-IDN-018
- 类型: 重构
- 仓库: 前端
- 状态: 已实现，验收完成（2026-11-21）
- 预计: 0.3 人日
- 分支: `feat/fe-idn-018-registry`
- 依赖: BE-IDN-026（菜单简写）

---

## 1. 背景

后端菜单的 `component` 将统一为简写：`system/user/index`。
前端注册表现在同时接受 `/system/user/index.vue` 与 `system/user/index` 两套键，
存在重复与歧义。

## 2. 改动

### 2.1 注册表改为简写键

```ts
export const componentRegistry = {
  'system/user/index': () => import('#/views/system/user/index.vue'),
  'system/storage/index': () => import('#/views/system/storage/index.vue'),
  'system/files/index': () => import('#/views/system/files/index.vue'),
  …
};
```

### 2.2 解析器归一化

`resolveComponent(component)`：

```
去掉前导 /
去掉 .vue 后缀
若键不存在 → 返回 forbidden 组件并 console.warn（不做模糊匹配）
```

- 兼容处理：把旧全路径映射到简写键（一次性），并标注 TODO 删除时间
- 不做「猜路径」（例如 `system/user` 自动补 `/index`），避免掩盖配置错误

### 2.3 契约测试

- 从后端菜单 fixtures 中取出所有 component，断言每一个都能在注册表解析
- 注册表里存在但菜单未引用的键，允许（未来页面）

## 3. 验收

| #   | 项     | 断言                                                   |
| --- | ------ | ------------------------------------------------------ |
| 1   | 简写键 | 注册表全部为 `domain/page/index` 形式                  |
| 2   | 解析   | 简写、带前导斜杠、带 `.vue` 三种输入都能解析到同一组件 |
| 3   | 未知键 | 返回 forbidden 并 warn，不白屏                         |
| 4   | 契约   | 后端菜单全部 component 可解析                          |
| 5   | 页面   | 所有菜单可打开（人工点一遍）                           |
| 6   | 构建   | lint / typecheck / unit / build 全绿                   |

## 4. Codex prompt

```
实现 docs/tasks/FE-IDN-018.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-018-registry（从最新 main 开）

后端已就绪（BE-IDN-026 合并后）：菜单 component 全部为简写。

必读：本卡、apps/admin/src/router/component-registry.ts、
access.ts、menus 相关测试

改动：
1. 注册表键改为 domain/page/index
2. resolveComponent 归一化（去前导斜杠、去 .vue），未知键给 forbidden + warn
3. 契约测试：后端菜单 component 全部可解析

约束：
- 不做模糊匹配
- 必须与 BE-IDN-026 同批合并（单独上线会白屏）

验收按卡片 §3 六条逐条贴证据；第 5 条要逐个菜单截图验证。
完成后停下报告，并按 AGENTS §12 清理测试数据。
```

## 5. 验收记录（2026-11-21）

分支 `feat/fe-idn-018-registry`，基线 `ad8c47a`。
后端 fixture 固定到 `23872a6`；当前后端 seed 源码与该提交一致，实际 `/auth/menus` 返回的 20 个页面逐项比对通过。

| # | 结果 | 证据 |
| --- | --- | --- |
| 1 | 注册表全部使用无前导 `/`、无 `.vue` 的简写键 | `component-registry.test.ts` 全注册表断言；[完整报告](../evidence/fe-idn-018/acceptance.md) |
| 2 | 简写、带前导斜杠、带 `.vue` 及旧 views 前缀均解析到同一 loader | 7 组归一化输入测试；旧前缀兼容注明 2027-02-28 后删除 |
| 3 | 未知键返回 forbidden 并 warn，禁用缓存；不自动补 `/index` | 11 组拒绝输入测试及真实 Vben 路由 loader 断言 |
| 4 | 后端 20 个页面全部可解析并生成真实路由，包括 3 个隐藏页 | [接口契约比对](../evidence/fe-idn-018/backend-menu-contract.json)、[运行记录](../evidence/fe-idn-018/runtime.json) |
| 5 | 17 个可见菜单及 3 个隐藏页逐个点击、截图 | [20 页逐项截图索引](../evidence/fe-idn-018/acceptance.md)、[截图路径与时间](../evidence/fe-idn-018/screenshots.json) |
| 6 | lint / typecheck / unit / build 通过 | [命令及退出码](../evidence/fe-idn-018/checks.json)、[lint](../evidence/fe-idn-018/lint.txt)、[typecheck](../evidence/fe-idn-018/typecheck.txt)、[unit](../evidence/fe-idn-018/unit.txt)、[build](../evidence/fe-idn-018/build.txt) |

说明：`channels`、`detail`、`template-editor` 等后端明确指定的非 index 页面保留其实际文件名，未改成虚构的 `/index`。订单、客户列表、询盘沿用已有占位页。文件页在本卡隔离环境中显示未配置对象存储提示，页面正常渲染。

已清理：在开发数据库的本卡独占 schema 中执行 `audit-prune --before 2026-11-21T15:39:50.505Z` → `deleted=12`；测试商品和模板经 API 删除，随后 `DROP SCHEMA feidn018_runtime_1795270630026 CASCADE` → 残留 0；独占 Redis DB13 残留 0。清理脚本修正令牌过期及商品删除 version 参数后重跑通过，原有 public 业务数据、审计行摘要一致。详见[浏览器验收清理记录](../evidence/fe-idn-018/cleanup-browser-run.json)及[完整重跑记录](../evidence/fe-idn-018/runtime.json)。未保留本卡测试数据，未修改开发库系统配置。

上述摘要比较截至清理完成（2026-11-21 15:41:36 UTC）。后续只读复核发现共享库在 17:33:17 UTC 更新用户 109、新增审计 2633，已原样保留；本卡残留仍为 0，见[最终检查](../evidence/fe-idn-018/final-state.json)。
