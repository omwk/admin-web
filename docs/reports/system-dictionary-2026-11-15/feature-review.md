**现阶段字典功能评审 · 2026-11-15**

现有字典已经具备基础管理能力，但供给、可写边界、业务消费和变更生效还没有闭环。建议先修正这四项，再逐模块推广统一字典。代码继续决定合法码值与业务行为；字典负责名称、颜色、排序。只有允许业务自行扩展的分类，才开放码值维护。

本次评审只读取源码、任务卡并执行局部测试，新增本报告，不修改业务代码或数据库。前端 HEAD 为 `f6d696da855d3525fe1aa3bbbe66c3cd98d3d4c2`，后端为 `8009f41f614d68eeb497a197402a806802951213`。没有连接运行数据库；不把任务卡记载的租户数据统计当作本次实测结果。

前一次抽离分析的 [完整清单](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/inventory.md) 和 [逐行引用](D:/code/admin-web/docs/reports/system-dictionary-2026-11-15/references.csv) 仍可用于后续迁移。本报告聚焦字典功能本身；旧报告的 v2/新类型兼容建议，以当前 [BE-IDN-008 任务卡](D:/code/go-admin-api/docs/tasks/BE-IDN-008-dict-supply.md) 记录的开发阶段同名修正方案为准。

**已具备的能力**

| 能力 | 现状与依据 | 评价 |
| --- | --- | --- |
| 类型与字典项 CRUD、分页、唯一性 | [表结构](D:/code/go-admin-api/migrations/000025_system_dict.up.sql:2) 对 tenant/type 和 tenant/dict/value 设唯一约束；管理接口与页面已实现 | 基础完整 |
| 租户隔离 | [持久层](D:/code/go-admin-api/internal/bootstrap/system_dict_store.go:36) 按租户查询；字典项通过 tenant_id/dict_id 复合外键关联父类型 | 已有可靠基础，不能等同于新租户供给完整 |
| 权限与请求字段边界 | [路由](D:/code/go-admin-api/internal/modules/system/routes.go:44) 接入 JWT 与权限；[解码器](D:/code/go-admin-api/internal/modules/system/http.go:38) 拒绝未知字段，租户与 builtin 不由请求指定 | 已实现；meta 需要登录，管理页另需权限 |
| system/business 分域 | [写服务](D:/code/go-admin-api/internal/modules/system/dict_write.go:69) 禁止向 system 加项、删项、改 value；业务域开放维护 | 方向正确，可写字段规则还需对齐 |
| 事务、幂等、审计 | [事务与审计](D:/code/go-admin-api/internal/modules/system/dict.go:87)、[HTTP 幂等处理](D:/code/go-admin-api/internal/modules/system/http.go:65) 已实现 | 不需要再补一套基础审计；extra 的审计仅记录字节数 |
| 元数据与前端降级 | [meta](D:/code/go-admin-api/internal/modules/system/dict_meta.go:22) 返回启用项；[前端 hook](D:/code/admin-web/apps/admin/src/composables/use-meta-dictionary.ts:63) 缺项回显原码、空值显示破折号 | 展示有兜底，下拉可用性尚不完整 |
| 缓存与页面刷新 | 后端 tenant:type、60 秒缓存、本进程写后失效；前端有在用消费者刷新、KeepAlive 激活重取、旧响应丢弃 | 单实例基础可用，多实例与多个浏览器仍需明确一致性要求 |

**需要优先处理的问题**

| 优先级 | 问题 | 影响 | 建议 |
| --- | --- | --- | --- |
| P0，推广前完成 | 新租户开通链路未接字典初始化 | 不会自动获得默认字典；只补默认租户 seed 无法覆盖全部租户 | 共用按租户初始化入口，接入实际 Provision/Materialize，并回填已有租户 |
| P0，推广前完成 | 已消费类型缺失、种子值域与业务不一致 | 标签查不到、筛选可能出现后端不接受的值 | 先修复下表三类供给契约，再扩展消费页面 |
| P1 | system 字典前后端可写范围不一致 | 界面承诺只能改标签/排序，API 仍能改状态、颜色、extra | 明确字段策略并在服务层校验；关键展示类型的停用单独约束 |
| P1 | 字典管理自身依赖 user_status | 该类型缺失、停用或请求失败时，管理表单的状态下拉为空 | 字典元状态固定使用本地 active/disabled；用户等业务表单另做降级 |
| P1，推广下拉前完成 | 启用选项、历史回显、历史筛选共用一种 meta 视图 | 停用词条后历史值只能回显原码，历史筛选失去选项 | 区分展示与可选集合；固定状态的完整码集继续来自代码 |
| P1，接业务分类前完成 | 业务字典缺少使用方登记和引用保护 | 已用 type/value 可改名或被删除，消费契约与历史数据失配 | 已接入类型/码值稳定；被引用项禁止改码/硬删，停用优先 |
| P1，多实例时；单实例可后排 | 更新只使本进程缓存和当前浏览器消费者失效 | 其他实例仍返回旧标签；其他浏览器的已挂载页不会因 TTL 到期自动刷新 | 明确允许延迟；需要及时生效时加入版本/失效通知及客户端重验证 |
| P2，随推广优化 | 全局缓存锁持有期间执行 SQL；管理页逐类型查项数 | 一个慢查询阻塞其他租户 meta；字典变多后请求数线性增长 | 按 key 合并加载并防旧读回填；项数聚合返回或批量查询 |

