# 电商后台 · 管理端

基于 [Vben Admin v5](https://github.com/vbenjs/vue-vben-admin) 的管理后台前端。

## 来源与版本

- 上游：`vbenjs/vue-vben-admin`，版本 **5.7.0**，基准提交 `53b47f8`
- 本项目在其基础上裁剪，**不保留上游 git 历史**；升级时需手工对比上游

### 相对上游的改动

| 改动 | 原因 |
| --- | --- |
| 只保留 `apps/admin`（原 `apps/web-antd`） | 不需要同时维护 5 个 UI 变体 |
| 删除 `apps/web-antdv-next`、`web-ele`、`web-naive`、`web-tdesign` | 同上 |
| 删除 `apps/backend-mock` | 联调真实后端，不用 mock 服务 |
| 删除 `playground`、`docs`、`.changeset`、上游 `.github` | 不属于本产品 |
| 新增 `docs/`（本项目自己的前端文档） | 设计文档与代码同仓库 |

## 环境要求

| 项   | 版本                     |
| ---- | ------------------------ |
| Node | `^22.18.0 \|\| ^24.12.0` |
| pnpm | `>=11.0.0`               |

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev:antd         # 启动管理端开发服务器
pnpm build:antd       # 构建管理端
pnpm lint             # 代码检查
pnpm typecheck        # 类型检查
```

## 真实后端联调

开发环境的 `/api` 代理到 `http://127.0.0.1:18080`，前端默认端口为 5666。
登录、菜单、用户列表直接请求真实后端。用户列表将 keyword/status 筛选参数
发送到后端：搜索 sales 返回 2 条，搜索 sales01 返回 1 条，可按状态筛选。

启动前端后，在当前终端设置 `FE1_ADMIN_PASSWORD`、`FE1_SALES_PASSWORD`，
运行 `pnpm --dir apps/admin test:e2e` 做真实浏览器验收。默认使用 admin、sales01；
可用 `FE1_ORIGIN` 覆盖前端地址。验收记录与复现方法见
[FE-1 联调报告](apps/admin/docs/FE-1-report.md)。

## 目录结构

```
apps/
  admin/              管理端应用（登录、菜单、业务页面）
packages/
  @core/              框架核心（路由、请求、组件基座）
  effects/            业务无关的通用能力（权限、请求）
  stores/             全局状态
  styles/             样式与主题
  types/              共享类型
  utils/              工具函数
  locales/            国际化
  preferences/        偏好设置
  icons/              图标
  constants/          常量
docs/
  architecture.md     前端架构与分层
  auth.md             认证与会话
  permissions.md      菜单与按钮权限
  api-client.md       接口层约定
```

## 后端契约

后端只提供接口契约与集成规则，不包含前端设计：

- 接口定义：后端仓库 `api/openapi/*.yaml`
- 集成规则：后端仓库 `docs/api/integration.md`（认证、权限、分页、幂等、错误码）

前端不复制这些规则，只按它们实现。

## 安全边界

**所有前端权限控制都只是体验，不是安全边界。** 每个接口由后端独立校验；
前端隐藏按钮不能替代后端授权。
