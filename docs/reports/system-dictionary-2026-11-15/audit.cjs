/* Read-only source analysis. Output is restricted to this report directory. */
'use strict';
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const roots = { front: 'D:/code/admin-web', back: 'D:/code/go-admin-api' };
const out = __dirname;
const normalize = (p) => p.replaceAll('\\', '/');
const read = (side, p) => fs.readFileSync(path.join(roots[side], p), 'utf8');
const list = (side, args) =>
  cp
    .execFileSync('rg', ['--files', ...args], {
      cwd: roots[side],
      encoding: 'utf8',
    })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(normalize)
    .sort();
const sources = {};
for (const side of ['front', 'back']) {
  const paths =
    side === 'front'
      ? list(side, [
          'apps/admin/src',
          'packages',
          'internal',
          '-g',
          '*.ts',
          '-g',
          '*.vue',
          '-g',
          '*.js',
        ])
      : list(side, ['internal', 'cmd', '-g', '*.go']);
  sources[side] = paths
    .filter(
      (p) =>
        !/(?:^|\/)(?:__tests__|test|testenv|testdata|mock|mocks)(?:\/|$)|(?:\.test\.|\.spec\.|_test\.go$)/.test(
          p,
        ),
    )
    .map((p) => ({ path: p, lines: read(side, p).split(/\r?\n/) }));
}
const schemas = new Map();
for (const p of list('back', ['migrations', '-g', '*.up.sql'])) {
  const text = read('back', p);
  for (const match of text.matchAll(
    /CHECK\s*\(\s*(\w+)\s+IN\s*\(([^)]+)\)/gi,
  )) {
    const values = [...match[2].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    if (!values.length) continue;
    const before = text.slice(0, match.index);
    const tables = [
      ...before.matchAll(
        /(?:CREATE TABLE(?: IF NOT EXISTS)?|ALTER TABLE)\s+(\w+)/gi,
      ),
    ];
    if (!tables.length) continue;
    const field = match[1];
    const table = tables.at(-1)[1];
    const key = `${table}.${field}`;
    const anchor = {
      side: 'back',
      path: p,
      line: before.split(/\r?\n/).length,
      text: match[0],
      values,
    };
    const old = schemas.get(key);
    if (!old)
      schemas.set(key, { key, table, field, values, definitions: [anchor] });
    else {
      old.definitions.push(anchor);
      // A later financial invariant may mention only a subset of an existing domain.
      if (!values.every((v) => old.values.includes(v))) old.values = values;
    }
  }
}
// 000015 explicitly replaces the credential status constraint and removes expired.
schemas.get('shop_credential.status').values = [
  'active',
  'expiring',
  'refreshing',
  'needs_reauth',
  'disabled',
];
const config = require('./curation.cjs')(schemas);
const missing = config.items.flatMap((item) =>
  (item.rules || [])
    .filter(
      (rule) =>
        !sources[rule.side].some((p) => new RegExp(rule.files).test(p.path)),
    )
    .map((rule) => ({
      id: item.id,
      field: item.field,
      side: rule.side,
      files: rule.files,
    })),
);
if (missing.length)
  throw new Error('Invalid file rules: ' + JSON.stringify(missing, null, 2));
const candidates = [];
const refs = [];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function scopeLines(source, scope) {
  if (!scope) return source.lines.map((text, i) => ({ line: i + 1, text }));
  const start = source.lines.findIndex((line) => new RegExp(scope).test(line));
  if (start < 0) throw new Error(`Missing scope ${source.path}: ${scope}`);
  let end = start + 1;
  while (
    end < source.lines.length &&
    !/^(?:func |type |var |const |export (?:const|type|interface|function) )/.test(
      source.lines[end],
    )
  )
    end++;
  return source.lines
    .slice(start, end)
    .map((text, i) => ({ line: start + i + 1, text }));
}
for (const item of config.items) {
  const schema = item.schema && schemas.get(item.schema);
  if (item.schema && !schema) throw new Error(`Missing schema ${item.schema}`);
  const values = item.values || schema.values;
  const def = schema ? schema.definitions : [];
  const row = {
    ...item,
    values,
    definitions: def,
    references: [],
    anchors: [],
  };
  for (const anchor of item.anchors || []) {
    const [side, p, pattern] = anchor;
    const lines = read(side, p).split(/\r?\n/);
    const i = lines.findIndex((line) => new RegExp(pattern).test(line));
    if (i < 0) throw new Error(`Missing anchor ${item.id}: ${p}: ${pattern}`);
    row.anchors.push({ side, path: p, line: i + 1, text: lines[i].trim() });
  }
  const seen = new Set();
  for (const rule of item.rules || []) {
    const files = sources[rule.side].filter((p) =>
      new RegExp(rule.files).test(p.path),
    );
    if (!files.length)
      throw new Error(`Rule matches no files ${item.id}: ${rule.files}`);
    const matcher = new RegExp(rule.match, rule.side === 'back' ? 'i' : '');
    for (const source of files)
      for (const line of scopeLines(source, rule.scope)) {
        if (
          /^\s*(?:\/\/|\/\*|\*|<!--)/.test(line.text) ||
          !matcher.test(line.text)
        )
          continue;
        const key = `${rule.side}:${source.path}:${line.line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const codes = values.filter(
          (v) =>
            v !== '' &&
            new RegExp(`(?<![A-Za-z0-9_])${escape(v)}(?![A-Za-z0-9_])`).test(
              line.text,
            ),
        );
        const hit = {
          id: item.id,
          side: rule.side,
          path: source.path,
          line: line.line,
          codes,
          text: line.text.trim(),
          rule: rule.match,
          scope: rule.scope || 'file',
        };
        row.references.push(hit);
        refs.push(hit);
      }
  }
  row.counts = Object.fromEntries(
    ['front', 'back'].map((side) => [
      side,
      row.references.filter((r) => r.side === side).length,
    ]),
  );
  row.counts.total = row.counts.front + row.counts.back;
  row.code_counts = Object.fromEntries(
    values.map((value) => [
      value,
      Object.fromEntries(
        ['front', 'back'].map((side) => [
          side,
          row.references.filter(
            (r) => r.side === side && r.codes.includes(value),
          ).length,
        ]),
      ),
    ]),
  );
  row.count_rules = row.rules;
  delete row.rules;
  candidates.push(row);
}
const classified = new Set(config.items.map((i) => i.schema).filter(Boolean));
const unclassified = [...schemas.values()].filter(
  (s) => !classified.has(s.key),
);
if (unclassified.length)
  throw new Error(
    `Unclassified schema domains: ${unclassified.map((s) => s.key).join(', ')}`,
  );
const snapshot = {};
for (const side of ['front', 'back'])
  snapshot[side] = {
    root: roots[side],
    head: cp
      .execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: roots[side],
        encoding: 'utf8',
      })
      .trim(),
    files: sources[side].length,
    lines: sources[side].reduce((n, p) => n + p.lines.length, 0),
    sha256: crypto
      .createHash('sha256')
      .update(
        sources[side].map((p) => p.path + '\n' + p.lines.join('\n')).join('\n'),
      )
      .digest('hex'),
  };
const dataset = {
  date: '2026-11-15',
  roots,
  snapshot,
  method: config.method,
  candidates,
  schema_domains: schemas.size,
  references: refs.length,
};
const json = (value) => JSON.stringify(value, null, 2) + '\n';
fs.writeFileSync(path.join(out, 'evidence.json'), json(dataset));
fs.writeFileSync(
  path.join(out, 'schema-domains.json'),
  json([...schemas.values()]),
);
const csv = (rows) =>
  '\uFEFF' +
  rows
    .map((row) =>
      row
        .map((x) => '"' + String(x ?? '').replaceAll('"', '""') + '"')
        .join(','),
    )
    .join('\r\n') +
  '\r\n';
const location = (a) => `${roots[a.side]}/${a.path}:${a.line}`;
const evidenceAnchors = (c) => {
  const seen = new Set();
  return [
    ...c.anchors,
    ...['front', 'back'].flatMap((side) =>
      c.references.filter((r) => r.side === side).slice(0, 3),
    ),
    ...c.definitions.slice(-1),
  ].filter((a) => {
    const key = location(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const usedAt = (c) =>
  [
    ...new Set(
      [...c.references, ...c.anchors, ...c.definitions].map((r) =>
        r.side === 'front' ? '前端' : '后端',
      ),
    ),
  ].join(' / ');
fs.writeFileSync(
  path.join(out, 'inventory.csv'),
  csv([
    [
      'ID',
      '业务模块',
      '字段或枚举',
      '建议字典类型',
      '码值及含义',
      '使用位置',
      '前端引用行数',
      '后端引用行数',
      '总引用行数',
      '适用性',
      '理由',
      '保留代码枚举或校验',
      '字典接口',
      '兼容要求',
      '优先级',
      '证据文件',
    ],
    ...candidates.map((c) => [
      c.id,
      c.module,
      c.field,
      c.dict || '',
      c.values
        .map((v) => `${v === '' ? '(空串)' : v}=${c.labels[v] || '需业务确认'}`)
        .join('；'),
      usedAt(c),
      c.counts.front,
      c.counts.back,
      c.counts.total,
      c.decision,
      c.reason,
      c.retain || '保留',
      c.api || '不接入',
      c.compat,
      c.priority,
      evidenceAnchors(c).map(location).join('\n'),
    ]),
  ]),
);
fs.writeFileSync(
  path.join(out, 'code-values.csv'),
  csv([
    [
      'ID',
      '字段或枚举',
      '码值',
      '含义',
      '前端码值命中行数',
      '后端码值命中行数',
      '适用性',
    ],
    ...candidates.flatMap((c) =>
      c.values.map((v) => [
        c.id,
        c.field,
        v,
        c.labels[v] || '需业务确认',
        c.code_counts[v].front,
        c.code_counts[v].back,
        c.decision,
      ]),
    ),
  ]),
);
fs.writeFileSync(
  path.join(out, 'references.csv'),
  csv([
    [
      'ID',
      '使用端',
      '文件路径',
      '行号',
      '该行命中的码值',
      '源码',
      '匹配规则',
      '限定函数或类型',
    ],
    ...refs.map((r) => [
      r.id,
      r.side === 'front' ? '前端' : '后端',
      `${roots[r.side]}/${r.path}`,
      r.line,
      r.codes.join('|'),
      r.text,
      r.rule,
      r.scope,
    ]),
  ]),
);
const link = (a) =>
  `[${a.side === 'front' ? '前' : '后'} ${a.path}:${a.line}](${location(a)})`;
let inventory =
  '本文件由 audit.cjs 生成。统计口径、结论和迁移计划见 report.md；逐行证据见 references.csv。\n\n';
for (const module of [...new Set(candidates.map((c) => c.module))]) {
  inventory += `**${module}**\n\n`;
  inventory +=
    '| ID / 字段 | 码值 → 含义 | 引用行数 前 / 后 | 评估 / 优先级 | 文件与改造建议 |\n|---|---|---:|---|---|\n';
  for (const c of candidates.filter((c) => c.module === module)) {
    const anchors = evidenceAnchors(c);
    inventory += `| ${c.id} ${c.field} | ${c.values.map((v) => `${v === '' ? '(空串)' : v} → ${c.labels[v] || '需业务确认'}`).join('<br>')} | ${c.counts.front} / ${c.counts.back} | ${c.decision}<br>${c.priority} | ${anchors.map(link).join('<br>')}<br>${c.reason}<br>建议：${c.api || '不走字典接口'}；${c.retain || '保留代码枚举/校验'}；兼容：${c.compat} |\n`;
  }
  inventory += '\n';
}
fs.writeFileSync(path.join(out, 'inventory.md'), inventory);
const counts = {};
for (const c of candidates) counts[c.decision] = (counts[c.decision] || 0) + 1;
console.log(
  JSON.stringify(
    {
      snapshot,
      schema_domains: schemas.size,
      groups: candidates.length,
      code_values: candidates.reduce((n, c) => n + c.values.length, 0),
      reference_lines: refs.length,
      decisions: counts,
    },
    null,
    2,
  ),
);
