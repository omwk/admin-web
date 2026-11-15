**统一系统字典抽离评估 · 2026-11-15**

当前最有收益的改造是补齐字典供给、统一业务标签，保留代码中的状态机与校验。共整理 **133 组审查项、469 个码值条目**：81 组可仅统一展示，2 组具备成为可维护业务分类的条件，50 组固定协议或技术枚举排除迁移。条目按字段分组，复用项可合并一组；码值在不同字段之间重复计入，不代表互不重复的字典类型或码值。

如“系统字典”严格指允许业务增删码值的分类库，应只考虑 customer_source 和 customer_level，且两者都需要前置工作；其余展示候选只开放名称、颜色和排序，不开放状态语义。

**1. 交付清单与统计口径**

| 文件 | 内容 |
| --- | --- |
| [inventory.md](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/inventory.md) | 全部审查项，按业务模块排列；字段、码值含义、前后端引用行数、评估、理由、改造与兼容建议 |
| [inventory.csv](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/inventory.csv) | 可筛选总清单，含绝对文件路径、建议字典类型、优先级等 16 列 |
| [code-values.csv](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/code-values.csv) | 每个字段逐码展开，含码值文本直接命中行数 |
| [references.csv](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/references.csv) | 每条静态引用的使用端、绝对路径、行号、源码及匹配规则 |
| [evidence.json](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/evidence.json) | 来源快照、每组规则和逐行证据，便于机器核验 |
| [schema-domains.json](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/schema-domains.json) | 迁移文件中的简单 CHECK IN 值域及历史定义 |
| [audit.cjs](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/audit.cjs)、[curation.cjs](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/curation.cjs)、[build-report.cjs](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/build-report.cjs) | 可重跑的提取、人工归类和报告生成脚本；只写本报告目录 |

前端 955 个生产源码文件、81041 行，范围为 apps/admin/src、packages、internal 下的 TS/Vue/JS；后端 internal、cmd 下 536 个生产 Go 文件、51705 行。测试、夹具、mock、依赖和构建输出不计入引用次数；另读 SQL 迁移与字典相关设计说明。枚举检查覆盖 114 个简单 CHECK IN 字段值域，另人工补充 19 组无此类约束的枚举、下拉常量、布尔展示和固定标签码。

前端快照 HEAD：f6d696da855d3525fe1aa3bbbe66c3cd98d3d4c2；后端：e36fc8d50832b32a0c75632448b687be0ada6f04。完整源码集合 SHA-256 见 evidence.json。本报告为源码静态分析，没有读取运行数据库，因此“未见种子”指仓库供给缺失，不排除某个租户已手工配置。

**引用次数定义：人工限定文件或函数内，对该字段直接码值、声明、命名枚举、选项符号和明确消费点匹配的非注释生产源码行数。同组同文件同行只计一次。** 当前合计 615 条“审查项—源码行”关联，落在 557 个不同源码位置；不同审查项可以引用同一行，不能把关联数当作独立代码行数。每码命中数只算该行出现的码值文本，不等于整个字段的引用数。一行多个码仍只计一行。

这不是 AST 全量引用图、运行调用次数或生产数据量。SQL 迁移、OpenAPI、文档和测试不并入生产引用计数；Go 中实际执行的 SQL 字符串会按限定规则计数。**0 表示此规则下未发现直接生产引用，不能据此判断字段未使用或删除。** 例如 customer.level 有数据库约束，但当前模型与 DTO 未接入；一些后台状态通过间接赋值或 SQL 封装使用。规则和每行证据均随清单提供，后续实施前仍应沿调用链评估影响。

**2. 当前字典能力与需要先纠正的契约**

现有系统已经具备租户字典管理与元数据接口，无需另建一套平行机制。前端通过 GET /api/v1/meta/dicts/{type} 获取 label/value/sort/color/extra/scope；该接口需要登录。生产代码有 8 处 useMetaDictionary 调用：product_status 2 处、user_status 6 处。后端迁移 000026 声明 order_status、user_status、sync_run_status 三种；运行期 seed 只定义后两种。

证据：[apps/admin/src/api/core/dictionaries.ts:58](D:/code/admin-web/apps/admin/src/api/core/dictionaries.ts:58)；[internal/modules/system/routes.go:46](D:/code/go-admin-api/internal/modules/system/routes.go:46)；[migrations/000026_system_dict_seed.up.sql:4](D:/code/go-admin-api/migrations/000026_system_dict_seed.up.sql:4)；[internal/bootstrap/system_dict_seed.go:24](D:/code/go-admin-api/internal/bootstrap/system_dict_seed.go:24)。

