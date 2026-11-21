# FE-IDN-017 验收记录

2026-11-21 完成；分支 feat/fe-idn-017-file-model，基线 65364b9。改动保留在工作区，未提交或推送。

## 十二项验收

| # | 结果 | 证据 |
| --- | --- | --- |
| 1 分类筛选 | 通过 | 全部 5 条；图片、文档、表格、压缩包、文本分别 1 条，浏览器请求与列表数量一致；头像不在默认列表中。[acceptance.json](acceptance.json) item 1。 |
| 2 无用途字段 | 通过 | 上传弹窗无用途选择，无 source 展示；真实 multipart 仅包含 file。[acceptance.json](acceptance.json) item 2。 |
| 3 缩略图 | 通过 | 图片加载成功，尺寸 48×48；其余四类显示类型图标。[截图](03-thumbnails.png)，item 3。 |
| 4 预览 | 通过 | 点击缩略图和「预览」均打开 640×360 原图，URL 与缩略图不同；显示文件名及大小，关闭按钮和 Escape 均有效。[截图](04-original-preview.png)，item 4。 |
| 5 上传人 | 通过 | 五行均显示真实用户名 admin；模板对空用户名回退 #uploaded_by。item 5；见缩略图截图。 |
| 6 配额条 | 通过 | 真实用量 991409 / 1048576 bytes，6 个文件，约 94.55%，进度条橙色；低用量不是橙色。超额返回 413，界面显示后端 message「存储空间不足：已用 0 MB / 上限 1 MB」。[截图](06-quota-orange.png)，item 6。 |
| 7 复制链接 | 通过 | 公开 expires_in=0，提示「长期有效」，粘贴至新标签返回 200，匿名下载字节一致；私有 expires_in=300，提示「5 分钟内有效」，链接返回 200。item 7。 |
| 8 下载 | 通过 | 浏览器保存原文件名，18379 bytes，与原图和预览原始字节一致。SHA-256：2e53a3eb876f5d866134ee522685cb9b22d12177ef5aac562192813c0e12686b。item 8。 |
| 9 头像上传 | 通过 | 连续两次真实上传均 201；圆形预览和全局头像立即更新，替换时缓存键和图片内容均更新，刷新后仍在。仅请求后端 /api/v1/avatars/{id}，输出 256×256，缓存 1 小时，默认文件列表不含头像。[截图](09-avatar-upload.png)，item 9。 |
| 10 头像限制 | 通过 | 非图片与 2 MiB+1 byte 在请求前阻止并明确提示；伪图片由后端返回 400，界面显示「头像仅支持可解码的 JPEG、PNG、GIF 图片，最多 400 万像素」。item 10。 |
| 11 头像删除 | 通过 | PUT /auth/profile 返回 200；预览和全局头像恢复默认，刷新后仍为空。item 11。 |
| 12 工程检查 | 通过 | lint、全仓 typecheck、全仓 unit、admin build 均退出 0，见下表与 [verification.json](verification.json)。 |

## 工程检查

| 命令 | 结果 | 日志 |
| --- | --- | --- |
| pnpm lint | exit 0 | [lint.txt](lint.txt) |
| pnpm check:type | exit 0；38/38 tasks successful | [typecheck.txt](typecheck.txt) |
| pnpm test:unit --maxWorkers=4 | exit 0；166 files / 1193 tests passed | [unit.txt](unit.txt) |
| pnpm --filter @vben/web-antd build | exit 0；生产构建与压缩包生成成功 | [build.txt](build.txt) |
| 真实后端 + 浏览器验收 | exit 0；1–11 全部通过，无浏览器错误 | [browser.txt](browser.txt)、[runtime.json](runtime.json) |
| git diff --check | exit 0 | [verification.json](verification.json) |

lint 中既有 Iconify 提示、unit 中 happy-dom AbortError 日志及 sortablejs mock 警告均未造成失败，完整输出已保留。

## 复现与范围

在仓库根目录执行：

```powershell
pnpm --filter @vben/web-antd build
bun --env-file=D:/code/go-admin-api/.env apps/admin/e2e/fe-idn-017-runtime.mjs
```

运行需要本机 Go、Bun、Edge、Docker 与后端开发 PostgreSQL/Redis；后端检出含 23872a6 的 eada1fc。脚本使用真实 API、worker、生产预览及独立 MinIO，不模拟业务响应。MinIO 使用本机已有镜像 commercehub-minio:RELEASE.2024-12-18T13-15-44Z，不修改既有对象存储。Redis DB14 必须初始为空；脚本会拒绝非空库，结束时只清理独占库。端口为前端 5667、API 18081、MinIO 19000。

菜单夹具使用已注册的 system/files/index 组件，执行显式归一化并恢复原值；本次种子菜单原值已是该全路径。FE-IDN-018 的菜单简写解析不属于本卡验收。历史失败尝试保留于 prior-attempts，仅供定位过程问题；本目录根部是最终通过记录。

## AGENTS §12 清理

使用本地开发数据库中的独占 schema feidn017_runtime_1795266505767。原有 public 业务表在验收前后逐行哈希一致；原审计记录保留。下列操作只针对本卡夹具：

| 操作 | 结果 |
| --- | --- |
| DELETE /admin/files/{id} | 8 个文件全部 204；worker 清理后对应对象 URL 全部 404；MinIO SDK 再查对象数为 0。 |
| DELETE /admin/storage-providers/{id} | 本卡 provider 删除成功；库内 file_object / storage_provider 均为 0。 |
| UPDATE sys_menu SET component=$1 WHERE id=$2 RETURNING id | 恢复隔离 schema 的菜单 27，影响 1 行。 |
| DELETE FROM outbox_event WHERE event_type='file.cleanup' AND status='sent' RETURNING id | 删除本卡完成的清理事件，影响 8 行。 |
| cli.exe audit-prune --before <清理时当前 RFC3339 时间> | deleted=27，见 [audit-prune.txt](audit-prune.txt)。 |
| DROP SCHEMA feidn017_runtime_1795266505767 CASCADE | 删除本卡种子租户、用户、角色、菜单、会话等全部夹具；剩余该 schema 数为 0，删除前各表行数见 runtime.json。 |
| 独占 Redis DB14 FLUSHDB | 删除 19 个本卡键，剩余 0。 |
| 停止本卡进程、移除本卡 MinIO 容器 | 三个服务均停止，容器移除。 |

最终只读复查：[final-resource-check.json](final-resource-check.json)。所有本卡运行产生的 schema、Redis 键和 MinIO 容器均为 0；5667 / 18081 / 19000 无监听；11 张 public 业务表数量与原审计记录一致。未保留测试业务数据。操作明细见 [cleanup.json](cleanup.json) 和 [acceptance.json](acceptance.json)。
