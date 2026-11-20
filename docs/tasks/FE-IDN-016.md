# FE-IDN-016 · 存储配置与文件管理

- ID: FE-IDN-016
- 类型: 新增
- 仓库: 前端
- 状态: 已完成（14/14 验收通过）
- 预计: 1.5 人日
- 分支: `feat/fe-idn-016-storage`
- 依赖: BE-IDN-021

---

## 1. 存储配置管理页

路径：`/system/storage`（平台管理员可见，无权限 404）

### 1.1 列表

| 列   | 内容                          |
| ---- | ----------------------------- |
| 名称 | 「主 MinIO」                  |
| 地址 | `https://oss.uuo.me:443`      |
| 桶   | `oss`                         |
| 默认 | 标签「默认」                  |
| 状态 | 启用 / 停用                   |
| 操作 | 测试 / 设为默认 / 编辑 / 删除 |

顶部：`[新建配置]`

### 1.2 新建 / 编辑弹窗

```
名称        [主 MinIO]
服务地址    [oss.uuo.me]        提示：不要带 https://，也可填 https://host:port
端口        [443]
使用 HTTPS  [开]
桶名        [oss]
Region      [us-east-1]
Access Key  [____________]
Secret Key  [____________]      ← 明文显示，可复制
公开访问前缀 [https://oss.uuo.me/oss]（可选）

[测试连接]  [保存]
```

- Secret 明文展示（产品要求），提供「显示/隐藏」切换与复制按钮
- 测试连接：显示「连接正常 / 桶不存在 / 认证失败 / 网络不可达」
- 保存后提示「已保存，立即生效」
- 删除默认配置时按钮禁用并提示「请先切换默认配置」

### 1.3 空态

```
还没有对象存储配置
未配置时上传功能不可用。
[新建配置]
```

## 2. 文件管理

路径：`/system/files`

```
[上传文件]   点击或拖拽，单个 ≤20MB
筛选：用途 [全部▾]  关键字 [____]  [查询]
```

| 列     | 内容                           |
| ------ | ------------------------------ |
| 文件名 | 原文件名，超长省略             |
| 类型   | 图片 / PDF / CSV / Excel / ZIP |
| 大小   | KB/MB                          |
| 用途   | 附件 / 导出 / 店铺 / 快照      |
| 上传人 | 用户名                         |
| 时间   | 本地时间                       |
| 操作   | 下载 / 复制链接 / 删除         |

- 复制链接调用预签名接口（5 分钟），提示有效期
- 删除二次确认
- 上传中显示进度，成功后刷新并高亮新行
- 无 `system:file:manage` 时隐藏上传/删除

## 3. 验收

| # | 项 | 断言 |
| --- | --- | --- |
| 1 | 列表 | 展示配置与默认标记 |
| 2 | 新建 | 保存后列表出现，可测试连接成功 |
| 3 | Secret 明文 | 编辑弹窗显示明文，可复制，可切换隐藏 |
| 4 | 测试失败 | 错误密钥显示「认证失败」 |
| 5 | 多配置 | 建两条，可切换默认，旧默认标记消失 |
| 6 | 默认保护 | 默认配置的删除按钮禁用并有说明 |
| 7 | 上传 | 拖拽上传成功，列表出现新文件 |
| 8 | 超限/类型 | 前端提示并阻止 |
| 9 | 下载 | 得到原文件 |
| 10 | 复制链接 | 剪贴板可用，新窗口可打开 |
| 11 | 删除 | 确认后行消失 |
| 12 | 空态 | 无配置/无文件各有空态与引导 |
| 13 | 权限 | 无 storage:manage 看不到配置页；无 file:manage 隐藏上传删除 |
| 14 | 构建 | lint / typecheck / unit / build 全绿 |

## 4. 不做

- 缩略图
- 文件夹
- 断点续传

## 5. Codex prompt

```
实现 docs/tasks/FE-IDN-016.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-016-storage（从最新 main 03b88c5 开）

后端已就绪（BE-IDN-021 合并后）：
  GET/POST/PUT/DELETE /admin/storage-providers
  POST /admin/storage-providers/{id}/test 与 /default
  secret 以明文返回（产品要求）
  POST/GET/DELETE /admin/files，GET /admin/files/{id}/url
  权限：system:storage:manage、system:file:manage

必读：本卡、apps/admin/src/views/system/setting/（配置页风格）、
deliveries.vue（列表/空态/上传进度参考）

改动：
1. 新增 /system/storage 管理页（列表 + 新建/编辑弹窗 + 测试 + 设默认 + 删除保护）
   Secret 明文可显示/隐藏/复制
2. 新增 /system/files 文件管理页（上传/筛选/列表/下载/复制链接/删除）
3. 权限控制与空态

验收按卡片 §3 十四条逐条贴证据；第 3、5、7 条要截图。
完成后停下报告，并按 AGENTS §12 清理测试数据。
```

## 6. 验收记录（2026-11-21）

14/14 通过；逐条断言、HTTP 状态、截图及构建日志见 [验收报告](../evidence/fe-idn-016/README.md)。第 3、5、7 项截图已附，使用真实后端 `40ee3d7`、迁移 38 与真实 MinIO；生产构建上的浏览器验收通过。

`pnpm lint`、admin typecheck、全仓 unit（164 文件 / 1180 测试）、admin unit（69 文件 / 473 测试）、admin build 均退出 0；unit 使用 `--maxWorkers=4` 控制本机资源占用。

已清理：真实 API 删除文件/配置/测试身份/菜单 → worker 对象清理后原 URL 404；`audit-prune --before <当前 RFC3339>` → 删除 29 条；SQL 清理残留并 `DROP SCHEMA feidn016_runtime_1795193658189 CASCADE`、清空独占 Redis DB 14 → schema 0、Redis key 0、文件/配置 0。原 public 业务表及审计哈希保留；本次端口 5667/18081 已关闭，共享端口 5666/18080 仍在。SQL 与影响行数见 [清理回执](../evidence/fe-idn-016/cleanup.json)，最终资源检查见 [resource-check.json](../evidence/fe-idn-016/resource-check.json)。

接入说明：后端需配置 `/system/storage`、`/system/files` 菜单；具体组件/权限见验收报告。测试连接要求先保存；当前 API 无上传人字段，该列显示 `—`。