| 事项 | 源码事实与影响 | 建议 |
| --- | --- | --- |
| P0 商品状态 D044 | 列表和详情请求 product_status；仓库迁移及 seed 未见该类型。当前回退原码，筛选仍从 productStatusValues 构建 | 增加 system 范围的 draft/active/archived 展示字典，保留三个状态和原码回退 |
| P0 同步运行 D038 | 旧种子 pending/running/succeeded/failed；真实 sync_run.status 为 running/success/partial/failed/cancelled | 建议新增 sync_run_status_v2；旧类型保留，不批量改业务数据 success→succeeded；没有前端消费者时先解决供给契约 |
| P0 订单展示 X004 | 旧 order_status 为 pending_payment/paid/shipped/completed/cancelled/refunded；接口展示投影实际有 8 值 | 新增 order_display_status：pending_payment/pending_shipment/shipped/completed/closed/refunding/refunded/unknown，保留原 order_status；管理页面消费在后续模块上线时接入 |
| 租户初始化 | 000026 只为迁移执行当时已有租户插入；SeedIdentity 固定 tenant=1；Provision/Materialize 只物化组织、角色、菜单、权限，未见字典初始化 | 新字典必须覆盖全部既有租户和后续开通租户。不能仅在默认租户 seed 中加一行就视为完成 |
| 字典自身启停 D111/D112 | 字典管理页面依赖 user_status，再过滤 active/disabled。过滤已阻止 locked，但维护字典仍依赖另一个可停用字典 | 自举状态保留本地两值标签与兜底，避免远端字典缺失时维护表单没有可选项 |

定位：[apps/admin/src/views/catalog/product/index.vue:60](D:/code/admin-web/apps/admin/src/views/catalog/product/index.vue:60)；[apps/admin/src/views/catalog/product/detail.vue:30](D:/code/admin-web/apps/admin/src/views/catalog/product/detail.vue:30)；[migrations/000006_sync_init.up.sql:33](D:/code/go-admin-api/migrations/000006_sync_init.up.sql:33)；[internal/modules/order/status.go:90](D:/code/go-admin-api/internal/modules/order/status.go:90)；[internal/modules/order/query.go:117](D:/code/go-admin-api/internal/modules/order/query.go:117)；[internal/bootstrap/identity_seed.go:19](D:/code/go-admin-api/internal/bootstrap/identity_seed.go:19)；[internal/modules/identity/tenant_provision.go:28](D:/code/go-admin-api/internal/modules/identity/tenant_provision.go:28)；[internal/bootstrap/identity_tenant_materialize.go:13](D:/code/go-admin-api/internal/bootstrap/identity_tenant_materialize.go:13)；[apps/admin/src/views/system/dict/dictionary-form.vue:37](D:/code/admin-web/apps/admin/src/views/system/dict/dictionary-form.vue:37)。

当前 scope=system 已在后端限制新增/删除字典项和修改 value，允许更新 label/color/sort/status；scope=business 可维护业务条目。builtin 与 scope 不是同一维度：order_status 迁移后仍属 business，不能因为 builtin=true 就假定其值集合不可删除。字典和字典项写操作已实现审计，不应按旧设计说明误判为“暂无审计”。

证据：[migrations/000028_system_dict_scope.up.sql:4](D:/code/go-admin-api/migrations/000028_system_dict_scope.up.sql:4)；[internal/modules/system/dict_write.go:69](D:/code/go-admin-api/internal/modules/system/dict_write.go:69)；[internal/modules/system/dict_write.go:91](D:/code/go-admin-api/internal/modules/system/dict_write.go:91)；[internal/modules/system/dict_write.go:39](D:/code/go-admin-api/internal/modules/system/dict_write.go:39)。

**3. 重点清单节选（完整清单见 inventory.md / inventory.csv）**

下表“前/后”采用第 1 节口径；文件与逐行引用均可从 ID 在总清单和 references.csv 中定位。字典类型是建议名称，不表示已在数据库存在。

