# FE-IDN-004 · 状态文案改用字典

- ID: FE-IDN-004
- 类型: 重构
- 仓库: 前端
- 状态: 待实现
- 预计: 1.5 人日
- 分支: `feat/fe-idn-004-dict-consume`
- 依赖: BE-IDN-008（字典种子）

---

## 1. 背景

各页面的状态文案都是硬编码三目运算：

```vue
{{ record.status === 'active' ? '启用' : '停用' }}
{{ record.result === 'success' ? '成功' : '失败' }}
{{ record.enabled ? '启用' : '停用' }}
```

租户页更直接显示后端原值（`suspended`）。字典存在但不被消费，等于没有。

## 2. 改动

### 2.1 统一组件

新增 `apps/admin/src/components/dict-tag/`：

```
<DictTag type="product_status" :value="record.status" />
```

行为：

- 从 `useMetaDictionary(type)` 取项，按 `value` 匹配 `label` 与 `color`
- **缺项时显示原值**（`suspended`），不显示空白
- 字典请求失败时不阻塞渲染，回退原值
- 支持 `size` / `show-dot` 等展示参数

### 2.2 替换清单

| 页面 | 位置 | 改为 |
| --- | --- | --- |
| 部门 | 状态列、表单选项 | `enable_status` |
| 角色 | 状态列、表单选项 | `enable_status` |
| 菜单 | 状态列、表单选项 | `enable_status` |
| 用户 | 状态列（含 locked） | `user_status` |
| 租户 | 状态列 | `tenant_status` |
| 审计日志 | 结果列 | `audit_result` |
| 登录历史 | 结果列 | `audit_result` |
| 通知-投递记录 | 状态列 | `delivery_status` |
| 通知-渠道/模板 | 启用列 | `enable_status` |
| 商品列表/详情 | 状态列 | `product_status`（已有调用，改用组件） |

### 2.3 表单下拉

状态选择器改为字典驱动：

```ts
const options = await dictionary.options(); // [{label,value,color}]
```

字典为空时回退到内置的最小选项集合，避免页面不可用。

## 2.4 系统字典的可编辑范围（对齐后端）

现状不一致：后端允许改系统字典的 name/status 与项的 label/color/sort/status，
前端却把整个表单禁用（`scope === 'system'` 直接 return）。

改为：

| 操作                               | 系统字典       | 业务字典       |
| ---------------------------------- | -------------- | -------------- |
| 新建/删除字典                      | 隐藏           | 允许（清空后） |
| 新增/删除项                        | 隐藏           | 允许           |
| 改 value / type                    | 隐藏并只读展示 | 允许           |
| 改 name / status                   | **允许**       | 允许           |
| 改项 label / sort / color / status | **允许**       | 允许           |

界面提示：「系统字典的码值由代码定义，只能调整名称、排序与显示颜色。」

## 2.5 字典请求复用

现状：每个 `DictTag` 各自请求 `/meta/dicts/{type}`，同一页面多个标签会重复取数。

要求：

- 同一 type 在**一次页面生命周期内只请求一次**，带 5 分钟内存缓存
- 批量场景（如表格 20 行状态列）共用一次请求
- 缓存键为 type，跨页面共享

## 2.6 自举兜底（前端部分）

字典管理页自身的「状态」下拉**不得依赖任何字典**：

- 使用本地固定两项：`active` 启用 / `disabled` 停用
- 即使 `user_status` 被停用或缺失，维护页仍可用

## 3. 验收

| #   | 项       | 断言                                           |
| --- | -------- | ---------------------------------------------- |
| 1   | 组件     | `DictTag` 正确渲染 label 与颜色                |
| 2   | 缺项回退 | 未配置的 value 显示原值，不空白                |
| 3   | 接口失败 | 字典接口 500 时页面仍渲染原值                  |
| 4   | 商品状态 | 改 `product_status` label 后刷新即变           |
| 5   | 租户状态 | 显示「已停用」而非 `suspended`                 |
| 6   | 审计结果 | 显示「成功/失败」来自字典                      |
| 7   | 表单     | 状态下拉选项来自字典                           |
| 8   | 无硬编码 | `grep` 不再命中 `=== 'active' ? '启用'` 等模式 |
| 9   | 构建     | lint / typecheck / unit / build 全绿           |

## 4. 不做

- 业务状态机文案（如订单展示态 `pending_shipment`）——它由后端 SQL 计算，值域不稳定，暂不字典化
- 权限码/错误码展示
- 字典管理页改造（SF-4 已做）

## 5. Codex prompt

```
实现 docs/tasks/FE-IDN-004.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-004-dict-consume（从最新 main 开）

后端已就绪（BE-IDN-008 合并并重跑 seed 后）：
  enable_status / tenant_status / audit_result / delivery_status /
  sync_job_status（system）；product_status（business）

必读：本卡、docs/design/dictionary-usage.md、
apps/admin/src/composables/use-meta-dictionary.ts（已有实现）、
docs/tasks/SF-4.md（字典页与取值写法）

改动：
1. 新增 DictTag 组件（缺项回退原值，失败不阻塞）
2. 按下表替换各页面硬编码状态文案
3. 状态下拉改为字典驱动，空字典回退最小集合

验收按卡片 §3 十一条逐条贴证据，第 8 条贴 grep 结果、第 10 条贴网络面板请求数。
完成后停下报告。
```
