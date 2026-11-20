# FE-IDN-016 · 存储配置与文件管理

- ID: FE-IDN-016
- 类型: 新增
- 仓库: 前端
- 状态: 待实现
- 预计: 1.5 人日
- 分支: `feat/fe-idn-016-storage`
- 依赖: BE-IDN-021

---

## 1. 系统配置 → 存储

路径：`/system/settings` 增加「存储」分组（现有配置页按分组渲染，新增一组即可）。

字段：

| 字段 | 控件 | 说明 |
| --- | --- | --- |
| 服务地址 | Input | 主机名，占位 `oss.example.com`，不要带 `https://` |
| 端口 | InputNumber | 默认 443；9000 为常见 MinIO 端口 |
| 桶名 | Input | 占位 `oss` |
| 使用 HTTPS | Switch | 端口 443 时默认开 |
| Region | Input | 默认 `us-east-1` |
| Access Key | Input | 可见 |
| Secret Key | Input.Password | 已配置时占位显示 `******`；留空表示不修改 |
| 公开访问前缀 | Input | 可选，占位 `https://oss.example.com/oss` |

操作：

```
[测试连接]   → 显示结果：连接正常 / 桶不存在 / 认证失败 / 网络不可达
[保存]       → 成功后提示「已保存，立即生效」
```

- 测试连接使用**已保存的配置**（与后端契约一致），未保存的修改提示「请先保存再测试」
- 保存后不需要重启，提示里写明

## 2. 文件管理

路径：`/system/files`

```
[上传文件]  支持点击与拖拽；单个 ≤20MB
筛选：用途 [全部▾]  关键字 [____]  [查询]
```

列表：

| 列       | 内容                                |
| -------- | ----------------------------------- |
| 文件名   | 原文件名（超长省略，悬浮全名）      |
| 类型     | MIME 简写（图片/PDF/CSV/Excel/ZIP） |
| 大小     | KB/MB                               |
| 用途     | 附件 / 导出 / 店铺                  |
| 上传人   | 用户名（后端返回）                  |
| 上传时间 | 本地时间                            |
| 操作     | 下载 / 复制链接 / 删除              |

- 「复制链接」调用预签名接口，复制 5 分钟有效 URL，并提示有效期
- 删除需二次确认
- 上传中显示进度，成功后刷新列表并高亮新行
- 空态：「还没有文件，点击上传」

## 3. 验收

| #   | 项       | 断言                                    |
| --- | -------- | --------------------------------------- |
| 1   | 配置读取 | 显示当前配置，Secret 为掩码             |
| 2   | 保存     | 修改后保存成功，刷新仍为掩码            |
| 3   | 测试连接 | 成功与失败（错误密钥）各有明确提示      |
| 4   | 留空保持 | Secret 留空保存后，测试连接仍成功       |
| 5   | 上传     | 拖拽上传成功，列表出现新文件            |
| 6   | 超限     | >20MB 前端提示并阻止                    |
| 7   | 类型     | 非白名单类型前端提示（后端也会拒）      |
| 8   | 下载     | 点击下载得到原文件                      |
| 9   | 复制链接 | 复制到剪贴板，新窗口可打开              |
| 10  | 删除     | 确认后行消失                            |
| 11  | 空态     | 无文件时显示空态                        |
| 12  | 权限     | 无 `system:file:manage` 时上传/删除隐藏 |
| 13  | 构建     | lint / typecheck / unit / build 全绿    |

## 4. 不做

- 图片预览缩略图
- 文件夹/多级目录
- 断点续传
- 头像直传文件库（后续可接）

## 5. Codex prompt

```
实现 docs/tasks/FE-IDN-016.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-016-storage（从最新 main 03b88c5 开）

后端已就绪（BE-IDN-021 合并后）：
  GET/PUT /admin/settings/storage        （secret 返回 ******，空值保持）
  POST    /admin/settings/storage/test   → { ok, bucket_exists, reason?, latency_ms }
  POST    /admin/files                   multipart
  GET     /admin/files?purpose=&keyword=&page=
  GET     /admin/files/{id}              下载
  GET     /admin/files/{id}/url          预签名（5 分钟）
  DELETE  /admin/files/{id}
  权限码 system:file:manage

必读：本卡、apps/admin/src/views/system/setting/（现有分组渲染方式）、
apps/admin/src/views/system/notification/deliveries.vue（列表/空态写法参考）

改动：
1. 系统配置新增「存储」分组（9 个字段，Secret 掩码与留空保持）
2. 新增 /system/files 页面：上传（点击+拖拽）、筛选、列表、下载、复制预签名链接、删除
3. 权限控制与空态

验收按卡片 §3 十三条逐条贴证据；第 1、3、5、9 条要截图。
完成后停下报告，并按 AGENTS §12 清理测试数据。
```