| ID / 字段或枚举 | 码值 → 含义 | 引用行数 前 / 后 | 评估与改造 |
| --- | --- | --: | --- |
| D044 product_spu.status | draft 草稿；active 启用；archived 已归档 | 13 / 2 | P0，补 product_status；保留 ProductStatus、productStatusValues 和后端校验 |
| D038 sync_run.status | running 运行中；success 成功；partial 部分成功；failed 失败；cancelled 已取消 | 0 / 10 | P0，新增准确展示字典，与旧类型并存 |
| X004 States.DisplayStatus | pending_payment 待付款；pending_shipment 待发货；shipped 已发货；completed 已完成；closed 已关闭；refunding 退款中；refunded 已退款；unknown 未知 | 0 / 9 | P0 契约治理；事实状态及投影函数保留 |
| D009 sys_user.status | active 正常；disabled 停用；locked 锁定 | 28 / 4 | 已接入 user_status，统一剩余标签；锁定与启停分支保留 |
| D001 tenant.status | active 启用；suspended 停用/暂停 | 10 / 2 | P1 tenant_status；不能把所有未知值直接显示为停用 |
| D014 sys_menu.status | active 启用；disabled 停用 | 5 / 0 | P1 enable_status；菜单 type 和路由协议不改 |
| X001 Role/Department.status | active 启用；disabled 停用 | 12 / 2 | P1 复用 enable_status；保留授权缓存和服务校验 |
| D003 audit_log.result | success 成功；failure 失败 | 10 / 1 | P1 audit_result，日志筛选与标签统一 |
| X002 Invite.status | active 有效；expired 过期；revoked 已撤销；used 已使用 | 6 / 4 | P1 invite_status；继续由到期、撤销和使用次数计算状态 |
| D105 channel_provider.channel | email 邮件；sms 短信；wecom 企微；dingtalk 钉钉；webhook Webhook | 29 / 2 | P1 notification_channel；投递 D107 与偏好 D113 可共享，能力集合固定 |
| D108 notify_delivery.status | pending 待发送；sent 已发送；failed 失败；skipped 已跳过 | 15 / 3 | P1 notification_delivery_status；重试和投递判断继续用码值 |
| X017 Provider/Template.enabled | true 启用；false 停用 | 4 / 2 | P1 可统一标签；仍传 JSON boolean，不混用 active/disabled |
| D035 listing.status | online 在售；offline 下架；deleted 已删除 | 1 / 4 | P1 listing_status；与 SPU 状态分开 |
| D048 export_job.status | pending 等待；running 运行中；succeeded 成功；failed 失败；expired 过期 | 2 / 9 | P1 export_job_status；保留下载和过期判定；前端创建成功提示当前直接显示 data.status |
| X005 CustomerInput.Source | manual 人工录入（仅默认值；其他历史值未知） | 0 / 4 | P2，条件适合 business 字典，先盘点自由文本 |
| D061 customer.level | 空串 未分级；A/B/C 分级代码，具体业务定义待确认 | 0 / 0 | P3，条件适合 business 字典；当前仅数据库列，不能视为已有下拉 |
| X006 pricing.Basis / LayerName | customer_quote 客户专属报价；customer_price_list 客户价目表；default_price_list 默认价目表；original 商品原价；unpriced 未定价 | 0 / 15 | P2 管理端可统一显示；计算优先级和历史快照文案保留 |

其他展示候选包括店铺及凭据、漂移和重放、商品来源、订单各事实维度、询价、分享、网关授权状态、账单状态等，逐字段给出完整码值与理由。相同 value 不足以证明同一语义：sync_run 的 success 与 export_job 的 succeeded 保持独立；订单 payment 的 partial_refund 与 after_sales 的 partial_refunded 不互换。

**4. 是否保留枚举、是否走接口、如何兼容**

