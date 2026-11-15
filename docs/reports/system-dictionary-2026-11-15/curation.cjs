'use strict';
module.exports = (schemas) => {
  const display = '仅展示适合';
  const business = '条件适合业务字典';
  const exclude = '排除';
  const labels = {
    '': '未设置',
    active: '启用',
    disabled: '停用',
    suspended: '暂停/停用',
    frozen: '冻结',
    pending: '等待中',
    processing: '处理中',
    running: '运行中',
    sent: '已发送',
    failed: '失败',
    success: '成功',
    succeeded: '成功',
    partial: '部分成功',
    cancelled: '已取消',
    completed: '已完成',
    done: '已完成',
    expired: '已过期',
    revoked: '已撤销',
    draft: '草稿',
    archived: '已归档',
    published: '已发布',
    issued: '已出账',
    locked: '锁定',
    user: '用户',
    system: '系统',
    api_client: 'API应用',
    api_call: 'API调用',
    failure: '失败',
    inbox: '站内信',
    email: '邮件',
    sms: '短信',
    wecom: '企业微信',
    dingtalk: '钉钉',
    webhook: 'Webhook',
    product_image: '商品图片',
    export: '导出文件',
    snapshot: '快照文件',
    all: '全部',
    dept: '本部门',
    dept_and_child: '本部门及下级',
    self: '仅本人',
    custom: '自定义',
    shop: '店铺',
    product: '商品',
    trade: '交易',
    crm: '客户管理',
    share: '分享',
    sync: '同步',
    gateway: '开放网关',
    billing: '计费',
    api: 'API权限',
    button: '按钮',
    data: '数据权限',
    dir: '目录',
    menu: '菜单',
    link: '外链',
    rotated: '轮换',
    logout: '退出',
    kick: '强制下线',
    replay: '重放撤销',
    oauth2: 'OAuth2授权',
    api_key: 'API Key',
    cookie: 'Cookie',
    session: 'Session',
    paused: '暂停',
    expiring: '即将到期/已到期待刷新',
    refreshing: '刷新中',
    needs_reauth: '需重新授权',
    auto: '自动',
    manual: '手工',
    none: '无',
    initial: '首次创建',
    refresh: '刷新',
    migration: '迁移',
    create: '创建',
    read: '读取',
    check: '检查',
    rotate: '轮换',
    disable: '停用',
    purge: '清除',
    order: '订单',
    inventory: '库存',
    category: '类目',
    superseded: '已被替代',
    field_added: '新增字段',
    field_removed: '删除字段',
    type_changed: '类型变化',
    info: '提示',
    warning: '警告',
    critical: '严重',
    open: '待处理',
    acked: '已确认',
    resolved: '已解决',
    ignored: '已忽略',
    missing_required: '缺少必填字段',
    type_mismatch: '类型不匹配',
    invalid_value: '非法值',
    mapping_error: '映射失败',
    source_metadata_unknown: '来源元数据未知',
    source_identity_ambiguous: '来源身份不明确',
    replayed: '已重放',
    discarded: '已丢弃',
    online: '在售',
    offline: '下架',
    deleted: '已删除',
    timestamp: '时间戳',
    page_token: '分页令牌',
    id_watermark: 'ID水位',
    cron: '定时调度',
    retry: '重试',
    fetch: '抓取',
    map: '映射',
    validate: '校验',
    persist: '入库',
    rule: '规则',
    default: '默认',
    platform: '平台来源',
    image: '图片',
    video: '视频',
    detail: '详情图',
    products: '商品',
    orders: '订单',
    inserted: '新增',
    updated: '更新',
    skipped_stale: '跳过旧数据',
    skipped_same: '跳过相同数据',
    quarantined: '已隔离',
    unknown: '未知',
    pending_payment: '待付款',
    pending_shipment: '待发货',
    paid: '已付款',
    shipped: '已发货',
    delivered: '已送达',
    unshipped: '未发货',
    unpaid: '未付款',
    partial_refund: '部分退款',
    refunded: '已退款',
    refunding: '退款中',
    partial_refunded: '部分已退款',
    requested: '已申请',
    rejected: '已拒绝',
    closed: '已关闭',
    largest_remainder_v1: '最大余数法v1',
    lifecycle: '生命周期',
    fulfillment: '履约',
    payment: '支付',
    after_sales: '售后',
    cancel: '取消',
    aggregate: '聚合',
    visibility: '可见性',
    command: '命令',
    correction: '纠正',
    conflict: '冲突',
    A: 'A级（等级定义待业务确认）',
    B: 'B级（等级定义待业务确认）',
    C: 'C级（等级定义待业务确认）',
    customer: '客户专属',
    new: '新询价',
    contacted: '已联系',
    quoted: '已报价',
    won: '已成交',
    lost: '已流失',
    live: '实时',
    intent: '已建立刷新意图',
    sending: '发送中',
    consumed: '上游已消费',
    temporary: '临时故障',
    invalid: '凭据失效',
    ambiguous: '结果不明确',
    sending_lost: '发送结果丢失',
    stage_failed: '暂存失败',
    stage_expired: '暂存过期',
    schedule: '定时调度',
    on_demand: '按需触发',
    credential_blocked: '凭据阻塞',
    admin_disabled: '管理员禁用',
    GET: 'HTTP GET',
    HEAD: 'HTTP HEAD',
    private: '私有',
    public: '公开',
    enabled: '启用',
    free: '免费',
    per_call: '按次计费',
    package: '套餐（保留码值，当前配置校验未开放）',
    topup: '充值',
    freeze: '冻结',
    settle: '结算',
    release: '解冻/释放',
    adjust: '调账',
    refund: '退款',
    reserved: '已预占',
    settled: '已结算',
    released: '已释放',
    unused: '未使用',
    used: '已使用/用完',
    void: '已作废',
    calls: '调用次数',
    units: '计量单位',
    purchase: '购买',
    gift: '赠送',
    exhausted: '已用尽',
    grant: '发放',
    reserve: '预占',
    consume: '消耗',
    expire: '过期',
    wallet: '钱包',
    funding: '入金',
    subscription: '订阅',
    compensation: '补偿',
    daily: '每日自动',
    call_cash: '现金调用',
    call_units: '额度调用',
    late_call_cash: '迟到现金调用',
    late_call_units: '迟到额度调用',
    late_subscription: '迟到订阅',
    supplement: '补扣',
    applied: '已应用',
    text: '纯文本',
    html: 'HTML',
    skipped: '已跳过',
    channel_unavailable: '渠道不可用',
    invite: '邀请',
    reset: '重置密码',
    verify: '邮箱验证',
    business: '业务域',
    smtp: 'SMTP',
    aliyun_dm: '阿里云邮件',
    aliyun_sms: '阿里云短信',
    sendgrid: 'SendGrid',
    wecom_bot: '企微机器人',
    dingtalk_bot: '钉钉机器人',
    http: 'HTTP Webhook',
    reject: '拒绝未知值',
    keep_raw: '保留原始值',
    fallback_null: '回退为空',
    customer_quote: '客户专属报价',
    customer_price_list: '客户价目表',
    default_price_list: '默认价目表',
    original: '商品原价',
    unpriced: '未定价',
    spu: 'SPU级',
    sku: 'SKU级',
    matched: '已匹配',
    no_eligible_price: '无可用价格',
    time: '时间范围',
    ids: '指定ID',
    quarantine: '隔离记录',
    auth_expired: '授权过期',
    rate_limited: '触发限流',
    unavailable: '上游不可用',
    invalid_request: '请求非法',
    starttls: 'STARTTLS',
    tls: 'TLS',
    plain: '回环明文',
    CNY: '人民币',
  };
  const tableModules = {
    tenant: '身份与组织',
    sys_user: '身份与组织',
    sys_role: '身份与组织',
    sys_permission: '身份与组织',
    sys_menu: '身份与组织',
    sys_refresh_token: '身份与组织',
    auth_token: '身份与组织',
    audit_log: '审计与日志',
    credential_audit: '审计与日志',
    notification: '通知',
    channel_provider: '通知',
    notify_template: '通知',
    notify_delivery: '通知',
    notify_outbox: '通知',
    notification_preference: '通知',
    platform: '店铺与凭据',
    shop: '店铺与凭据',
    shop_credential: '店铺与凭据',
    credential_version: '店铺与凭据',
    credential_refresh_run: '店铺与凭据',
    credential_refresh_reconciliation: '店铺与凭据',
    product_spu: '商品与类目',
    category: '商品与类目',
    category_mapping: '商品与类目',
    product_media: '商品与类目',
    listing: '商品与类目',
    export_job: '商品与类目',
    sales_order: '订单',
    order_item: '订单',
    order_status_history: '订单',
    order_sync_pending: '订单',
    customer: '客户、报价与分享',
    price_list: '客户、报价与分享',
    share_link: '客户、报价与分享',
    inquiry: '客户、报价与分享',
    api_client: '开放网关',
    api_client_secret: '开放网关',
    api_route: '开放网关',
    api_client_route: '开放网关',
    api_client_resource_grant: '开放网关',
    api_call: '开放网关',
    api_call_log: '开放网关',
    wallet: '计费与账务',
    wallet_txn: '计费与账务',
    call_charge: '计费与账务',
    recharge_code: '计费与账务',
    pricing_plan: '计费与账务',
    entitlement: '计费与账务',
    unit_txn: '计费与账务',
    billing_reconcile_run: '计费与账务',
    billing_reconcile_diff: '计费与账务',
    billing_statement: '计费与账务',
    billing_statement_line: '计费与账务',
    billing_adjustment: '计费与账务',
    raw_payload: '同步、映射与重放',
    schema_baseline: '同步、映射与重放',
    schema_drift_event: '同步、映射与重放',
    mapping_profile: '同步、映射与重放',
    mapping_version: '同步、映射与重放',
    quarantine_record: '同步、映射与重放',
    sync_cursor: '同步、映射与重放',
    sync_run: '同步、映射与重放',
    sync_error: '同步、映射与重放',
    dead_letter: '同步、映射与重放',
    replay_run: '同步、映射与重放',
    replay_run_item: '同步、映射与重放',
    sync_job: '同步、映射与重放',
    outbox_event: '基础设施（排除）',
    idempotency_key: '基础设施（排除）',
    file_object: '基础设施（排除）',
    sys_dict: '字典基础设施',
    sys_dict_item: '字典基础设施',
  };
  const rules = (side, files, match, scope) => ({
    side,
    files,
    match,
    ...(scope ? { scope } : {}),
  });
  const literal = (vals) =>
    `["'](?:${vals
      .filter(Boolean)
      .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join(
        '|',
      )})["']|\\b(?:${vals.filter(Boolean).join('|')})\\s*:\\s*(?:["']|\\{)`;
  const direct = (side, files, vals, scope) =>
    rules(side, files, literal(vals), scope);
  const F = (files, match, scope) => rules('front', files, match, scope);
  const B = (files, match, scope) => rules('back', files, match, scope);
  const anchor = (side, p, match) => [side, p, match];
  const items = [...schemas.values()].map((s, i) => ({
    id: `D${String(i + 1).padStart(3, '0')}`,
    schema: s.key,
    module: tableModules[s.table] || '待确认',
    field: s.key,
    labels: { ...labels },
    decision: exclude,
    priority: '不迁移',
    reason:
      '实现、权限、资金不变量或基础设施协议的固定码值；不允许通过业务字典增删或改变语义。',
    compat: '保持现有码值、代码校验、SQL约束和协议契约。',
    rules: [],
    anchors: [],
  }));
  const byKey = new Map(items.map((i) => [i.schema, i]));
  function set(key, patch) {
    if (!byKey.has(key)) throw new Error(`No schema: ${key}`);
    Object.assign(byKey.get(key), patch);
  }
  function show(key, dict, priority, reason, ruleList = [], more = {}) {
    set(key, {
      decision: display,
      dict,
      priority,
      reason,
      api: `GET /api/v1/meta/dicts/${dict}（只用于文案/排序；选项与代码支持集合取交集）`,
      retain: '保留类型、允许值校验与业务分支',
      compat: '码值不改；未知/缺失/停用项回显原值；历史记录继续可见。',
      rules: ruleList,
      ...more,
    });
  }
  function extra(id, module, field, values, patch) {
    items.push({
      id,
      module,
      field,
      values,
      labels: { ...labels },
      decision: exclude,
      priority: '不迁移',
      reason: '固定实现契约，不作为可编辑业务字典。',
      compat: '保留现有码值与实现。',
      rules: [],
      anchors: [],
      ...patch,
    });
  }
  const feUser = [
    F(
      '^apps/admin/src/',
      '\\bUserStatus\\b|useMetaDictionary\\(\x27user_status\x27\\)',
    ),
    direct(
      'front',
      '^apps/admin/src/(api/model/admin-user\\.ts|views/system/user/(index|user-form)\\.vue)$',
      ['active', 'disabled', 'locked'],
    ),
  ];
  show(
    'sys_user.status',
    'user_status',
    'P1',
    '已有系统字典及前端接入；仍有颜色兜底与操作文案。账户锁定语义必须留在身份服务。',
    [
      ...feUser,
      B(
        '^internal/modules/identity/admin_(users|unlock)\\.go$',
        '"(?:active|disabled|locked)"',
      ),
      B('^internal/bootstrap/system_dict_seed\\.go$', '"user_status"'),
    ],
    { labels: { ...labels, active: '正常', disabled: '停用', locked: '锁定' } },
  );
  show(
    'tenant.status',
    'tenant_status',
    'P1',
    '租户列表仍把非active统一显示为停用；可统一标签，但停用会影响登录与授权。',
    [
      F('^apps/admin/src/api/model/tenant\\.ts$', 'status:'),
      direct(
        'front',
        '^apps/admin/src/views/system/tenant/(index|tenant-actions|admin-invite)\\.vue$',
        ['active', 'suspended'],
      ),
      B('^internal/modules/identity/tenant\\.go$', '"(?:active|suspended)"'),
    ],
  );
  show(
    'sys_menu.status',
    'enable_status',
    'P1',
    '启停文案在菜单、角色、部门重复，建议共享两值展示字典；不可复用含locked的user_status。',
    [
      direct(
        'front',
        '^apps/admin/src/views/system/menu/(index|menu-form)\\.vue$',
        ['active', 'disabled'],
      ),
      B(
        '^internal/modules/identity/admin_menus\\.go$',
        '"(?:active|disabled)"',
      ),
    ],
  );
  set('sys_role.data_scope', {
    reason:
      '数据范围决定授权SQL，新增值必须实现scope策略；显示标签可由代码目录统一，不能由运营扩展。',
    rules: [
      F(
        '^apps/admin/src/',
        '\\bDataScope\\b|\\bdataScope(?:Labels|Options)\\b',
      ),
      B(
        '^internal/modules/identity/admin_roles\\.go$',
        '"(?:all|dept|dept_and_child|self|custom)"',
      ),
    ],
  });
  set('sys_menu.type', {
    reason:
      '目录/菜单/按钮/外链决定路由、安全校验和父子限制，属于框架契约；保留menuTypes与类型联合，标签可代码内归一。',
    rules: [
      F('^apps/admin/src/', '\\bmenuTypes\\b|\\bmenuTypeLabels\\b'),
      direct('front', '^apps/admin/src/api/model/menu\\.ts$', [
        'dir',
        'menu',
        'button',
        'link',
      ]),
      B(
        '^internal/modules/identity/admin_menus\\.go$',
        '"(?:dir|menu|button|link)"',
      ),
    ],
  });
  set('sys_permission.module', {
    reason:
      '权限码module:resource:action首段契约，受数据库CHECK与权限注册器约束；不是可新增业务分类。',
    rules: [
      B(
        '^internal/modules/identity/permission/registry\\.go$',
        'Module|module',
      ),
    ],
  });
  set('sys_permission.type', {
    reason: 'API/按钮/数据权限是鉴权模型分类，不能由字典增删。',
    rules: [
      direct('front', '^apps/admin/src/api/model/system\\.ts$', [
        'api',
        'button',
        'data',
      ]),
    ],
  });
  show(
    'audit_log.result',
    'audit_result',
    'P1',
    '前端筛选和两种日志标签重复，适合统一成功/失败文案。',
    [
      F('^apps/admin/src/views/system/', '\\blogResults\\b'),
      direct(
        'front',
        '^apps/admin/src/(api/model/audit\\.ts|views/system/(audit-log|login-log)/index\\.vue|views/system/shared/log-filters\\.ts)$',
        ['success', 'failure'],
      ),
      B('^internal/kernel/audit/', '"(?:success|failure)"'),
    ],
  );
  show(
    'credential_audit.result',
    'audit_result',
    'P2',
    '凭据审计与通用审计采用相同结果语义，可共用展示字典。',
    [
      B(
        '^internal/modules/shop/(credential|credential_use|service)\\.go$',
        '"(?:success|failure)"',
      ),
    ],
  );
  show(
    'audit_log.actor_type',
    'audit_actor_type',
    'P2',
    '审计操作者可统一显示为用户/系统/API应用；写审计的机器身份定义仍固定。',
    [B('^internal/kernel/audit/', '"(?:user|system|api_client)"')],
  );
  show(
    'credential_audit.actor_type',
    'audit_actor_type',
    'P2',
    '与通用审计共用显示，但不能因字典停用影响审计写入。',
  );
  show(
    'credential_audit.action',
    'credential_audit_action',
    'P2',
    '业务运维审计动作可翻译；新增动作仍必须由代码发出。',
    [
      B(
        '^internal/modules/shop/(credential|credential_use|service)\\.go$',
        'Action:|"(?:create|read|check|refresh|rotate|disable|purge)"',
      ),
    ],
  );
  show(
    'platform.status',
    'enable_status',
    'P2',
    '平台是否可用可共用展示字典，连接器注册与可用性检查仍由代码执行。',
    [
      B(
        '^internal/modules/shop/service\\.go$',
        'platform\\.Status|Platform\\.Status',
      ),
    ],
  );
  show(
    'shop.status',
    'shop_status',
    'P2',
    '店铺启用/暂停/停用是业务状态，有独立暂停语义，不能并入两值状态。',
    [
      B(
        '^internal/modules/shop/(service|http)\\.go$',
        '"(?:active|paused|disabled)"',
      ),
    ],
  );
  show(
    'shop_credential.status',
    'credential_status',
    'P2',
    '运维状态适合统一标签；000015已删除expired并增加refreshing，必须使用现行集合。',
    [
      B('^internal/modules/shop/refresh/policy\\.go$', '"(?:active|expiring)"'),
      B(
        '^internal/modules/shop/credential\\.go$',
        '"(?:active|expiring|refreshing|needs_reauth|disabled)"',
      ),
    ],
  );
  show(
    'credential_version.created_reason',
    'credential_version_reason',
    'P2',
    '凭据版本来源是审计维度，可只统一显示。',
    [
      B(
        '^internal/modules/shop/(credential|refresh/[^/]+)\\.go$',
        'CreatedReason|Reason: "(?:initial|refresh|manual|migration)"',
      ),
    ],
  );
  show(
    'credential_refresh_run.status',
    'credential_refresh_status',
    'P2',
    '刷新任务结果可统一显示；任务恢复、重试和CAS继续使用固定码。',
    [
      B(
        '^internal/modules/shop/refresh/(service|refresh|run|finish)\\.go$',
        '"(?:running|success|failed|skipped)"',
      ),
    ],
  );
  show(
    'credential_refresh_run.trigger',
    'credential_refresh_trigger',
    'P2',
    '手动/定时/按需是可读业务来源，适合展示字典。',
    [B('^internal/modules/shop/refresh/', '"(?:manual|schedule|on_demand)"')],
  );
  show(
    'sync_job.block_reason',
    'sync_block_reason',
    'P2',
    '面向运维的阻塞原因可统一标签；不能通过配置清除阻塞。',
    [
      B(
        '^internal/bootstrap/sync_credential_recovery\\.go$',
        '"(?:credential_blocked|admin_disabled)"',
      ),
    ],
  );
  show(
    'schema_baseline.status',
    'schema_baseline_status',
    'P2',
    '基线当前/被替代状态可统一显示，提升基线流程保留。',
    [
      B(
        '^internal/bootstrap/sync_drift(?:_admin)?\\.go$',
        '"(?:active|superseded)"',
      ),
    ],
  );
  show(
    'schema_drift_event.kind',
    'schema_drift_kind',
    'P2',
    '漂移种类面向运维，可统一文案；差异检测仍由算法生成。',
    [
      B(
        '^internal/modules/ingestion/drift\\.go$',
        '"(?:field_added|field_removed|type_changed)"',
      ),
    ],
  );
  show(
    'schema_drift_event.severity',
    'business_alert_severity',
    'P2',
    '此处为业务漂移告警严重程度，区别于日志级别；标签可配置。',
    [
      B(
        '^internal/modules/ingestion/drift\\.go$',
        '"(?:info|warning|critical)"',
      ),
    ],
  );
  show(
    'schema_drift_event.status',
    'schema_drift_status',
    'P2',
    '漂移确认/解决/忽略是固定工作流，统一显示与筛选。',
    [
      B(
        '^internal/bootstrap/sync_drift_admin\\.go$',
        '"(?:open|acked|resolved|ignored)"',
      ),
    ],
  );
  show(
    'mapping_profile.status',
    'enable_status',
    'P2',
    '映射配置启停可共用两值展示字典，执行器校验保留。',
    [
      B(
        '^internal/modules/ingestion/mapping_service\\.go$',
        '"(?:active|disabled)"',
      ),
    ],
  );
  show(
    'mapping_version.status',
    'mapping_version_status',
    'P2',
    '映射版本发布/归档影响可重放性，只迁移文案。',
    [
      B(
        '^internal/modules/ingestion/mapping_service\\.go$',
        '"(?:draft|published|archived)"',
      ),
    ],
  );
  show(
    'quarantine_record.status',
    'record_disposal_status',
    'P2',
    '隔离记录处理结果与死信可共享展示，不能任意扩展处理动作。',
    [B('^internal/bootstrap/sync_page\\.go$', 'status=\'pending\'|"replayed"')],
  );
  show(
    'dead_letter.status',
    'record_disposal_status',
    'P2',
    '与隔离记录具有相同处理结果显示语义。',
  );
  show(
    'listing.status',
    'listing_status',
    'P1',
    '商品详情当前原样显示平台刊登状态，适合与SPU状态分开翻译。',
    [
      F(
        '^apps/admin/src/views/catalog/product/detail\\.vue$',
        'listing\\.status|displayText\\(record\\.status',
      ),
      B(
        '^internal/modules/catalog/(upsert|listing)\\.go$',
        '"(?:online|offline|deleted)"',
      ),
    ],
  );
  show(
    'sync_run.status',
    'sync_run_status_v2',
    'P0',
    '现种子pending/running/succeeded/failed与真实running/success/partial/failed/cancelled不一致，先发布准确集合，再逐步替换旧类型。',
    [
      B(
        '^internal/bootstrap/(sync_run|sync_page|sync_engine)\\.go$',
        '(?:Status|status).*(?:"running"|"success"|"partial"|"failed"|"cancelled")',
      ),
      B('^internal/bootstrap/system_dict_seed\\.go$', '"sync_run_status"'),
    ],
    {
      compat:
        '不重命名业务数据success；新建只读v2展示字典，旧字典保留；不能把pending当作真实sync_run状态。',
    },
  );
  show(
    'sync_run.trigger',
    'sync_run_trigger',
    'P2',
    '同步触发来源面向运维，可统一文案；保留调度路径。',
    [
      B('^internal/modules/sync/management\\.go$', 'Trigger:'),
      B('^internal/worker/scheduler\\.go$', '"cron"'),
    ],
  );
  show(
    'sync_error.stage',
    'sync_error_stage',
    'P2',
    '运行错误阶段便于检索和展示，实际阶段由执行管线决定。',
    [B('^internal/modules/sync/', 'Stage:.*"(?:fetch|map|validate|persist)"')],
  );
  show(
    'replay_run.status',
    'replay_run_status',
    'P2',
    '与同步运行码值相同但独立工作流，建议先分类型防止语义耦合。',
    [
      B(
        '^internal/bootstrap/replay_(batch|admin|create|runtime)\\.go$',
        '(?:Status|status).*["\x27](?:running|success|partial|failed|cancelled)["\x27]',
      ),
    ],
  );
  show(
    'replay_run_item.outcome',
    'replay_item_outcome',
    'P2',
    '逐条重放处理结果适合翻译；计数守恒与幂等处置保留。',
    [
      B(
        '^internal/bootstrap/replay_(batch|members)\\.go$',
        '"(?:inserted|updated|skipped_stale|skipped_same|quarantined|failed)"',
      ),
    ],
  );
  show(
    'category.status',
    'enable_status',
    'P2',
    '类目启停可共用显示；类目树本身仍是主数据。',
    [
      B(
        '^internal/bootstrap/catalog_category(?:_mutation)?\\.go$',
        '"(?:active|disabled)"',
      ),
    ],
  );
  show(
    'category_mapping.source',
    'category_mapping_source',
    'P2',
    '手工/规则/默认属于可读业务来源，但自动映射与置信度算法不能由字典实现。',
    [
      B('^internal/modules/catalog/category_sync\\.go$', 'Source:.*"default"'),
      B(
        '^internal/bootstrap/catalog_category_mutation\\.go$',
        '"(?:manual|rule|default)"',
      ),
    ],
  );
  show(
    'product_spu.status',
    'product_status',
    'P0',
    '前端已经调用字典但后端未见种子；先补内置三项并保留productStatusValues校验。',
    [
      F(
        '^apps/admin/src/',
        '\\bProductStatus\\b|\\bproductStatusValues\\b|useMetaDictionary\\(\x27product_status\x27\\)',
      ),
      direct(
        'front',
        '^apps/admin/src/(api/model/catalog\\.ts|views/catalog/product/catalog-display\\.ts)$',
        ['draft', 'active', 'archived'],
      ),
      B(
        '^internal/modules/catalog/product\\.go$',
        '"(?:draft|active|archived)"',
      ),
    ],
  );
  show(
    'product_spu.source',
    'product_source',
    'P2',
    '手工/平台来源影响允许编辑与合并路径，只统一展示。',
    [
      B('^internal/modules/catalog/product\\.go$', '"(?:platform|manual)"'),
      B(
        '^internal/bootstrap/catalog_product_write\\.go$',
        '"(?:platform|manual)"',
      ),
    ],
  );
  show(
    'product_media.type',
    'product_media_type',
    'P2',
    '图片/视频/详情图可统一显示，渲染和媒体校验必须保留。',
  );
  show(
    'export_job.kind',
    'export_kind',
    'P2',
    '导出任务资源种类可翻译；orders仅为表约束支持，不代表已实现订单导出器。',
    [B('^internal/bootstrap/catalog_export\\.go$', '"products"')],
  );
  show(
    'export_job.status',
    'export_job_status',
    'P1',
    '导出生命周期可统一显示；下载只在succeeded、未过期时可用的逻辑保留。',
    [
      B(
        '^internal/bootstrap/catalog_export(?:_runtime|_observation|_cleanup)?\\.go$',
        '(?:Status|status).*["\x27](?:pending|running|succeeded|failed|expired)["\x27]',
      ),
    ],
  );
  for (const [field, dict] of [
    ['lifecycle_status', 'order_lifecycle_status'],
    ['fulfillment_status', 'order_fulfillment_status'],
    ['payment_status', 'order_payment_status'],
    ['after_sales_status', 'order_after_sales_status'],
    ['cancel_status', 'order_cancel_status'],
  ]) {
    const dimension = {
      lifecycle_status: 'lifecycle',
      fulfillment_status: 'fulfillment',
      payment_status: 'payment',
      after_sales_status: 'after_sales',
      cancel_status: 'cancel',
    }[field];
    show(
      `sales_order.${field}`,
      dict,
      'P2',
      '订单正交事实维度，只统一显示；必须保留stateGraphs、资金一致性和状态投影，不合并为一个可配状态机。',
      [
        B(
          '^internal/modules/order/status\\.go$',
          `"${dimension}"\\s*:|\\b${{ lifecycle: 'Lifecycle', fulfillment: 'Fulfillment', payment: 'Payment', after_sales: 'AfterSales', cancel: 'Cancel' }[dimension]}\\b`,
        ),
      ],
    );
  }
  show(
    'order_item.refund_status',
    'order_item_refund_status',
    'P2',
    '订单项售后状态可翻译，不能和支付维度partial_refund混用。',
    [
      B(
        '^internal/modules/order/items\\.go$',
        'RefundStatus|"(?:unknown|none|refunding|partial_refunded|refunded)"',
      ),
    ],
  );
  show(
    'order_status_history.dimension',
    'order_status_dimension',
    'P2',
    '状态历史维度适合面向审计的显示字典，后续visibility迁移已纳入。',
    [
      B(
        '^internal/modules/order/status\\.go$',
        '^\\s*return \\[\\]string\\{"lifecycle"',
      ),
      B('^internal/modules/order/vanished\\.go$', '"visibility"'),
    ],
  );
  show(
    'order_status_history.event_kind',
    'order_event_kind',
    'P2',
    '状态变更历史事件可统一标签；snapshot/command/correction的执行语义固定。',
    [
      B(
        '^internal/modules/order/contract\\.go$',
        'Change(?:Snapshot|Command|Correction).*=',
      ),
      B('^internal/modules/order/service\\.go$', '"conflict"'),
    ],
  );
  show(
    'customer.status',
    'customer_status',
    'P2',
    '客户启停与报价/分享权限有关，只迁移文案。',
    [
      B(
        '^internal/modules/share/validation\\.go$',
        '"(?:active|disabled)"',
        '^func normalizeCustomer',
      ),
      B('^internal/bootstrap/share_customer\\.go$', '"(?:active|disabled)"'),
    ],
  );
  set('customer.level', {
    decision: business,
    dict: 'customer_level',
    priority: 'P3',
    reason:
      'A/B/C是最接近运营分类的闭合集合，但当前仅表中有列，Customer模型和API未接入；先确认业务需要及等级定义。',
    api: '业务决定启用后接入GET /api/v1/meta/dicts/customer_level',
    retain: '移除枚举式CHECK需新增迁移；保留长度、租户和字典存在性校验',
    compat:
      '保留空串表示未分级；历史A/B/C不改码、不猜测等级价值；新增DTO并先兼容缺省。',
  });
  show(
    'price_list.type',
    'price_list_type',
    'P2',
    '客户/默认价目表可统一显示，CustomerID约束与价格层级算法必须保留。',
    [
      B(
        '^internal/modules/share/validation\\.go$',
        '"(?:customer|default)"',
        '^func normalizeList',
      ),
      B(
        '^internal/modules/share/pricing/resolve\\.go$',
        '"(?:customer|default)"',
      ),
    ],
  );
  show(
    'price_list.status',
    'price_list_status',
    'P2',
    '报价生效/过期会影响价格命中，只迁移显示与筛选。',
    [
      B(
        '^internal/modules/share/validation\\.go$',
        '"(?:draft|active|expired|disabled)"',
        '^func normalizeList',
      ),
    ],
  );
  show(
    'share_link.type',
    'share_link_type',
    'P2',
    '分享商品/价目表可翻译，快照成员与权限仍由代码构建。',
    [
      B(
        '^internal/modules/share/link\\.go$',
        'Type.*"(?:products|price_list)"',
      ),
    ],
    { labels: { ...labels, price_list: '价目表' } },
  );
  show(
    'share_link.status',
    'share_link_status',
    'P2',
    '分享有效/撤销/过期可翻译；访问门禁必须按事实校验，不能取字典是否启用代替。',
    [
      B(
        '^internal/modules/share/(link|access)\\.go$',
        '(?:Status|status).*["\x27](?:active|revoked|expired)["\x27]',
      ),
    ],
  );
  show(
    'inquiry.status',
    'inquiry_status',
    'P2',
    '询价业务状态有固定rank和终态，适合统一显示但不能由排序改变流转。',
    [
      B(
        '^internal/modules/share/inquiry_service\\.go$',
        '"(?:new|contacted|quoted|won|lost)"',
      ),
      B('^internal/modules/share/inquiry_submit\\.go$', 'Status: "new"'),
    ],
  );
  for (const key of [
    'api_client.status',
    'api_client_route.status',
    'api_client_resource_grant.status',
  ])
    show(
      key,
      'gateway_access_status',
      'P3',
      '网关启停可统一显示，但直接影响应用访问上限，授权校验不能依赖字典。',
      [
        B(
          '^internal/modules/gateway/(auth|secret|resource)\\.go$',
          'Status.*"(?:active|suspended)"',
        ),
      ],
    );
  show(
    'api_client_secret.status',
    'gateway_secret_status',
    'P3',
    '密钥有效/过期/撤销可翻译，鉴权和轮换语义固定。',
    [
      B(
        '^internal/modules/gateway/(secret|auth)\\.go$',
        'Status.*"(?:active|expired|revoked)"',
      ),
    ],
  );
  show(
    'api_route.status',
    'gateway_route_status',
    'P3',
    'enabled/disabled与通用active不同，保留独立码值，不能强行统一为active。',
    [B('^internal/modules/gateway/registry\\.go$', 'Status == "enabled"')],
  );
  show(
    'api_route.billing_mode',
    'gateway_billing_mode',
    'P3',
    '可统一收费模式名称；数据库保留package但实际validPricing仅接受free/per_call，不能因字典新增而开放。',
    [
      B(
        '^internal/modules/gateway/(billing|admin_http|call_execute)\\.go$',
        '"(?:free|per_call|package)"',
      ),
    ],
  );
  for (const [key, dict, reason] of [
    ['wallet.status', 'wallet_status', '钱包启停会影响资金操作'],
    [
      'recharge_code.status',
      'recharge_code_status',
      '充值码核销必须保持单次消费',
    ],
    ['pricing_plan.status', 'enable_status', '套餐启停影响购买'],
    ['entitlement.status', 'entitlement_status', '额度过期/用尽是计费事实'],
    ['billing_statement.status', 'billing_statement_status', '出账后不可变'],
    [
      'billing_adjustment.status',
      'billing_adjustment_status',
      '调账只能应用一次',
    ],
    [
      'billing_reconcile_diff.status',
      'reconcile_diff_status',
      '差异处理需要审计',
    ],
  ])
    show(key, dict, 'P3', `${reason}；只迁移显示，不让字典决定记账或流转。`);
  show(
    'entitlement.source',
    'entitlement_source',
    'P3',
    '购买/赠送是业务来源标签；资金约束及流水归属保留。',
    [B('^internal/modules/billing/entitlement\\.go$', '"(?:purchase|gift)"')],
  );
  show(
    'billing_reconcile_run.trigger',
    'reconcile_trigger',
    'P3',
    '每日/人工/补偿属于可读运维来源，调度实现不变。',
    [
      B(
        '^internal/modules/billing/reconcile\\.go$',
        '"(?:daily|manual|compensation)"',
      ),
    ],
  );
  show(
    'billing_reconcile_run.status',
    'reconcile_run_status',
    'P3',
    '对账执行结果可翻译，运行锁与完成提交仍由代码控制。',
  );
  show(
    'billing_statement_line.kind',
    'statement_line_kind',
    'P3',
    '账单行类型适合在账单界面统一翻译；不允许配置新种类影响金额聚合与迟到数据归属。',
    [
      B(
        '^internal/bootstrap/billing_statement_sources\\.go$',
        '"(?:call_cash|call_units|late_call_cash|late_call_units|subscription|late_subscription|refund|supplement)"',
      ),
    ],
  );
  show(
    'billing_adjustment.kind',
    'billing_adjustment_kind',
    'P3',
    '退款/补扣名称可统一，必须保留原流水引用、证据和差异校验。',
    [
      B(
        '^internal/modules/billing/statement_adjustment\\.go$',
        '"(?:refund|supplement)"',
      ),
    ],
  );
  show(
    'notification.channel',
    'notification_inbox_channel',
    'P1',
    '旧站内通知表有独立channel约束，不能简单与外发渠道全集合并。',
    [
      F('^apps/admin/src/views/system/notification/index\\.vue$', "'inbox'"),
      B('^internal/kernel/notifier/http\\.go$', '"inbox"'),
    ],
  );
  const channels = ['email', 'sms', 'wecom', 'dingtalk', 'webhook'];
  show(
    'channel_provider.channel',
    'notification_channel',
    'P1',
    '前后端多处维护同一渠道名称；保留代码允许集并与已实现/可用能力相交。',
    [
      F(
        '^apps/admin/src/',
        '\\bNotificationChannel\\b|\\bnotificationChannels\\b|\\bchannelLabel\\b',
      ),
      direct(
        'front',
        '^apps/admin/src/(api/model/notification\\.ts|views/system/notification/options\\.ts)$',
        channels,
      ),
      B('^internal/kernel/notifier/inbox\\.go$', 'ExternalChannels'),
      B('^internal/kernel/setting/defaults\\.go$', 'default_channel'),
    ],
  );
  show(
    'notify_delivery.channel',
    'notification_channel',
    'P1',
    '与供应商渠道共享展示字典，但实际发送能力继续由provider注册表控制。',
  );
  show(
    'notification_preference.channel',
    'notification_channel',
    'P1',
    '订阅偏好共享渠道标签；不能通过新增字典项产生新发送通道。',
  );
  show(
    'notify_delivery.status',
    'notification_delivery_status',
    'P1',
    '前端deliveryStatuses集中硬编码；适合统一标签与颜色，轮询和重试分支保留。',
    [
      F('^apps/admin/src/views/system/notification/', '\\bdeliveryStatuses\\b'),
      direct(
        'front',
        '^apps/admin/src/(api/model/notification\\.ts|views/system/notification/(options\\.ts|provider-test\\.vue))$',
        ['pending', 'sent', 'failed', 'skipped'],
      ),
      B(
        '^internal/kernel/notifier/channel/service\\.go$',
        'Status: "(?:pending|sent|failed|skipped)"',
      ),
    ],
  );
  show(
    'notification.status',
    'notification_inbox_status',
    'P1',
    '旧通知表结果与新外发delivery状态不同，保留独立类型。',
    [
      B(
        '^internal/bootstrap/notification_inbox\\.go$',
        '"(?:pending|sent|failed)"',
      ),
    ],
  );
  set('notify_template.format', {
    reason:
      'text/html控制转义与发送格式，属于渲染协议。继续由notify_template专用接口维护，不走系统字典。',
    rules: [
      F('^apps/admin/src/api/model/notification\\.ts$', 'format:'),
      B('^internal/kernel/notifier/channel/template\\.go$', '"(?:text|html)"'),
    ],
  });
  set('share_link.mode', {
    reason:
      '表约束有snapshot/live，但当前normalizeLink只接受snapshot。live不是已支持下拉项，禁止字典启用后绕过实现。',
    rules: [B('^internal/modules/share/link\\.go$', 'Mode.*"snapshot"')],
  });
  set('sys_dict.status', {
    reason:
      '字典自身启停属于字典机制元状态；编辑页当前依赖user_status，应保留代码兜底以避免自举循环。',
    rules: [
      F(
        '^apps/admin/src/views/system/dict/dictionary-form\\.vue$',
        'useMetaDictionary|active|disabled',
      ),
      B('^internal/modules/system/dict\\.go$', 'validStatus'),
    ],
  });
  set('sys_dict_item.status', {
    reason:
      '字典项元状态，不再以可编辑字典定义自身；避免字典被停用后无法维护。',
    rules: [
      F(
        '^apps/admin/src/views/system/dict/item-form\\.vue$',
        'useMetaDictionary|active|disabled',
      ),
    ],
  });
  set('sys_dict.scope', {
    reason:
      'system/business是字典写权限及seed策略的框架契约，必须保留代码常量。',
    rules: [
      F('^apps/admin/src/', '\\bDictionaryScope\\b'),
      B('^internal/modules/system/', '\\bDictScope(?:System|Business)\\b'),
    ],
  });
  const moreRules = {
    'wallet.status': [
      'billing/(credit|charge)\\.go',
      'Status.*"(?:active|frozen)"',
    ],
    'recharge_code.status': ['billing/credit\\.go', '"(?:unused|used|void)"'],
    'pricing_plan.status': [
      'billing/entitlement\\.go',
      'Status.*"(?:active|disabled)"',
    ],
    'entitlement.status': [
      'billing/entitlement\\.go',
      'Status.*"(?:active|expired|exhausted)"',
    ],
    'billing_statement.status': [
      'billing/statement\\.go',
      'Status.*"(?:draft|issued)"',
    ],
    'billing_adjustment.status': [
      'billing/statement_adjustment\\.go',
      'Status.*"(?:open|applied)"',
    ],
  };
  for (const [key, [p, m]] of Object.entries(moreRules))
    byKey.get(key).rules.push(B(`^internal/modules/${p}$`, m));
  extra(
    'X001',
    '身份与组织',
    'AdminRole.status / Department.status',
    ['active', 'disabled'],
    {
      decision: display,
      dict: 'enable_status',
      priority: 'P1',
      reason:
        '角色、部门表并非都有CHECK，但服务与前端明确只接受两值，适合共用启停显示。',
      api: 'GET /api/v1/meta/dicts/enable_status',
      retain: '保留服务校验和TS联合类型',
      compat: '角色/部门启停动作与授权缓存失效保持原语义。',
      rules: [
        direct(
          'front',
          '^apps/admin/src/views/system/(role/(role-form|index)|dept/(department-form|index))\\.vue$',
          ['active', 'disabled'],
        ),
        B(
          '^internal/modules/identity/admin_(roles|depts)\\.go$',
          '"(?:active|disabled)"',
        ),
      ],
      anchors: [
        anchor(
          'front',
          'apps/admin/src/views/system/dept/department-form.vue',
          "label: '启用'",
        ),
        anchor('back', 'internal/modules/identity/admin_depts.go', 'Status'),
      ],
    },
  );
  extra(
    'X002',
    '身份与组织',
    'Invite.status / inviteView',
    ['active', 'expired', 'revoked', 'used'],
    {
      decision: display,
      dict: 'invite_status',
      priority: 'P1',
      reason:
        '前端labels与后端计算投影重复；适合显示字典，状态按到期/撤销/使用次数计算。',
      api: 'GET /api/v1/meta/dicts/invite_status',
      retain: '保留inviteView计算及接受邀请校验',
      compat: '保留revoked/used/expired优先级；显示标签不参与核销。',
      rules: [
        F(
          '^apps/admin/src/views/system/user/invite-panel\\.vue$',
          'active:|expired:|revoked:|used:|labels\\[',
        ),
        direct('front', '^apps/admin/src/api/model/invite\\.ts$', [
          'active',
          'expired',
          'revoked',
          'used',
        ]),
        B(
          '^internal/modules/identity/account_invite\\.go$',
          '"(?:active|expired|revoked|used)"',
        ),
      ],
      anchors: [
        anchor(
          'front',
          'apps/admin/src/views/system/user/invite-panel.vue',
          'const labels',
        ),
        anchor(
          'back',
          'internal/modules/identity/account_invite.go',
          'status :=',
        ),
      ],
    },
  );
  extra(
    'X003',
    '商品与类目',
    'ProductSKUInput.Status / product_sku.status',
    ['active', 'disabled'],
    {
      decision: display,
      dict: 'enable_status',
      priority: 'P2',
      reason: 'SKU与SPU状态不同，SKU仅两值；必须保留校验。',
      api: 'GET /api/v1/meta/dicts/enable_status',
      retain: '保留SKU输入校验',
      compat: '不得把draft/archived的SPU选项发给SKU。',
      rules: [
        B(
          '^internal/modules/catalog/product\\.go$',
          'sku\\.Status.*"(?:active|disabled)"',
        ),
      ],
      anchors: [
        anchor('back', 'internal/modules/catalog/product.go', 'sku.Status !='),
      ],
    },
  );
  extra(
    'X004',
    '订单',
    'States.DisplayStatus / validDisplayStatus',
    [
      'pending_payment',
      'pending_shipment',
      'shipped',
      'completed',
      'closed',
      'refunding',
      'refunded',
      'unknown',
    ],
    {
      decision: display,
      dict: 'order_display_status',
      priority: 'P0',
      reason:
        '现有order_status种子混淆事实维度和接口显示；新增八值只读展示字典。',
      api: 'GET /api/v1/meta/dicts/order_display_status',
      retain: '保留DisplayStatus及validDisplayStatus',
      compat:
        'paid→pending_shipment、cancelled→closed仅在显示投影处理；不更新数据库事实状态或外部协议。旧字典保留。',
      rules: [
        B(
          '^internal/modules/order/query\\.go$',
          '"(?:pending_payment|pending_shipment|shipped|completed|closed|refunding|refunded|unknown)"',
        ),
        B(
          '^internal/modules/order/status\\.go$',
          '"(?:pending_shipment|closed|refunding|refunded|pending_payment|shipped|completed|unknown)"',
          'DisplayStatus\\(\\)',
        ),
      ],
      anchors: [
        anchor(
          'back',
          'internal/modules/order/status.go',
          'DisplayStatus\\(\\)',
        ),
        anchor(
          'back',
          'internal/modules/order/query.go',
          'func validDisplayStatus',
        ),
        anchor(
          'back',
          'migrations/000026_system_dict_seed.up.sql',
          "'order_status','已付款'",
        ),
      ],
    },
  );
  extra(
    'X005',
    '客户、报价与分享',
    'CustomerInput.Source / normalizeCustomer',
    ['manual'],
    {
      decision: business,
      dict: 'customer_source',
      priority: 'P2',
      reason:
        '当前只有manual默认值而非闭合枚举；可作为可维护获客来源，但须先确认实际历史值。',
      api: 'GET /api/v1/meta/dicts/customer_source（渐进启用）',
      retain: '不需要固定枚举；保留长度/租户校验',
      compat:
        '先收集租户历史自由文本并补词条，未知旧值可读可保留；不得立即收紧为仅manual。',
      rules: [
        B(
          '^internal/modules/share/validation\\.go$',
          'in.Source|"manual"',
          '^func normalizeCustomer',
        ),
        B(
          '^internal/modules/share/types\\.go$',
          'Source',
          '^type CustomerInput',
        ),
      ],
      anchors: [
        anchor('back', 'internal/modules/share/validation.go', 'in.Source =='),
        anchor('back', 'internal/modules/share/types.go', 'Source'),
      ],
    },
  );
  extra(
    'X006',
    '客户、报价与分享',
    'pricing.Basis / Result.LayerName',
    [
      'customer_quote',
      'customer_price_list',
      'default_price_list',
      'original',
      'unpriced',
    ],
    {
      decision: display,
      dict: 'price_basis',
      priority: 'P2',
      reason:
        '后端同时返回英文Basis和中文LayerName，适合管理端统一显示；价格优先级不能取字典sort。',
      api: '管理预览可走meta；公开H5不强依赖需登录接口',
      retain: '保留Basis常量与Resolve优先级',
      compat:
        '冻结快照已有中文文案不重写；匿名分享使用快照显示或独立公开投影。',
      rules: [
        B(
          '^internal/modules/share/pricing/',
          '\\b(?:CustomerQuote|CustomerList|DefaultList|Original|Unpriced)\\b|LayerName',
        ),
      ],
      anchors: [
        anchor('back', 'internal/modules/share/pricing/types.go', 'type Basis'),
        anchor('back', 'internal/modules/share/pricing/resolve.go', 'name :='),
      ],
    },
  );
  extra(
    'X007',
    '通知',
    'NotificationKind / providers / allowed',
    [
      'smtp',
      'aliyun_dm',
      'sendgrid',
      'aliyun_sms',
      'wecom_bot',
      'dingtalk_bot',
      'http',
    ],
    {
      reason:
        '供应商种类决定配置schema、密钥字段、传输驱动及channel-kind组合。保留专用能力注册表；可用能力接口提供名称，不允许字典新增驱动。',
      rules: [
        F('^apps/admin/src/', '\\bNotificationKind\\b|\\bproviders\\b'),
        direct(
          'front',
          '^apps/admin/src/views/system/notification/provider-fields\\.ts$',
          [
            'smtp',
            'aliyun_dm',
            'sendgrid',
            'aliyun_sms',
            'wecom_bot',
            'dingtalk_bot',
            'http',
          ],
        ),
        B('^internal/kernel/notifier/channel/config\\.go$', 'allowed :='),
      ],
      anchors: [
        anchor(
          'front',
          'apps/admin/src/views/system/notification/provider-fields.ts',
          'export const',
        ),
        anchor(
          'back',
          'internal/kernel/notifier/channel/config.go',
          'allowed :=',
        ),
      ],
    },
  );
  extra(
    'X008',
    '通知',
    'notifier.Message.Severity',
    ['info', 'warning', 'critical'],
    {
      decision: display,
      dict: 'business_alert_severity',
      priority: 'P2',
      reason: '这是业务维护告警而非技术日志级别，可与漂移告警共用展示文案。',
      api: 'GET /api/v1/meta/dicts/business_alert_severity',
      retain: '保留Validate及告警触发阈值',
      compat: '通知快照/外发内容保持原有字段；字典缺项回退原码。',
      rules: [
        B('^internal/kernel/notifier/notifier\\.go$', '"info"'),
        B(
          '^internal/bootstrap/credential_notification_observe\\.go$',
          '"(?:info|warning|critical)"',
        ),
      ],
      anchors: [
        anchor(
          'back',
          'internal/kernel/notifier/notifier.go',
          'switch m.Severity',
        ),
      ],
    },
  );
  extra(
    'X009',
    '同步、映射与重放',
    'unknown_value_policy',
    ['reject', 'keep_raw', 'fallback_null'],
    {
      reason:
        '这是已注册系统配置的固定策略枚举，代码实现策略能力，继续走/settings schema而非再建可编辑字典。',
      rules: [
        B('^internal/kernel/setting/defaults\\.go$', 'unknown_value_policy'),
      ],
      anchors: [
        anchor(
          'back',
          'internal/kernel/setting/defaults.go',
          'unknown_value_policy',
        ),
      ],
    },
  );
  extra(
    'X010',
    '同步、映射与重放',
    'connector.ResourceType / ingestion.ResourceType',
    ['product', 'order', 'inventory', 'category'],
    {
      reason:
        '资源码决定连接器和upserter接口；新增字典项不会产生处理器。由代码能力注册表发布。',
      rules: [
        B(
          '^internal/modules/(connector|ingestion)/',
          '\\bResource(?:Type|Product|Order|Inventory|Category)\\b',
        ),
      ],
      anchors: [
        anchor(
          'back',
          'internal/modules/connector/types.go',
          'type ResourceType',
        ),
        anchor(
          'back',
          'internal/modules/ingestion/mapping_types.go',
          'type ResourceType',
        ),
      ],
    },
  );
  extra(
    'X011',
    '同步、映射与重放',
    'ReplayScope.Type',
    ['time', 'ids', 'quarantine'],
    {
      reason:
        '重放选择器是固定请求协议，每种值有不同必填字段，不能通过字典扩展。',
      rules: [
        B(
          '^internal/modules/sync/replay(?:_http)?\\.go$',
          '"(?:time|ids|quarantine)"',
        ),
      ],
      anchors: [
        anchor(
          'back',
          'internal/modules/sync/replay_types.go',
          'type ReplayScope',
        ),
      ],
    },
  );
  extra(
    'X012',
    '同步、映射与重放',
    'connector.ErrKind',
    ['auth_expired', 'rate_limited', 'unavailable', 'invalid_request'],
    {
      reason: '平台错误归类驱动鉴权恢复与重试，属于底层技术常量。',
      rules: [
        B(
          '^internal/modules/connector/',
          '\\bErr(?:Kind|AuthExpired|RateLimited|Unavailable|InvalidRequest)\\b',
        ),
      ],
      anchors: [
        anchor('back', 'internal/modules/connector/errs.go', 'type ErrKind'),
      ],
    },
  );
  extra('X013', '通知', 'SMTP tls_mode', ['starttls', 'tls', 'plain'], {
    reason: '传输加密协议、安全校验固定，不是运营分类。',
    rules: [
      direct(
        'front',
        '^apps/admin/src/views/system/notification/provider-form\\.vue$',
        ['starttls', 'tls', 'plain'],
      ),
      B(
        '^internal/kernel/notifier/channel/smtp\\.go$',
        '"(?:starttls|tls|plain)"',
      ),
    ],
    anchors: [
      anchor(
        'front',
        'apps/admin/src/views/system/notification/provider-form.vue',
        "value: 'starttls'",
      ),
    ],
  });
  extra('X014', '计费与账务', 'billing.Currency', ['CNY'], {
    reason: '当前计费单币种人民币是资金契约，新增字典币种无法实现多币种账本。',
    rules: [B('^internal/modules/billing/', '"CNY"')],
    anchors: [anchor('back', 'internal/modules/billing/types.go', 'CNY')],
  });
  extra(
    'X015',
    '客户、报价与分享',
    'pricing.Result.Precision',
    ['spu', 'sku'],
    {
      reason: 'SPU/SKU是商品模型和价格匹配精度，不允许业务变更。',
      rules: [
        B('^internal/modules/share/pricing/resolve\\.go$', '"(?:spu|sku)"'),
      ],
      anchors: [
        anchor(
          'back',
          'internal/modules/share/pricing/resolve.go',
          'matches, precision',
        ),
      ],
    },
  );
  extra(
    'X016',
    '客户、报价与分享',
    'pricing.Result.Reason',
    ['matched', 'no_eligible_price'],
    {
      reason: '价格解析器的固定诊断结果，无运营可扩展语义；可代码内集中翻译。',
      rules: [
        B(
          '^internal/modules/share/pricing/resolve\\.go$',
          '"(?:matched|no_eligible_price)"',
        ),
      ],
      anchors: [
        anchor(
          'back',
          'internal/modules/share/pricing/resolve.go',
          'no_eligible_price',
        ),
      ],
    },
  );
  const replacements = {
    '^internal/modules/shop/credential\\.go$':
      '^internal/modules/shop/(credentials|credential_writes)\\.go$',
    '^internal/modules/ingestion/mapping_service\\.go$':
      '^internal/bootstrap/mapping_publish\\.go$',
    '^internal/modules/order/items\\.go$':
      '^internal/modules/order/(validation|persist)\\.go$',
    '^internal/modules/order/vanished\\.go$':
      '^internal/modules/order/visibility\\.go$',
    '^internal/modules/order/service\\.go$':
      '^internal/modules/order/disposition\\.go$',
    '^internal/modules/shop/refresh/(service|refresh|run|finish)\\.go$':
      '^internal/modules/shop/refresh/(executor|result|recovery)\\.go$',
  };
  for (const item of items)
    for (const rule of item.rules)
      if (replacements[rule.files]) rule.files = replacements[rule.files];
  byKey.get('listing.status').rules[0] = F(
    '^apps/admin/src/views/catalog/product/detail\\.vue$',
    "dataIndex: 'status'",
    '^const listingColumns',
  );
  byKey.get('order_item.refund_status').rules[0].match = 'RefundStatus';
  byKey.get('entitlement.kind').labels.paid = '付费';
  byKey.get('entitlement.kind').labels.free = '免费';
  byKey.get('share_link.mode').labels.snapshot = '快照';
  byKey
    .get('audit_log.actor_type')
    .rules.push(
      F(
        '^apps/admin/src/views/system/audit-log/index\\.vue$',
        '\\bactorTypes\\b|user:|system:|api_client:',
      ),
    );
  byKey
    .get('audit_log.actor_type')
    .rules.push(F('^apps/admin/src/api/model/audit\\.ts$', 'actor_type:'));
  byKey
    .get('export_job.status')
    .rules.push(
      F(
        '^apps/admin/src/views/catalog/product/use-product-export\\.ts$',
        'data\\.status',
      ),
    );
  byKey
    .get('export_job.status')
    .rules.push(
      F(
        '^apps/admin/src/api/model/catalog\\.ts$',
        '\\bstatus:',
        '^export interface ProductExport',
      ),
    );
  byKey
    .get('notification.status')
    .rules.push(
      F(
        '^apps/admin/src/api/model/notification\\.ts$',
        '\\bstatus:',
        '^export interface NotificationInbox',
      ),
    );
  byKey.get('order_status_history.event_kind').labels.snapshot = '快照观察';
  items.find((i) => i.id === 'X002').labels = {
    ...labels,
    active: '有效',
    expired: '已过期',
    revoked: '已撤销',
    used: '已使用',
  };
  items.find((i) => i.id === 'X005').labels = { ...labels, manual: '人工录入' };
  byKey.get('product_spu.status').rules = byKey
    .get('product_spu.status')
    .rules.filter((r) => r.side !== 'back');
  byKey
    .get('product_spu.status')
    .rules.push(
      B(
        '^internal/modules/catalog/product\\.go$',
        '"(?:draft|active|archived)"',
        '^func validProductStatus',
      ),
      B(
        '^internal/modules/catalog/product\\.go$',
        '"active"',
        '^func productStatus',
      ),
    );
  for (const key of ['sys_user.status', 'sys_menu.status'])
    byKey
      .get(key)
      .rules.push(
        B(
          '^internal/modules/identity/admin_(users|menus)\\.go$',
          'Status.*oneof=active disabled',
        ),
      );
  items
    .find((i) => i.id === 'X001')
    .rules.push(
      B(
        '^internal/modules/identity/admin_(roles|depts)\\.go$',
        'Status.*oneof=active disabled',
      ),
    );
  byKey
    .get('notify_delivery.channel')
    .rules.push(
      B(
        '^internal/kernel/notifier/channel/model\\.go$',
        '\\bChannel\\b',
        '^type Delivery struct',
      ),
    );
  byKey
    .get('notification_preference.channel')
    .rules.push(
      B(
        '^internal/kernel/notifier/inbox\\.go$',
        '\\bChannel\\b',
        '^type Preference struct',
      ),
    );
  byKey
    .get('notification_preference.channel')
    .rules.push(
      F(
        '^apps/admin/src/views/system/notification/preferences\\.vue$',
        '\\bnotificationChannels\\b',
      ),
    );
  byKey.get('notification.status').priority = 'P2';
  extra(
    'X017',
    '通知',
    'NotificationProvider.enabled / NotificationTemplate.enabled',
    ['true', 'false'],
    {
      decision: display,
      dict: 'boolean_enable_status',
      priority: 'P1',
      labels: { true: '启用', false: '停用' },
      reason:
        '服务商和模板列表重复硬编码启停文案；仅统一展示，不把布尔值改为active/disabled。',
      api: '可选GET /api/v1/meta/dicts/boolean_enable_status；仅两处时可用共享翻译而不新增请求',
      retain: '保留boolean类型和启停检查',
      compat:
        '接口继续传JSON布尔值；查标签时转为字符串；不和active/disabled字典混发。',
      rules: [
        F(
          '^apps/admin/src/views/system/notification/(providers|templates)\\.vue$',
          'record\\.enabled',
        ),
        B('^internal/kernel/notifier/channel/model\\.go$', 'Enabled.*bool'),
      ],
      anchors: [
        anchor(
          'front',
          'apps/admin/src/views/system/notification/providers.vue',
          "record.enabled \\? '启用'",
        ),
        anchor(
          'back',
          'internal/kernel/notifier/channel/model.go',
          'Enabled.*bool',
        ),
      ],
    },
  );
  extra(
    'X018',
    '通知',
    'notifier.Message.Template（凭据告警固定标签码）',
    [
      'credential.expiring.3d',
      'credential.expiring.1d',
      'credential.expired',
      'credential.needs_reauth',
      'credential.unknown',
      'credential.failed',
      'credential.stuck',
      'credential.recovered',
      'credential.protocol_pending',
    ],
    {
      labels: {
        'credential.expiring.3d': '凭据将在3天内到期',
        'credential.expiring.1d': '凭据将在1天内到期',
        'credential.expired': '凭据已到期',
        'credential.needs_reauth': '凭据需重新授权',
        'credential.unknown': '凭据状态未知',
        'credential.failed': '凭据刷新失败',
        'credential.stuck': '凭据刷新卡住',
        'credential.recovered': '凭据恢复',
        'credential.protocol_pending': '凭据刷新协议待处理',
      },
      reason:
        '标签码绑定告警生成、去重、恢复和专用模板；正文由模板接口维护，不能让字典新增事件或改码。',
      rules: [
        B(
          '^internal/(kernel/notifier/notifier|bootstrap/credential_notification_(observe|recovery|store))\\.go$',
          'credential\\.(?:expiring|expired|needs_reauth|unknown|failed|stuck|recovered|protocol_pending)',
        ),
      ],
      anchors: [
        anchor(
          'back',
          'internal/kernel/notifier/notifier.go',
          'switch m.Template',
        ),
      ],
    },
  );
  extra(
    'X019',
    '订单',
    'Correction.Kind / correctionProved',
    [
      'payment_reversal',
      'refund_reversal',
      'fulfillment_correction',
      'lifecycle_reopen',
      'mapping_correction',
    ],
    {
      labels: {
        payment_reversal: '付款冲正',
        refund_reversal: '退款冲正',
        fulfillment_correction: '履约纠正',
        lifecycle_reopen: '订单重开',
        mapping_correction: '映射纠正',
      },
      reason:
        '纠正类型参与证明校验和回退授权，属于不可由运营扩展的固定协议；展示名称可在代码内集中。',
      rules: [
        B(
          '^internal/modules/order/validation\\.go$',
          '"(?:payment_reversal|refund_reversal|fulfillment_correction|lifecycle_reopen|mapping_correction)"',
        ),
      ],
      anchors: [
        anchor(
          'back',
          'internal/modules/order/validation.go',
          'func correctionProved',
        ),
      ],
    },
  );
  // SQL literals embedded in production Go use single quotes as well as Go double quotes.
  for (const item of items)
    for (const rule of item.rules)
      if (rule.side === 'back') {
        rule.match = rule.match.replace(
          /"\(\?:([^"\n]+)\)"/g,
          '["\'](?:$1)["\']',
        );
      }
  // A dictionary consumer key is a unique, auditable direct reference in any production front-end source.
  for (const item of items.filter((i) => i.dict))
    item.rules.push(
      F('^apps/admin/src/', `useMetaDictionary\\(\x27${item.dict}\x27\\)`),
    );
  return {
    items,
    method:
      '引用次数=人工限定文件/函数内直接码值或命名枚举/选项符号的非注释生产源码匹配行数，同组同文件同行去重，含声明。不统计运行调用，不是完整数据流。SQL历史约束/OpenAPI/文档/测试不并入引用次数；SQL定义单独保留。0表示规则下无直接命中，不代表未使用。',
  };
};
