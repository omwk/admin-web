# FE-IDN-019 · 缩略图异步状态展示

- ID: FE-IDN-019
- 类型: 修复
- 仓库: 前端
- 状态: 待实现
- 预计: 0.3 人日
- 分支: `feat/fe-idn-019-thumb-status`
- 依赖: BE-IDN-028

---

## 1. 背景

大图（>4 MiB 或 >400 万像素）的缩略图改为后台生成，列表会先返回：

```json
{ "thumb_url": null, "thumb_status": "pending" }
```

前端需要区分三种状态，而不是把 `thumb_url` 为空都当作「非图片」。

## 2. 改动

列表「预览」列：

| thumb_status | 显示                                        |
| ------------ | ------------------------------------------- |
| `ready`      | 缩略图                                      |
| `pending`    | 占位图 + 小转圈（悬浮提示「正在生成预览」） |
| `failed`     | 类型图标（同非图片）                        |
| 空字符串     | 类型图标                                    |

补充行为：

- 存在 `pending` 行时，每 5 秒刷新一次列表（最多 12 次即 1 分钟），全部 `ready/failed` 后停止
- 刷新不打断用户操作（保持滚动位置、不重置筛选）
- 预览弹窗对大图仍可用（直接取原文件下载流）

## 3. 验收

| #   | 项       | 断言                                                 |
| --- | -------- | ---------------------------------------------------- |
| 1   | ready    | 显示缩略图                                           |
| 2   | pending  | 转圈占位 + 提示                                      |
| 3   | 自动刷新 | pending 生成后 5–10 秒内自动显示缩略图，无需手动刷新 |
| 4   | 停止轮询 | 无 pending 时不再请求                                |
| 5   | failed   | 显示类型图标，不轮询                                 |
| 6   | 预览     | 大图点击预览仍可打开原图                             |
| 7   | 构建     | lint / typecheck / unit / build 全绿                 |

## 4. Codex prompt

```
实现 docs/tasks/FE-IDN-019.md。仓库 D:\code\admin-web。
分支：feat/fe-idn-019-thumb-status（从最新 main 655982c 开）

后端已就绪（BE-IDN-028 合并后）：列表返回 thumb_status（ready/pending/failed/空）。

必读：本卡、apps/admin/src/views/system/files/、
FE-IDN-017 的缩略图与预览实现

改动：
1. 预览列按 thumb_status 渲染（缩略图/转圈/图标）
2. 有 pending 时每 5 秒刷新，最多 12 次，无 pending 即停止
3. 刷新保持筛选与滚动位置

验收按卡片 §3 七条逐条贴证据；第 3 条要贴「上传 12 MB 图后自动出现缩略图」的截图。
完成后停下报告，并按 AGENTS §12 清理测试数据。
```