| 类别 | 代码枚举/校验 | 字典接口与 scope | 兼容策略 |
| --- | --- | --- | --- |
| 81 组展示候选 | 保留 TS 联合类型、Go 枚举/允许集、binding oneof、DB CHECK、状态机和能力注册 | 统一用现有 meta 接口；建议新类型 scope=system；仅标签、颜色、排序等可维护 | 不改 API/存储 value；未知、缺失、失败回显原码。历史筛选从代码完整域构建，不能只取 meta 启用项；新写入选项才与能力/可选值集合求交 |
| customer_source | 保留字符串、长度和租户校验；不新建固定 Go/TS 码值枚举 | 建议 scope=business；新表单逐步用字典选项 | 先按租户采样/统计已有不同值并建立同码词条；旧未知值可读、未改值可保存；后续再约束新增或变更值 |
| customer_level | 当前 DTO/模型没有 Level；若启用，使用字符串和字典校验，避免继续把 A/B/C 写死 | 建议 scope=business；需补 DTO/界面并新增迁移调整固定 CHECK | 空串仍表示未分级，不作为字典项（字典 value 最小长度为 1）；旧 A/B/C 保留码值；DTO 用可选字段/缺失标记，旧客户端不传 Level 时更新不覆盖已有等级 |
| 50 组固定协议/技术项 | 保留，优先在现有类型/注册表集中管理 | 不接入可维护字典；若界面需要名称，用集中翻译或专用能力接口 | 保持路由、鉴权、账务与传输协议，不能由字典新增驱动/策略/权限 |

客户来源现状见 [internal/modules/share/validation.go:35](D:/code/go-admin-api/internal/modules/share/validation.go:35) 和 [internal/modules/share/types.go:16](D:/code/go-admin-api/internal/modules/share/types.go:16)；等级列见 [migrations/000013_share_init.up.sql:19](D:/code/go-admin-api/migrations/000013_share_init.up.sql:19)；字典 value 非空限制见 [internal/modules/system/dict.go:71](D:/code/go-admin-api/internal/modules/system/dict.go:71)。

这里的“开放业务维护”指分类库，不表示允许随意重命名已被业务记录引用的 value。接入后需要限制改码/删除被引用项，通常采用停用替代删除，或提供显式的数据迁移；当前字典服务仅保护 builtin/system 的 value，没有跨所有业务表的引用检查，不能直接把现有 business CRUD 当作完整业务分类治理。

**5. 分模块迁移优先级计划**

| 模块             | 只展示候选 | 条件业务候选 | 排除 |
| ---------------- | ---------: | -----------: | ---: |
| 身份与组织       |          5 |            0 |    6 |
| 审计与日志       |          5 |            0 |    0 |
| 基础设施（排除） |          0 |            0 |    3 |
| 通知             |          8 |            0 |    5 |
| 店铺与凭据       |          6 |            0 |    7 |
| 同步、映射与重放 |         14 |            0 |    7 |
| 商品与类目       |          9 |            0 |    0 |
| 订单             |          9 |            0 |    3 |
| 客户、报价与分享 |          7 |            2 |    3 |
| 开放网关         |          6 |            0 |    4 |
| 计费与账务       |         12 |            0 |    9 |
| 字典基础设施     |          0 |            0 |    3 |

| 批次 / 优先级 | 模块与工作范围 | 上线顺序、兼容与退出条件 |
| --- | --- | --- |
| S0 / P0 | 字典基础供给、商品、同步、订单展示契约 | 定稿码值清单 → 新增幂等迁移/种子覆盖存量租户与租户开通 → 验证 meta → 再切消费者。product_status 首先上线；sync v2/order_display 与旧类型并存，旧数据不改码。已有业务类型同名时检查 scope、value 和租户自定义内容，不能静默覆盖 |
| S1 / P1 | 身份与组织 | enable_status、tenant_status、invite_status；继续使用 user_status。先读标签再替换重复下拉；账户锁定、解锁和停用逻辑保留。字典管理自举状态保留本地两值兜底 |
| S1 / P1 | 审计与日志 | audit_result 统一两类日志筛选和标签；actor_type 文案可随 P2。历史结果、动作码不做数据回写；未知结果显示原值 |
| S1 / P1 | 通知 | notification_channel、delivery_status、布尔启停标签；优先当前已有页面。旧 notification.channel 仅 inbox/email/webhook，与外发五渠道分开；NotificationKind 仍来自驱动注册。旧 notification.status 的源码生产引用很少，延后至 P2按消费需求接入 |
| S1 / P1 | 商品与类目 | listing_status、export_job_status；商品 status 供给已在 S0 完成。SKU 两值与 SPU 三值分开，导出下载检查仍由代码负责 |
| S2 / P2 | 店铺与凭据 | shop、credential、refresh 的状态/来源和审计文案随管理页面接入。现行凭据状态有 refreshing，已移除 expired；不得照搬旧设计文档的集合。刷新协议阶段/重试原因不迁移 |
| S2 / P2 | 同步、映射与重放 | 基线/漂移/映射版本/重放结果等，优先真实消费界面；没有 UI 的条目登记契约后按需供给。系统字典的 sort 不改变重放顺序或处理策略 |
| S2 / P2 | 订单 | 消费 S0 的 order_display_status；事实五维、事件标签和退款标签按详情/历史页面接入。stateGraphs、SQL 投影及资金一致性检查全部保留；paid→pending_shipment 仅为展示投影，不是数据改码 |
| S2 / P2 | 客户、报价与分享 | 客户来源先做租户数据盘点和宽松回读；询价状态、分享状态、价格依据统一管理端文案。公开分享 H5 不依赖需要登录的 meta；快照文案和既有链接保持可用 |
| S3 / P3 | 开放网关 | 应用/授权/密钥/路由显示标签；free/per_call/package 分清表约束与实际开放能力。字典不能开放尚未实现的 package；安全判定不读字典 |
| S3 / P3 | 计费与账务 | 钱包、充值码、额度、账单、对账等只翻译显示；先在查询端灰度，确认账单金额、归属、状态分支不变，再逐页切换 |
| S3 / P3 | 客户等级 | 先确认 A/B/C 定义和是否需要自定义等级；有业务需求后补 API/界面并调整 CHECK。没有现行消费点时不为了凑字典先建空功能 |
| 不迁移 | 权限/菜单协议、技术枚举和字典自身元状态 | 留在代码或专用注册表，完成代码集中化即可，不创建运营可编辑值集合 |