P0 表示把字典推广为统一依赖前的前置修复，不代表本次发现了已验证的线上事故。

**1. 供给缺口已进入计划，但仍未实现**

[迁移 000026](D:/code/go-admin-api/migrations/000026_system_dict_seed.up.sql:3) 只给迁移执行时已存在的租户插入三类字典；[默认租户 seed](D:/code/go-admin-api/internal/bootstrap/identity_seed.go:19) 固定 tenant=1；[租户物化](D:/code/go-admin-api/internal/bootstrap/identity_tenant_materialize.go:13) 只处理权限、菜单、角色、部门，没有字典初始化。

| 类型 | 当前源码供给 | 真实消费/业务码集 | 判断 |
| --- | --- | --- | --- |
| product_status | 迁移与运行 seed 均无此类型 | draft / active / archived；商品列表、详情已经请求 | 当前展示依赖回退原码，先补供给 |
| sync_run_status | pending / running / succeeded / failed | running / success / partial / failed / cancelled | 不是改中文标签可以解决，种子码值就不一致 |
| order_status | pending_payment / paid / shipped / completed / cancelled / refunded | 展示态为 pending_payment / pending_shipment / shipped / completed / closed / refunding / refunded / unknown | 应对齐展示投影，保留底层订单事实状态与计算逻辑 |

依据：[商品消费](D:/code/admin-web/apps/admin/src/views/catalog/product/index.vue:60)、[运行 seed](D:/code/go-admin-api/internal/bootstrap/system_dict_seed.go:24)、[同步约束](D:/code/go-admin-api/migrations/000006_sync_init.up.sql:33)、[订单展示投影](D:/code/go-admin-api/internal/modules/order/status.go:90)、[订单查询允许集](D:/code/go-admin-api/internal/modules/order/query.go:117)。

后端 [BE-IDN-008](D:/code/go-admin-api/docs/tasks/BE-IDN-008-dict-supply.md) 已规划租户供给、值域、自举修复；前端 [FE-IDN-004](D:/code/admin-web/docs/tasks/FE-IDN-004.md) 已规划 DictTag、状态文案替换、下拉兜底。两张卡当前均为待实现，不能把计划能力算作现有能力。

当前卡片已经明确所有租户是开发阶段数据，同名修正旧类型，不要求 v2 兼容。这个取舍在当前阶段可行。验收应同时验证默认租户、存量租户和真实开通的新租户；常规 seed 仍只补缺失，保留已有 label/sort/color，开发重置作为单独操作。

**2. system/business 应按码值所有权治理**

前端 [项表单](D:/code/admin-web/apps/admin/src/views/system/dict/item-form.vue:71) 对 system 保留原 status/color/extra，提示仅改 label/sort；[SF-4](D:/code/admin-web/docs/tasks/SF-4.md:71) 也承诺后端拦截。后端 [UpdateItem](D:/code/go-admin-api/internal/modules/system/dict_write.go:105) 只保护 value，随后写入完整请求；[Update](D:/code/go-admin-api/internal/modules/system/dict_write.go:31) 只保护 type，仍写入 status。具备更新权限的调用者可直接提交界面禁止的字段。

建议先定一份字段矩阵，再让 API、页面、OpenAPI 和测试保持一致。按当前 SF-4 的最小约束，system 只允许 label/sort；若需要租户调整 color，应同时开放前后端并记录规则。status/extra 的可写性需要单独定义，不能由隐藏输入框代替后端校验。

还应复核 BE-IDN-008 把 product_status、order_status 归 business 的选择：这两组值仍由 TS/Go/数据库或订单投影决定，字典加一个新值不会增加业务能力。建议固定码值的展示字典采用 system；若必须保留 business 分组，另用明确的码值可变策略限制增删改。此项是对现有计划的评审建议，本次未调整已定设计。

