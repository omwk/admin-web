export function notificationFixture() {
  const channels = ['email', 'sms', 'wecom', 'dingtalk', 'webhook'];
  const state = {
    manage: true,
    nextId: 9100,
    testStatus: 'sent',
    testHttpFailure: false,
    preferencesWrites: [],
    retryCount: 0,
    inbox: Array.from({ length: 25 }, (_, index) => ({
      id: 9000 + index,
      channel: 'inbox',
      template: index % 2 ? 'credential.expiring' : 'notification.default',
      payload: {
        summary: '验收通知 ' + (index + 1),
        detail: '<script>window.sf2Unsafe=true</script>',
      },
      status: 'sent',
      attempts: 1,
      last_error: '',
      read_at: index < 23 ? null : new Date().toISOString(),
      created_at: new Date(Date.now() - index * 60000).toISOString(),
      credential_id: null,
    })),
    preferences: ['notification.default', 'credential.expiring'].flatMap(
      (template) =>
        channels.map((channel) => ({
          template,
          channel,
          enabled: channel === 'email',
          inherited: true,
        })),
    ),
    providers: [],
    deliveries: [],
    templates: [
      {
        id: 1,
        tenant_id: null,
        code: 'notification.default',
        locale: 'zh-CN',
        subject: '系统通知',
        body: '{{.Name}}，您有一条通知。',
        format: 'text',
        enabled: true,
      },
    ],
  };
  const menus = [
    {
      id: 8001,
      parent_id: 0,
      name: '通知中心',
      path: '/system/notifications',
      type: 'menu',
      component: 'system/notification/index',
      permission_code: 'system:notify:list',
      sort: 1,
      meta: {},
      is_external: false,
      keep_alive: false,
    },
    {
      id: 8002,
      parent_id: 0,
      name: '通知渠道',
      path: '/system/notifications/channels',
      type: 'menu',
      component: 'system/notification/channels',
      permission_code: 'system:notify:manage',
      sort: 2,
      meta: {},
      is_external: false,
      keep_alive: false,
    },
  ];
  const permissions = () => [
    'system:notify:list',
    ...(state.manage ? ['system:notify:manage'] : []),
  ];
  function page(rows, url) {
    const page = Number(url.searchParams.get('page') || 1);
    const size = Number(url.searchParams.get('page_size') || 20);
    return {
      list: rows.slice((page - 1) * size, page * size),
      total: rows.length,
      page,
      page_size: size,
    };
  }
  const providerConfig = (config) =>
    Object.fromEntries(
      Object.entries(config || {}).map(([key, value]) =>
        [
          'from_name',
          'region',
          'sign_name',
          'template_code',
          'tls_mode',
        ].includes(key)
          ? [key, value]
          : [key + '_configured', Boolean(value)],
      ),
    );
  async function install(context) {
    await context.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace('/api/v1', '');
      const method = request.method();
      const respond = (data, status = 200, message = 'ok', code = 0) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({
            code,
            data,
            message,
            trace_id: 'sf2-fixture',
          }),
        });
      if (path === '/auth/menus')
        return respond({ menus, permissions: permissions() });
      if (path === '/auth/me') {
        const response = await route.fetch();
        const body = await response.json();
        body.data.permissions = permissions();
        return route.fulfill({ response, json: body });
      }
      if (!path.startsWith('/admin/notifications')) return route.continue();
      if (
        !state.manage &&
        /providers|templates|deliveries\/\d+\/retry/.test(path)
      )
        return respond(null, 403, '无权执行此操作', 20107);
      const input = request.postDataJSON();
      if (path === '/admin/notifications/unread-count')
        return respond({
          count: state.inbox.filter((value) => !value.read_at).length,
        });
      if (path === '/admin/notifications/read-all') {
        let updated = 0;
        for (const value of state.inbox)
          if (!value.read_at) {
            value.read_at = new Date().toISOString();
            updated++;
          }
        return respond({ updated });
      }
      const readId = path.match(/\/notifications\/(\d+)\/read$/);
      if (readId) {
        state.inbox.find((value) => value.id === Number(readId[1])).read_at =
          new Date().toISOString();
        return respond({});
      }
      if (path === '/admin/notifications/preferences') {
        if (method === 'PUT') {
          state.preferencesWrites.push(input.preferences);
          for (const update of input.preferences)
            Object.assign(
              state.preferences.find(
                (value) =>
                  value.template === update.template &&
                  value.channel === update.channel,
              ),
              update,
              { inherited: false },
            );
        }
        return respond({ preferences: state.preferences });
      }
      if (path === '/admin/notifications')
        return respond(
          page(
            state.inbox.filter(
              (value) =>
                (!url.searchParams.has('unread') ||
                  Boolean(value.read_at) !==
                    (url.searchParams.get('unread') === 'true')) &&
                (!url.searchParams.get('template') ||
                  value.template === url.searchParams.get('template')),
            ),
            url,
          ),
        );
      if (path === '/admin/notifications/providers' && method === 'GET')
        return respond(page(state.providers, url));
      if (path === '/admin/notifications/providers' && method === 'POST') {
        const value = {
          ...input,
          id: state.nextId++,
          tenant_id: 1,
          config: providerConfig(input.config),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        state.providers.push(value);
        return respond(value, 201);
      }
      const testId = path.match(/\/providers\/(\d+)\/test$/);
      if (testId) {
        if (state.testHttpFailure)
          return respond(
            null,
            503,
            '后端测试发送失败：recipient_unavailable',
            10002,
          );
        const value = {
          id: state.nextId++,
          tenant_id: 1,
          channel: 'email',
          template_code: 'notification.test',
          recipient_hash: 'masked-hash',
          recipient_domain: 'example.invalid',
          provider_id: Number(testId[1]),
          status: 'pending',
          attempts: 0,
          last_error: '',
          created_at: new Date().toISOString(),
          sent_at: null,
          next_retry_at: null,
        };
        state.deliveries.unshift(value);
        return respond(value);
      }
      const providerId = path.match(/\/providers\/(\d+)$/);
      if (providerId) {
        const value = state.providers.find(
          (value) => value.id === Number(providerId[1]),
        );
        if (method === 'DELETE') {
          state.providers = state.providers.filter(
            (value) => value.id !== Number(providerId[1]),
          );
          return route.fulfill({ status: 204 });
        }
        Object.assign(value, {
          ...input,
          config: { ...value.config, ...providerConfig(input.config) },
        });
        return respond(value);
      }
      if (path === '/admin/notifications/templates')
        return respond(page(state.templates, url));
      if (path.startsWith('/admin/notifications/templates/')) {
        Object.assign(state.templates[0], input, { tenant_id: 1 });
        return respond(state.templates[0]);
      }
      const retryId = path.match(/\/deliveries\/(\d+)\/retry$/);
      if (retryId) {
        const value = state.deliveries.find(
          (value) => value.id === Number(retryId[1]),
        );
        value.status = 'pending';
        value.last_error = '';
        state.retryCount++;
        state.testStatus = 'sent';
        return respond(value);
      }
      if (path === '/admin/notifications/deliveries') {
        for (const value of state.deliveries)
          if (value.status === 'pending') {
            value.status = state.testStatus;
            value.attempts++;
            value.last_error =
              value.status === 'failed' ? 'provider_delivery_failed' : '';
            if (value.status === 'sent')
              value.sent_at = new Date().toISOString();
          }
        return respond(page(state.deliveries, url));
      }
      throw new Error(
        'Unhandled SF-2 fixture endpoint: ' + method + ' ' + path,
      );
    });
  }
  return { install, state };
}