实施前需要确认的业务选择已在计划中限定：A/B/C 等级含义、客户来源是否实行租户自定义及历史词条映射、展示文案是否允许每租户修改、已存在同名字典的处置、system 范围是否允许停用关键显示项。这些不阻塞本次源码分析，不预设生产数据答案。

**6. 兼容、回滚与风险**

| 风险触发点 | 影响 | 处理与验证 |
| --- | --- | --- |
| 把 label/sort/status 当作状态机规则 | 文案配置变成权限或资金行为变更 | 全部业务判断仍用原码；保留枚举、CHECK、投影、能力注册；改 label/color/sort 后验证接口结果和操作可用性不变 |
| meta 只返回启用项、字典不可用或缺项 | 当前选中值和历史筛选消失；一律按 else 处理还会把未知码误显示为失败/停用 | 列表与详情回退原码，空值显示破折号；历史筛选保留完整已知码集；编辑旧停用值可回显且未修改时不强制改值；新增选项才限制为可用词条 |
| 同名或相近字段强行合并 | active/disabled、enabled/disabled、boolean、三值用户状态混用；状态码被错误提交 | 只复用语义和值域都相同的类型；布尔标签查询可转字符串，但接口仍传 boolean；SPU/SKU、同步/导出、订单各维度保持独立 |
| 旧种子已经部署、租户手工建过同名类型 | DoNothing 会掩盖 scope 或集合冲突，新增种子并不能修复旧数据 | 先只读核对 tenant/type/value/scope；提供冲突清单。新增类型及词条幂等补齐，保留租户已有文案，不直接改已合并迁移 |
| 只初始化 tenant=1 | 新租户或其他租户缺字典，页面只有原码/没有选项 | 新增迁移覆盖存量；开通事务或统一初始化钩子覆盖新租户；至少验证两个旧租户和一个新租户 |
| 缓存或登录租户切换 | 跨页更新延迟、旧请求晚到覆盖新租户标签 | 后端 meta 按 tenant:type 缓存，TTL 60秒；当前写入只失效本进程，跨实例可能滞后到 TTL。多实例按需要增加版本/失效通知；前端缓存键包含 tenant 和 type，租户切换清空并丢弃旧请求 |
| 直接复用 packages 的持久化 useDictStore | 其 dictMap 默认仅按 code，应用当前未注入 setDictHandler，也没有已实现的版本接口 | 优先延伸现有 useMetaDictionary；确需缓存时先实现租户隔离、并发合并、失效和登录重置。不能把通用 store 的抽象 getVersion 当成后端现有接口 |
| 历史快照或匿名分享改成实时字典 | 已发报价含义变化；匿名用户请求 meta 返回认证失败 | 冻结快照保留当时 label/LayerName；管理端当前数据可查字典，匿名分享使用冻结文案或单独的安全公开投影 |
| 客户来源从自由文本立即改为闭合校验 | 历史值无法修改保存、导入失败 | 先盘点与补词条，再宽松回读，最后只约束新增/变更；记录未知值并由业务确认映射，不能全量归为 manual |
| 等级扩容后回滚固定 A/B/C CHECK | 新增等级会使 down 失败或被迫改历史数据 | 开关回滚到原界面和宽松服务，保留扩展数据；重新收紧 CHECK 前先核对全部值，不能在 down 中自动删除或改写未知等级 |

