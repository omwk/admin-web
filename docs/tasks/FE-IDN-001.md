# FE-IDN-001 · 租户页增强

- ID: FE-IDN-001
- 类型: 新增
- 仓库: 前端
- 状态: 待实现
- 预计: 1 人日
- 分支: `feat/fe-idn-001-tenant-enhance`
- 依赖: BE-IDN-002（已合并）

---

## 1. 背景

BE-IDN-002 给了三样新能力，前端还没用上：

```
租户列表   admin_active_count / member_count
成员列表   GET /admin/tenants/{id}/members
重签发     POST /admin/tenants/{id}/admin-invite
```

结果：平台管理员**看不出哪个租户能用**，也**没法救一个丢了邀请的租户**。

## 2. 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/admin/tenants` | 已含两个计数 |
| GET | `/admin/tenants/{id}/members` | 成员只读（id/account/status/is_super/created_at） |
| POST | `/admin/tenants/{id}/admin-invite` | 重签发；`?force=true` 强制 |
| POST | `/admin/tenants/{id}/disable` / `enable` | 已有 |

## 3. 改动

### 3.1 列表列

新增两列：

| 列     | 展示                                                       |
| ------ | ---------------------------------------------------------- |
| ID     | 数字，等宽字体（排查时要用）                               |
| 管理员 | `2 人` / **`未激活`**（`admin_active_count=0` 时红色徽标） |

「未激活」是最重要的信号：这种租户点进去也没人能登录。

### 3.2 行操作

| 操作           | 显示条件                                            |
| -------------- | --------------------------------------------------- |
| 重发管理员邀请 | `admin_active_count = 0` 或用户主动点「重置管理员」 |
| 查看成员       | 始终                                                |
| 停用 / 启用    | 已有逻辑（平台租户禁用停用）                        |

### 3.3 重签发交互

```
点击「重发管理员邀请」
  → 若 admin_active_count > 0：二次确认
      「该租户已有 N 个管理员，重发会作废未使用的旧邀请。继续？」
  → 调用 POST .../admin-invite（已有管理员时带 ?force=true）
  → 成功：弹窗显示链接（只显示一次，与 SF-5 开通一致）
```

### 3.4 成员抽屉

点「查看成员」→ 右侧抽屉：

| 列       | 说明                                     |
| -------- | ---------------------------------------- |
| 账号     | account                                  |
| 状态     | active / disabled / locked（字典取文案） |
| 超管     | 是/否                                    |
| 创建时间 |                                          |

只读，无任何写操作。

## 4. 验收

| #   | 项               | 断言                                     |
| --- | ---------------- | ---------------------------------------- |
| 1   | ID 列            | 显示租户数字 id                          |
| 2   | 管理员列         | 有超管显示人数；无超管显示红色「未激活」 |
| 3   | 成员抽屉         | 显示该租户成员，字段与接口一致，无写按钮 |
| 4   | 重发（无管理员） | 直接签发，弹窗显示链接                   |
| 5   | 重发（有管理员） | 二次确认后带 force 签发，旧链接失效      |
| 6   | 链接一次性       | 关闭弹窗后无法再次查看；刷新不保留       |
| 7   | 停用租户         | 重发按钮禁用并提示「租户已停用」         |
| 8   | 平台租户         | 行内标记「平台」，停用按钮禁用           |
| 9   | 权限             | 无 `system:tenant:manage` 时隐藏重发按钮 |
| 10  | 构建             | lint / typecheck / unit / build 全绿     |

## 5. 不做

- 成员编辑/禁用（跨租户操作用户超出平台管理员职责）
- 邀请历史列表
- 租户删除

## 6. Codex prompt

```
实现 docs/tasks/FE-IDN-001.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-001-tenant-enhance（从最新 main 开）

后端已就绪：http://127.0.0.1:18080，admin / Admin@12345
租户列表已返回 admin_active_count / member_count
成员：GET /admin/tenants/{id}/members
重签发：POST /admin/tenants/{id}/admin-invite（?force=true）

必读：本卡、docs/tasks/SF-5.md（租户页现有实现与邀请弹窗）、
后端 api/openapi/system.yaml 的 tenants 部分

改动：
1. 列表增加 ID 列与管理员列（无超管显示红色「未激活」）
2. 行操作增加「查看成员」与「重发管理员邀请」
3. 重发流程：有管理员时二次确认 + force；链接只显示一次
4. 停用租户禁用重发并提示

验收按卡片 §4 十条逐条贴证据。
完成后停下报告。
```