builtin 与 scope 是不同维度。当前 business 下的内置项虽然不能改 value，仍可删除；不能因为 builtin=true 就假定值集合受到完整保护。

**3. 管理自举与普通表单需要分别兜底**

[类型表单](D:/code/admin-web/apps/admin/src/views/system/dict/dictionary-form.vue:37) 和 [项表单](D:/code/admin-web/apps/admin/src/views/system/dict/item-form.vue:45) 都从 user_status 过滤 active/disabled，没有本地选项回退。失效时的准确影响是状态下拉失去选项，不能据此说整个页面必然打不开。管理元状态本身只有固定两值，应使用本地常量。

[用户表单](D:/code/admin-web/apps/admin/src/views/system/user/user-form.vue:135) 也直接使用远端 options；[hook](D:/code/admin-web/apps/admin/src/composables/use-meta-dictionary.ts:26) 请求失败会把 items 清空。名称回退并不能保证下拉仍可操作。固定状态表单建议从代码允许集构造值，再用字典补标签；确实动态的业务分类则应区分加载失败与成功返回空集合，保留旧选中值，不凭空制造新分类。

**4. 单一“启用项列表”不能覆盖全部消费场景**

[meta](D:/code/go-admin-api/internal/modules/system/dict_meta.go:42) 对停用类型返回空数组，对启用类型只取启用项。这符合新建选择器需要，但列表展示、历史筛选和编辑已有值还需要其他规则。

建议明确三种用途：当前记录展示尽量识别历史码；历史筛选保留完整已知码集；新增/变更值只允许业务支持且当前可选的码。固定状态不因展示项停用而改变业务合法性；可扩展分类可通过受控历史查询补标签，同时标明不可再选。暂不扩接口时，至少保留原码回退、旧值回显和固定状态完整筛选。

FE-IDN-004 的空字典最小回退有价值，还应补充部分缺项、旧选中值已停用、成功空集合与请求失败这几种情形。通知渠道/模板的 enabled 是 boolean，复用启停标签时仍须提交 boolean，不能改传 active/disabled。

**5. 业务分类需要引用保护，不能直接依赖通用 CRUD**

[业务类型更新](D:/code/go-admin-api/internal/modules/system/dict_write.go:31) 允许非内置类型改 type；[项更新](D:/code/go-admin-api/internal/modules/system/dict_write.go:105) 允许非内置业务项改 value；[项删除](D:/code/go-admin-api/internal/modules/system/dict_write.go:119) 只保护 system，没有业务记录引用检查。父类型删除也只检查是否还有字典项。

目前可确认的是治理缺口，尚未验证发生了业务孤儿数据。接 customer_source/customer_level 等真正可维护分类前，应登记消费字段、值来源、是否允许新增、引用检查入口。已使用的 type/value 优先保持稳定；被引用项返回 409 并说明原因，使用停用替代硬删；需要改码时走明确的数据迁移。客户来源还要先盘点历史自由文本。

**6. 缓存要区分服务端有效期与页面刷新**

[后端缓存](D:/code/go-admin-api/internal/modules/system/dict_meta.go:29) 按 tenant:type 隔离，TTL 60 秒；[写后失效](D:/code/go-admin-api/internal/modules/system/dict.go:97) 只作用于当前服务对象。A 实例提交后，B 实例仍可能返回旧缓存到过期。前端 [消费者广播](D:/code/admin-web/apps/admin/src/composables/use-meta-dictionary.ts:8) 只在当前 JavaScript 环境生效，其他浏览器或标签页收不到。

尤其不能承诺“所有页面最多 60 秒更新”：已经拿到旧结果的页面不会因后端 TTL 到期主动重取，可能一直显示到重新激活、刷新或再次触发请求。建议单实例先明确生效约定；多实例需要及时更新时采用 tenant/type 版本或可靠失效通知，并由客户端在适当时机重验证。对更新后马上读取的页面，还需防止负载均衡路由到持有旧缓存的实例。

[通用 useDictStore](D:/code/admin-web/packages/stores/src/modules/dict.ts:54) 有缓存、请求合并和抽象版本能力，但 admin 应用没有注入 setDictHandler，不能视为现有 meta 缓存已就绪。若统一接入，缓存与请求键应包含租户，退出登录时清理，晚到请求不能写回新会话。当前 hook 已有单消费者序号保护，应保留。

**7. 性能与可观测性按推广规模补齐**

[Meta](D:/code/go-admin-api/internal/modules/system/dict_meta.go:31) 持有同一把 mutex 执行数据库读取，防止旧读在失效后回填，但也会阻塞其他租户与其他类型，连缓存命中都要等锁。后续可按 tenant:type 合并加载，配合版本/代数检查保护写后失效；不能简单把 SQL 移出锁就结束。

