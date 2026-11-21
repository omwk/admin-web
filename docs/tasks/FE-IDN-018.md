# FE-IDN-018 · 组件注册表简写化

- ID: FE-IDN-018
- 类型: 重构
- 仓库: 前端
- 状态: 待实现
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
