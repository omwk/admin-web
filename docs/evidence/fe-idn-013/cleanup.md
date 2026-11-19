# FE-IDN-013 测试数据清理

执行入口：`node apps/admin/e2e/fe-idn-013.mjs` 的 `finally`，先调用 API，再由 `fe-idn-013-db.mjs cleanup` 在同一事务中按外键顺序清理。结果来自 [acceptance.json](acceptance.json) 的 `apiCleanup` 与 `cleanup`，不是估算值。

本次隔离租户：`47 / feidn013_1795096577061`；用户：168、169、170；角色：140、141；渠道：21。验收开始于 `2026-11-19T13:56:17.061Z`，清理截止于 `2026-11-19T13:56:34.777Z`。

## API 清理

| 操作 | 对象 | 结果 |
| --- | --- | --- |
| PUT 用户角色为空，再 DELETE 用户 | reader 169、member 170 | 全部 204 |
| PUT 角色菜单、权限、部门为空，再 DELETE 角色 | 公告验收组 141 | 全部 204 |
| PUT 管理角色菜单为空 | 140 | 204 |
| GET 菜单后按叶子至父级 DELETE | 本租户菜单 838–865 | GET 200，DELETE 全部 204 |
| DELETE 当前用户 | owner 168，最后执行以保留清理权限 | 204 |

用户 API 为软删除，下面的 SQL 继续物理删除本租户残留。测试租户及邮件渠道等没有适用的删除 API，使用 SQL；所有语句都限定本卡租户。

## SQL 与影响行数

事务先用租户 ID 和 code 加锁核对身份，再设置审计删除保护截止时间：

```sql
SELECT id FROM tenant WHERE id = 47 AND code = 'feidn013_1795096577061' FOR UPDATE;
SELECT set_config('commercehub.audit_prune_before', '2026-11-19T13:56:34.777Z', true);
```

以下 `$1` 均为 47；审计语句的 `$2` 为验收开始时间、`$3` 为清理截止时间；租户删除语句的 `$2` 为上述租户 code。

| 实际删除语句 | 影响行数 |
| --- | --: |
| `DELETE FROM audit_log WHERE tenant_id=$1 AND created_at >= $2 AND created_at < $3 RETURNING id` | 45 |
| `DELETE FROM notify_outbox WHERE tenant_id=$1 RETURNING tenant_id` | 2 |
| `DELETE FROM notify_delivery WHERE tenant_id=$1 RETURNING tenant_id` | 2 |
| `DELETE FROM notification_preference WHERE tenant_id=$1 RETURNING tenant_id` | 1 |
| `DELETE FROM notification WHERE tenant_id=$1 RETURNING tenant_id` | 4 |
| `DELETE FROM sys_user_channel WHERE tenant_id=$1 RETURNING tenant_id` | 0 |
| `DELETE FROM sys_refresh_token WHERE tenant_id=$1 RETURNING tenant_id` | 3 |
| `DELETE FROM auth_token WHERE tenant_id=$1 RETURNING tenant_id` | 0 |
| `DELETE FROM password_history WHERE tenant_id=$1 RETURNING tenant_id` | 0 |
| `DELETE FROM sys_user_role WHERE tenant_id=$1 RETURNING tenant_id` | 1 |
| `DELETE FROM sys_role_menu WHERE tenant_id=$1 RETURNING tenant_id` | 0 |
| `DELETE FROM sys_role_permission WHERE tenant_id=$1 RETURNING tenant_id` | 119 |
| `DELETE FROM sys_role_dept WHERE tenant_id=$1 RETURNING tenant_id` | 0 |
| `DELETE FROM sys_user WHERE tenant_id=$1 RETURNING tenant_id` | 3 |
| `DELETE FROM sys_role WHERE tenant_id=$1 RETURNING tenant_id` | 1 |
| `DELETE FROM sys_menu WHERE tenant_id=$1 RETURNING tenant_id` | 0 |
| `DELETE FROM sys_permission WHERE tenant_id=$1 RETURNING tenant_id` | 119 |
| `DELETE FROM sys_dept WHERE tenant_id=$1 RETURNING tenant_id` | 1 |
| `DELETE FROM sys_setting WHERE tenant_id=$1 RETURNING tenant_id` | 0 |
| `DELETE FROM channel_provider WHERE tenant_id=$1 RETURNING tenant_id` | 1 |
| `DELETE FROM notify_template WHERE tenant_id=$1 RETURNING tenant_id` | 0 |
| `DELETE FROM idempotency_key WHERE tenant_id=$1 RETURNING tenant_id` | 0 |
| `DELETE FROM outbox_event WHERE tenant_id=$1 RETURNING tenant_id` | 34 |
| `DELETE FROM tenant WHERE id=$1 AND code=$2 RETURNING id` | 1 |

## 清理后核对与偏差

`cleanup.remaining` 中 24 个表的本租户记录数全部为 0；`baselinePreserved=true`。既有租户、用户、部门、角色、菜单、权限、配置、渠道、模板按 ID 和整行摘要逐项对比，全部一致；原有 13 条审计的 ID 与摘要也全部保留。没有保留本卡测试数据。现有系统配置和渠道未修改，无需恢复；本卡 SMTP 服务和浏览器由 `finally` 关闭。

最终只读复核（`2026-11-19T14:33:45.033Z`）：开发库内 `feidn013_%` 测试租户总数为 0；再次查询本租户的 tenant、sys_user、sys_role、sys_menu、sys_permission、sys_dept、sys_setting、channel_provider、notify_template、notification、notification_preference、notify_outbox、notify_delivery、audit_log，均为 0；全库审计仍为既有 13 条。

AGENTS §12 的目标是清除本卡审计。现有 `audit-prune --before` 没有租户或开始时间筛选，会同时删除其他会话的既有审计；本次采用相同截止保护下的定向 SQL，仅删除本卡租户、验收时间段内的 45 条记录。此处记录执行方式的偏差，避免把定向 SQL 误报为执行了全库 `audit-prune`。
