# SF-4 · 数据字典页与系统配置页

- 依赖：S2（字典与配置 API）、BE-7（scope 分类）
- 预计：**2.5 人日**
- 分支：`feat/sf-4-system-config`
- 完成标志：运营能在界面上维护业务字典、管理员能改系统配置

---

## 1. 缺口

S2 交付了两组后端接口，**前端一个页面都没有**：

```
字典    /admin/dicts*、/meta/dicts/{type}     ← 无页面
配置    /admin/settings*                      ← 无页面
```

菜单里也没有对应入口。

## 2. 接口

### 字典

```
GET    /admin/dicts?scope=system|business
POST   /admin/dicts
PUT    /admin/dicts/{id}
DELETE /admin/dicts/{id}
GET    /admin/dicts/{id}/items
POST   /admin/dicts/{id}/items
PUT    /admin/dict-items/{id}
DELETE /admin/dict-items/{id}
```

### 配置

```
GET /admin/settings
GET /admin/settings/{group}
PUT /admin/settings/{group}
```

## 3. 页面

### 3.1 数据字典 `/system/dicts`

左侧：字典类型列表，按 **系统 / 业务** 两个分组折叠。

```
系统字典（只读为主）
  user_status        用户状态        3 项
  sync_run_status    同步运行状态     4 项
业务字典（可增删改）
  order_status       订单状态        6 项
```

右侧：选中类型的项表格

| 列   | 说明                   |
| ---- | ---------------------- |
| 标签 | label                  |
| 值   | value（唯一）          |
| 排序 | sort                   |
| 状态 | 启用/停用              |
| 颜色 | 可选，用于前端标签着色 |
| 操作 | 编辑 / 删除            |

规则：

- 系统字典：隐藏「新增项」「删除」按钮，只允许改 label / 排序（后端也会拦）
- 业务字典：完整 CRUD；删除字典前必须先清空项（后端 409）
- 值重复时显示后端 409 文案

### 3.2 系统配置 `/system/settings`

三个分组页签：

| 分组 | 主要项 |
| --- | --- |
| security | 密码最小长度、是否要求混合字符、有效期、历史条数、登录失败上限、锁定时长 |
| system | 系统名称、默认分页大小、时区 |
| notification | 默认渠道、重试次数 |

表单要求：

- 每项显示描述与取值范围（来自后端 schema）
- number 项用数字输入并做前后端一致的范围校验
- enum 项用下拉
- boolean 项用开关
- **只读项**（`read_only=true`）禁用输入并标注「不可修改」
- 保存后提示「已保存，部分配置对新会话生效」

## 4. 关键要求

### 4.1 配置的生效范围

有些配置改了**不会影响已登录会话**（如密码策略对当前 token 无效）。界面上要如实说明，不要让管理员以为「改了立刻全站生效」。

### 4.2 权限

| 页面     | 权限                               |
| -------- | ---------------------------------- |
| 字典查看 | `system:dict:list`                 |
| 字典编辑 | `system:dict:create/update/delete` |
| 配置查看 | `system:setting:list`              |
| 配置修改 | `system:setting:update`            |

无权限时隐藏按钮，接口仍由后端兜底。

### 4.3 菜单

两个页面需要后端 seed 投影（本卡只做前端；菜单由后端卡补）：

```
/system/dicts      system:dict:list
/system/settings   system:setting:list
```

## 5. 验收

| # | 项 | 断言 |
| --- | --- | --- |
| 1 | 字典分组 | 系统与业务两组分别显示，项数正确 |
| 2 | 系统字典只读 | 选中 `user_status` 时无新增/删除按钮 |
| 3 | 业务字典 CRUD | `order_status` 可新增、编辑、删除项 |
| 4 | 删除保护 | 有项时删字典 → 显示 409 文案 |
| 5 | 值唯一 | 重复 value → 显示 409 文案 |
| 6 | 前端取值 | 修改 label 后，商品/订单页的状态列显示新文案（验证字典真的被消费） |
| 7 | 配置读取 | 三个页签显示 11 项与默认值 |
| 8 | 范围校验 | 密码长度填 3 → 前端拦截或显示后端 400 |
| 9 | 只读项 | 只读项输入禁用并有标注 |
| 10 | 保存 | 改系统名称后刷新页面仍为新值 |
| 11 | 权限 | 无 update 权限时保存按钮隐藏，直连接口 403 |
| 12 | 构建 | lint / typecheck / unit / build 全绿 |

## 6. 不做

- 字典项的多语言
- 配置项的变更历史页（审计里有）
- 配置导入导出

## 7. Codex prompt

```
实现 docs/tasks/SF-4.md。仓库 D:\code\admin-web，分支 feat/sf-4-system-config。

后端已就绪：http://127.0.0.1:18080，admin / Admin@12345
字典：3 个类型（order_status 6 项、user_status 3 项、sync_run_status 4 项）
配置：三组 11 项

必读：本卡、docs/tasks/SF-2.md（左右布局与权限写法）、
后端 api/openapi/system.yaml 的 dicts 与 settings 部分

分两步：
1. 字典页：左分组列表（系统/业务）+ 右侧项表格 + CRUD（系统字典只读）
2. 配置页：三组页签 + schema 驱动的表单 + 只读项标注

关键要求：
- 系统字典隐藏新增/删除，后端也会拦
- 删除字典前的 409、值重复的 409 都显示后端原文
- 配置页要说明「部分配置对新会话生效」
- 前端展示一律通过 /meta/dicts/{type} 取文案，不硬编码状态名

验收按卡片 §5 十二条逐条贴证据。
完成后停下报告。
```