缓存与回退证据：[internal/modules/system/dict_meta.go:59](D:/code/go-admin-api/internal/modules/system/dict_meta.go:59)；[internal/modules/system/http.go:88](D:/code/go-admin-api/internal/modules/system/http.go:88)；[apps/admin/src/composables/use-meta-dictionary.ts:64](D:/code/admin-web/apps/admin/src/composables/use-meta-dictionary.ts:64)；[packages/stores/src/modules/dict.ts:54](D:/code/admin-web/packages/stores/src/modules/dict.ts:54)。

展示改造的回滚以消费者开关或恢复本地标签为主，新增展示字典可保留；不要通过删除词条来回滚，也不要回写存量业务状态。客户来源/等级涉及新业务数据时，回滚只停止新增入口并保持读取兼容，数据与约束恢复需要独立评估。

**7. 过滤排除说明与后续验收**

清单中明确排除权限码及模块、DataScope、菜单 type、认证用途和撤销原因、OAuth/凭据种类与刷新协议、连接器 ResourceType/ErrKind、重放请求选择器、映射执行策略、SMTP/TLS、模板格式、资金记账码、单币种 CNY、幂等与 outbox 状态、字典自身 scope/status 等 50 组。

固定告警标签码 X018（credential.expiring.3d 等 9 值）绑定通知生成、去重和恢复；通过专用模板接口改正文，不通过字典新增事件。订单纠正类型 X019（payment_reversal 等 5 值）绑定证据校验，保留固定协议。前端 NotificationKind 的 7 种供应商对应 config schema 与真实驱动，不能由字典增加一个选项就宣称支持新供应商。

HTTP 状态码、错误码、路由名、分页数量、日期格式、正则、UI Tab/布局/图表示例、按钮颜色和加载态，以及仅前端排序字段选项，不计入可迁移清单；避免把框架常量变成业务配置。商品类目树、平台、角色/部门等已经有主数据或专用配置接口的数据也不复制为静态系统字典。

代表定位：[apps/admin/src/views/catalog/product/catalog-display.ts:15](D:/code/admin-web/apps/admin/src/views/catalog/product/catalog-display.ts:15)；[apps/admin/src/views/system/notification/provider-fields.ts:6](D:/code/admin-web/apps/admin/src/views/system/notification/provider-fields.ts:6)；[internal/kernel/notifier/notifier.go:28](D:/code/go-admin-api/internal/kernel/notifier/notifier.go:28)；[internal/modules/order/validation.go:156](D:/code/go-admin-api/internal/modules/order/validation.go:156)；[internal/modules/identity/permission/registry.go:77](D:/code/go-admin-api/internal/modules/identity/permission/registry.go:77)。

建议实施验收：①每个消费 type 在同租户可查且值域正确；②改标签/颜色不改变筛选码或操作行为；③缺词条、停用、接口失败、未知码、历史值仍可回显；④不同租户标签互不泄露，旧请求不覆盖切换后的租户；⑤业务状态流转/权限/计费/投递/快照测试不退化；⑥新旧类型可并行、存量及新租户都具备种子；⑦客户来源完成历史词条盘点后再收紧新值校验，等级完成需求确认和 API 设计后再实施。

本次只生成分析与证据文件，没有修改两仓库业务源码、既有迁移或运行配置。生成与核验不需要运行服务或连接生产数据库。复核命令（在 D:/code/admin-web 执行）：

    node docs/reports/system-dictionary-2026-11-15/audit.cjs
    node docs/reports/system-dictionary-2026-11-15/build-report.cjs

脚本验证值域归类、规则文件与定位存在；交付前还会核对引用行内容、计数、CSV 行数及 Markdown 文件链接。详细核验结果见 validation.json（首次运行生成报告后创建）。这类只读分析不以应用构建或数据库迁移成功作为验收依据；未声称已实施迁移或通过业务回归测试。