[管理页](D:/code/admin-web/apps/admin/src/views/system/dict/index.vue:144) 读取两组类型后，逐个请求项数，再读取选中类型的项。单页类型列表情况下，管理数据请求约为 N+3，另有元数据请求。字典增多后建议聚合项数或批量查询。hook 当前各实例自行取数；实现每行 DictTag 前应共用请求，避免逐标签创建请求。以上是结构性扩展风险，本次未压测，不给出吞吐量结论。

类型不存在、请求失败、未知码和用户停用不应在运维侧都表现为“原码正常显示”。建议保留展示降级，同时为开发和维护端提供缺失类型、未知码、加载失败的可定位信号；避免按每行渲染重复告警。

**8. 契约、文档与测试应形成守卫**

建议维护一份 type → scope/码值策略 → value 集合 → 消费字段的清单，自动核对种子、数据库约束或领域允许集、前端类型与使用点。对允许动态扩展的分类只检查消费契约，不把全部值再写成固定枚举。

[现有新租户种子测试](D:/code/go-admin-api/internal/bootstrap/system_dict_scope_integration_test.go:194) 是插入租户后手工调用 seedSystemDictionaries，验证不到真实 Provision 是否自动初始化。新增回归应经过真实开通流程，并核对完整类型及码值，防止基础单测通过而供给仍缺失。

文档需要同步：后端 dictionary-usage.md 仍写“字典变更审计目前无”，与当前代码不符；FE-IDN-004 的提示列出 sync_job_status，而 BE-IDN-008 的供给表是 sync_run_status；其 options() 示例也与现有 computed 属性不同。应先对齐实现任务的输入，减少跨仓库误接。

并发编辑保护可作为 P2：当前事务锁串行执行写入，但没有客户端期望版本，旧表单仍可能覆盖新表单。多人维护较多时可引入版本冲突提示。现有审计并不等于完整版本恢复，extra 只记录长度这一边界也应保留说明。

**建议执行顺序与验收**

| 阶段 | 工作与对应计划 | 验收重点 |
| --- | --- | --- |
| 第一批：供给与边界 | 执行 BE-IDN-008；补 system 字段规则与码值所有权评审；明确自举修复的前端归属 | 真实新租户和存量租户完整；product/sync/order 三组准确；重复 seed 不覆盖文案；直接 API 不能修改禁止字段；管理页状态有本地兜底 |
| 第二批：统一消费 | 执行 FE-IDN-004，先身份组织、审计、通知、商品 | DictTag 共用加载；缺项、404/500、部分缺项、停用旧值均可回显；固定状态完整筛选；boolean 请求类型保持不变 |
| 第三批：一致性与分类治理 | 按部署形态补缓存版本/通知；接可扩展分类前增加引用保护 | A 写 B 读符合生效约定；其他浏览器能重验证；缓存按租户隔离；已使用 type/value 不能被普通改名/删除 |
| 第四批：规模化维护 | 聚合项数、缩小锁粒度、并发编辑提示；按业务需求扩展后续模块 | 无逐行重复请求；慢 key 不阻塞全部租户；旧读不回填；并发旧表单得到冲突提示 |

BE-IDN-008 正文涉及字典页自举，但结尾又要求“不要做前端”；FE-IDN-004 也排除字典管理页。执行前应将该项明确分到前端子项，避免两个仓库都以对方负责为由遗漏。本次评审不因此阻塞，也未执行实现。

**本次验证及边界**

前端在 `D:/code/admin-web/apps/admin` 执行：

```powershell
node ../../node_modules/vitest/vitest.mjs run --config vitest.config.ts src/composables/__tests__/meta-dictionary.test.ts src/views/system/dict/__tests__/dictionary-page.test.ts
```

结果：`Test Files 2 passed (2)`、`Tests 4 passed (4)`。覆盖标签/未知值、同页写后刷新、旧响应丢弃、切换字典与按钮权限等局部行为。

后端在 `D:/code/go-admin-api` 执行：

```powershell
$env:GOCACHE = Join-Path $env:TEMP 'codex-dictionary-review-go-build'
go test -count=1 ./internal/modules/system
```

结果：`ok github.com/omwk/go-admin-api/internal/modules/system 0.085s`。现有字典单测检查 60 秒缓存边界、租户隔离、副本所有权和显式失效；包内另含审计测试。

初次命令遇到 Corepack 与默认 Go 缓存目录的权限限制，随后使用已安装 Vitest 和系统临时 Go 缓存完成验证。没有运行全仓构建、数据库集成、迁移、多实例端到端或浏览器实测；以上测试通过不能证明尚未覆盖的供给与治理问题已解决。
