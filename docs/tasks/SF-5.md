# SF-5 · 租户管理页

- 依赖：后端 S5（租户、模板、开通、停启，已合并）
- 预计：**2.5 人日**
- 分支：`feat/sf-5-tenant`
- 完成标志：平台管理员能在界面上开通新租户、拿邀请链接、停用与启用

---

## 1. 谁能看到

只有**平台管理员**（平台租户内的超管）能看到「租户管理」菜单。

普通租户管理员即使被授予 `system:tenant:list`，后端也只会返回 404 ——
前端不要试图"隐藏报错"，直接把入口隐藏即可。

## 2. 接口

| 方法   | 路径                           | 用途                             |
| ------ | ------------------------------ | -------------------------------- |
| GET    | `/admin/tenants`               | 列表                             |
| GET    | `/admin/tenants/{id}`          | 详情                             |
| POST   | `/admin/tenants`               | 开通（返回 invite_url）          |
| PUT    | `/admin/tenants/{id}`          | 改名                             |
| POST   | `/admin/tenants/{id}/disable`  | 停用                             |
| POST   | `/admin/tenants/{id}/enable`   | 启用                             |
| GET    | `/admin/tenant-templates`      | 模板列表                         |
| POST   | `/admin/tenant-templates`      | 从现有租户生成快照               |
| GET    | `/admin/tenant-templates/{id}` | 模板详情（含角色/菜单/权限快照） |
| PUT    | `/admin/tenant-templates/{id}` | 改名称/描述                      |
| DELETE | `/admin/tenant-templates/{id}` | 删除（被使用则 409）             |

请求字段（以 spec 为准）：

```jsonc
// 开通
{ "code": "acme", "name": "Acme 电商", "template_id": 1,
  "admin_username": "acme-admin", "admin_email": "ops@acme.com" }

// 生成模板
{ "source_tenant_id": 1, "code": "standard", "name": "标准租户", "description": "..." }
```

## 3. 页面

### 3.1 租户列表 `/system/tenants`

表格列：Code、名称、状态、来源模板、创建时间、操作

操作：

| 操作     | 条件                  |
| -------- | --------------------- |
| 开通租户 | 始终                  |
| 编辑名称 | 非平台租户            |
| 停用     | `active` 且非平台租户 |
| 启用     | `disabled`            |

**平台租户行**：显示「平台」徽标，停用按钮禁用并提示「平台租户不可停用」。

### 3.2 开通向导（两步）

```
步骤 1：基本信息
  code（唯一，创建后不可改）
  name
步骤 2：模板与管理员
  template_id（下拉，显示模板名称与角色数）
  admin_username
  admin_email（可选）
→ 提交
```

提交成功后弹窗展示邀请链接：

```
邀请链接（7 天内有效，仅可使用一次）
https://.../accept-invite?token=...

对方的密码由本人设置，你无法看到。
[复制链接]
```

链接只展示一次；关闭后不提供再次查看（如需重发，走用户页的重置链接）。

### 3.3 模板页 `/system/tenants/templates`（或同页签）

- 列表：code、名称、角色数、菜单数、创建时间
- 新建：选择「来源租户」+ code + name + description
- 删除：被使用中的模板禁用删除按钮并给出原因

## 4. 关键要求

### 4.1 邀请链接只显示一次

不缓存、不写 localStorage、关闭弹窗即丢弃。页面刷新后不保留。

### 4.2 停用要二次确认，并说明后果

```
停用「Acme 电商」后：
- 该租户所有用户无法登录
- 已登录会话的刷新令牌将被拒绝
- 数据保留，可随时重新启用
```

### 4.3 平台租户保护

- 行内停用按钮 `disabled`
- 直接调接口会返回 409，前端原样展示

### 4.4 权限

| 操作                | 权限                   |
| ------------------- | ---------------------- |
| 查看列表/详情       | `system:tenant:list`   |
| 开通/编辑/停启/模板 | `system:tenant:manage` |

无 `manage` 时隐藏所有写按钮。

## 5. 验收

| #   | 项           | 断言                                          |
| --- | ------------ | --------------------------------------------- |
| 1   | 列表         | 显示 default 租户，状态与来源模板正确         |
| 2   | 生成模板     | 从 default 生成模板，角色/菜单数与后端一致    |
| 3   | 开通         | 用模板开通租户 → 返回邀请链接；链接可复制     |
| 4   | 邀请可用     | 打开链接设密码后可登录新租户                  |
| 5   | 隔离         | 新租户登录后看不到 default 的数据             |
| 6   | 菜单一致     | 新租户侧边栏与模板租户一致                    |
| 7   | code 冲突    | 重复 code → 显示 409 文案                     |
| 8   | 停用         | 二次确认后状态变 disabled；该租户用户登录 403 |
| 9   | 启用         | 重新启用后可登录                              |
| 10  | 平台租户     | 停用按钮禁用；强行调用显示 409 文案           |
| 11  | 模板删除保护 | 被使用的模板删除按钮禁用/显示 409             |
| 12  | 权限         | 无 manage 时写按钮隐藏，直连 403              |
| 13  | 构建         | lint / typecheck / unit / build 全绿          |

## 6. 不做

- 租户配额与计费
- 租户数据导出/删除
- 模板版本管理（只保留最新快照）
- 租户内用户列表跳转

## 7. Codex prompt

```
实现 docs/tasks/SF-5.md。仓库 D:\code\admin-web，分支 feat/sf-5-tenant。

后端已就绪：http://127.0.0.1:18080，admin / Admin@12345（平台管理员）
菜单已投影：/system/tenants
现有数据：租户 default(1)，模板 0 个

必读：本卡、docs/tasks/SF-4.md（列表/表单/权限写法）、
后端 api/openapi/system.yaml 的 tenants 与 tenant-templates 部分

分三步：
1. 租户列表 + 停用/启用/改名（平台租户行禁止停用）
2. 开通向导（两步）+ 邀请链接只显示一次
3. 模板列表 + 从现有租户生成快照 + 删除保护

关键要求：
- 邀请链接不缓存、不落 localStorage，关闭即丢弃
- 停用二次确认要列出三条后果
- 409/400 文案原样展示
- 无 system:tenant:manage 时隐藏写按钮

验收按卡片 §5 十三条逐条贴证据。
完成后停下报告。
```
