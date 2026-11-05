#!/usr/bin/env node
/**
 * 一次性迁移：把老配置组 `content` 的数据搬进现分组，然后删掉 `content` 组。
 *
 * 背景：`content` 是 3.21.0（2026-07-30）引入的老分组，后来字段被拆进
 * appearance / navigation / sidebar / pages / about / footer 各组。Halo 升级时
 * **不会清理 ConfigMap 里已删除的分组**，所以老站点的 `theme-nucma-config` 里
 * 还留着这组数据。主题模板目前靠 `theme.config.content?.<旧字段>` 回落兜底，
 * 跑完这个脚本、数据搬进新组之后，就能把模板里的回落删干净。
 *
 * 用法：
 *   node tools/migrate-theme-settings.mjs                       # 只看计划（默认）
 *   node tools/migrate-theme-settings.mjs --apply                # 执行迁移
 *   node tools/migrate-theme-settings.mjs --apply --base-url https://nucma.cn
 *
 * 认证：环境变量 HALO_BASE_URL + HALO_TOKEN（Halo 个人访问令牌），或命令行 --base-url/--token。
 *
 * 规则：
 *   - 新组已有该字段时**不覆盖**（站长在新界面改过的值优先）；
 *   - 整并的老分组（home → home_hero、globe → pages、error_page/auth_page → system_pages）
 *     搬完就删组；跨组字段搬家（FIELD_MOVES）只挪字段、保留组；
 *   - 首页文章区块的「分类栏非空」老数据会自动补成 display_style=columns；
 *   - 备份写到 .backup/theme-config-backup-<时间戳>.json（已 gitignore）；
 *   - 幂等：没有可搬的数据时直接退出。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_FILE = path.join(ROOT, 'tools', 'legacy-settings-map.mjs');

function parseArgs(argv) {
  const args = {
    apply: false,
    baseUrl: process.env.HALO_BASE_URL,
    token: process.env.HALO_TOKEN,
    user: process.env.HALO_USER,
    pass: process.env.HALO_PASS,
    backupDir: path.join(ROOT, '.backup'),
    prune: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--prune-unknown-groups') args.prune = true;
    else if (a === '--base-url') args.baseUrl = argv[++i];
    else if (a === '--token') args.token = argv[++i];
    else if (a === '--user') args.user = argv[++i];
    else if (a === '--pass') args.pass = argv[++i];
    else if (a === '--backup-dir') args.backupDir = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
  process.exit(0);
}
if (!args.baseUrl) {
  console.error('需要 --base-url（或设置环境变量 HALO_BASE_URL）');
  process.exit(1);
}
if (!args.token && !(args.user && args.pass)) {
  console.error('需要 --token（个人访问令牌）或 --user/--pass（管理员账号）');
  process.exit(1);
}

const { LEGACY_GROUP, LEGACY_FIELD_MAP, MERGED_GROUPS, FIELD_MOVES } = await import(`file://${MAP_FILE.replace(/\\/g, '/')}`);

const base = args.baseUrl.replace(/\/+$/, '');
const cookies = new Map();
const headers = {
  'Content-Type': 'application/json',
};
const CONFIGMAP = '/api/v1alpha1/configmaps/theme-nucma-config';

function cookieHeader() {
  return [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
}

function storeCookies(res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const i = pair.indexOf('=');
    if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

/** 管理员账号登录：Halo 的 /login 用 RSA 公钥加密密码。 */
async function login(user, pass) {
  const page = await fetch(`${base}/login`, { headers: { Cookie: cookieHeader() }, redirect: 'manual' });
  storeCookies(page);
  const html = await page.text();
  const token = /name="_csrf"[^>]*value="([^"]+)"/.exec(html)?.[1];
  const publicB64 = (/const publicKey = "([^"]+)"/.exec(html)?.[1] ?? '').replaceAll('\\/', '/');
  if (!token || !publicB64) throw new Error('登录页缺少 csrf 或公钥');
  const pem = `-----BEGIN PUBLIC KEY-----\n${publicB64.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
  const encrypted = crypto.publicEncrypt(
    { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(pass, 'utf8'),
  ).toString('base64');
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader() },
    body: new URLSearchParams({ _csrf: token, username: user, password: encrypted }),
    redirect: 'manual',
  });
  storeCookies(res);
  const location = res.headers.get('location') ?? '';
  if (res.status !== 302 || /error=/.test(location)) {
    throw new Error(`登录失败：${res.status} ${location}`);
  }
}

async function api(method, url, body) {
  const h = { ...headers, Cookie: cookieHeader() };
  if (args.token) h.Authorization = `Bearer ${args.token}`;
  const res = await fetch(base + url, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

if (!args.token) {
  try {
    await login(args.user, args.pass);
    console.log(`已登录 ${args.user}@${base}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

const current = await api('GET', CONFIGMAP);
if (current.status !== 200) {
  console.error('读取配置失败：', current.status, JSON.stringify(current.json).slice(0, 200));
  process.exit(1);
}

const data = { ...(current.json?.data ?? {}) };

/** 当前 settings.yaml 声明的分组。 */
function declaredGroups() {
  const file = path.join(ROOT, 'theme-nucma', 'settings.yaml');
  const text = fs.readFileSync(file, 'utf8');
  return new Set([...text.matchAll(/^\s{4}- group:\s*(\S+)/gm)].map((m) => m[1]));
}

/** 模板里仍在读取的分组（含老配置组 content）。 */
function groupsUsedByTemplates() {
  const dir = path.join(ROOT, 'theme-nucma', 'templates');
  const used = new Set();
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.html')) {
        const text = fs.readFileSync(p, 'utf8');
        for (const m of text.matchAll(/theme\.config\.([a-z_]+)/g)) used.add(m[1]);
      }
    }
  };
  walk(dir);
  return used;
}

const declared = declaredGroups();
const used = groupsUsedByTemplates();

// 有消费者的老组：content（迁移后即可删）；其它组若模板还在读，不能动。
const legacyGroups = Object.keys(data).filter((g) => !declared.has(g) && used.has(g));
// 僵尸组：模板已不读、settings 也不再声明 —— 纯冗余，可清理。
const staleGroups = args.prune
  ? Object.keys(data).filter((g) => !declared.has(g) && !used.has(g))
  : [];

// 还能整并的老分组（如 home → home_hero）：配置里残留就要处理，别被 content 判断挡住
const mergeSourcesLeft = (MERGED_GROUPS ?? [])
  .map((m) => m.from)
  .filter((g) => Object.prototype.hasOwnProperty.call(data, g));

// 字段还在老组里没搬家（如 home_hero.section_blocks → home_sections）
const fieldMovesLeft = (FIELD_MOVES ?? []).filter((m) => {
  try {
    const src = JSON.parse(data[m.from] ?? '{}');
    return Object.prototype.hasOwnProperty.call(src, m.field);
  } catch {
    return false;
  }
});

if (!data[LEGACY_GROUP] && !staleGroups.length && !mergeSourcesLeft.length && !fieldMovesLeft.length) {
  console.log('配置里没有 content 老分组、没有可整并的老分组、没有待搬字段，也没有可清理的僵尸分组，无需迁移。');
  process.exit(0);
}

let legacy = {};
if (data[LEGACY_GROUP]) {
  try {
    legacy = JSON.parse(data[LEGACY_GROUP]);
  } catch (e) {
    console.error('content 分组不是合法 JSON，需人工处理：', e.message);
    process.exit(1);
  }
}

// 新组容器（解析失败的原样保留，避免写回时把不可解析的数据抹成空对象）
const groups = {};
const rawGroups = {};
for (const [name, raw] of Object.entries(data)) {
  if (name === LEGACY_GROUP) continue;
  rawGroups[name] = raw;
  try { groups[name] = raw ? JSON.parse(raw) : {}; } catch { groups[name] = null; }
}

const plan = [];
for (const [legacyField, target] of Object.entries(LEGACY_FIELD_MAP)) {
  if (!(legacyField in legacy)) continue;
  const oldValue = legacy[legacyField];
  if (oldValue === undefined || oldValue === null) continue;
  if (groups[target.group] === null) {
    plan.push({ legacyField, target, oldValue, action: 'skip', reason: '目标组数据不是合法 JSON，未改动' });
    continue;
  }
  const bucket = groups[target.group] ?? (groups[target.group] = {});
  if (target.field in bucket && bucket[target.field] !== undefined && bucket[target.field] !== null) {
    plan.push({ legacyField, target, oldValue, action: 'skip', reason: '新组已有值，保留新值' });
    continue;
  }
  bucket[target.field] = oldValue;
  plan.push({ legacyField, target, oldValue, action: 'move' });
}

// ---- 整组合并（home → home_hero 等）----
const mergePlan = [];
const mergedFrom = [];
for (const merge of MERGED_GROUPS ?? []) {
  const src = groups[merge.from];
  if (!src || groups[merge.from] === null) continue;
  const dst = groups[merge.to] ?? (groups[merge.to] = {});
  mergedFrom.push(merge.from);

  // 1) 用旧开关推出新 layout（只在目标没有显式 layout 时推）
  const lf = merge.layoutFrom;
  if (lf && (dst.layout === undefined || dst.layout === null)) {
    let nextLayout = null;
    if (src[lf.enabledField] === false) {
      const style = src[lf.styleField] && typeof src[lf.styleField] === 'string' ? src[lf.styleField] : lf.fallback;
      nextLayout = `${lf.legacyPrefix}${style}`;
    } else if (src[lf.showField] === false) {
      nextLayout = lf.noneValue;
    }
    if (nextLayout) {
      dst.layout = nextLayout;
      mergePlan.push(`layout 由 ${merge.from}.${lf.enabledField}/${lf.showField} 推出 = ${nextLayout}`);
    }
  }

  // 2) 同名字段搬运（不覆盖目标已有值）；moveAll 表示源组整组同名搬过去
  const moveFields = merge.moveAll ? Object.keys(src) : (merge.move ?? []);
  for (const f of moveFields) {
    if (!(f in src) || src[f] === undefined || src[f] === null) continue;
    const empty = merge.preferSource || dst[f] === undefined || dst[f] === null
      || (typeof dst[f] === 'string' && dst[f] === '')
      || (Array.isArray(dst[f]) && dst[f].length === 0);
    if (!empty) { mergePlan.push(`跳过 ${merge.from}.${f}（${merge.to} 已有值）`); continue; }
    dst[f] = src[f];
    mergePlan.push(`${merge.from}.${f} → ${merge.to}.${f}`);
  }

  // 3) 改名搬运（只补空位）
  for (const [from, to] of Object.entries(merge.alias ?? {})) {
    if (!(from in src) || src[from] === undefined || src[from] === null || src[from] === '') continue;
    if (!merge.preferSource && dst[to] !== undefined && dst[to] !== null && dst[to] !== '') {
      mergePlan.push(`跳过 ${merge.from}.${from}（${merge.to}.${to} 已有值）`);
      continue;
    }
    dst[to] = src[from];
    mergePlan.push(`${merge.from}.${from} → ${merge.to}.${to}`);
  }

  // 4) 组内剩余字段：能对上目标同名字段的已搬完，其余丢弃并记录
  const consumed = new Set([...moveFields, ...Object.keys(merge.alias ?? {}), ...(merge.drop ?? [])]);
  const leftover = Object.keys(src).filter((k) => !consumed.has(k));
  if (leftover.length) mergePlan.push(`注意：${merge.from} 组还有未处理字段，将随该组一起删除：${leftover.join(', ')}`);
  if (merge.drop?.length) mergePlan.push(`丢弃已被 layout 取代的字段：${merge.drop.join(', ')}`);
}

// ---- 跨组字段搬家（组保留，只挪字段）----
for (const move of FIELD_MOVES ?? []) {
  const src = groups[move.from];
  if (!src || groups[move.from] === null) continue;
  if (!(move.field in src) || src[move.field] === undefined || src[move.field] === null) continue;
  const dst = groups[move.to] ?? (groups[move.to] = {});
  const target = move.toField ?? move.field;
  const empty = move.preferSource || dst[target] === undefined || dst[target] === null
    || (typeof dst[target] === 'string' && dst[target] === '')
    || (Array.isArray(dst[target]) && dst[target].length === 0);
  if (!empty) {
    mergePlan.push(`跳过 ${move.from}.${move.field}（${move.to}.${target} 已有值，源字段保留）`);
    continue;
  }
  dst[target] = src[move.field];
  delete src[move.field];
  mergePlan.push(`${move.from}.${move.field} → ${move.to}.${target}`);
}

// ---- 数据形状迁移：分类栏从「第二通道」收进 display_style ----
// 老版本里只要「分类栏内容」非空，前台就一律按分类分栏渲染，display_style 被忽略；
// 现在分栏是 display_style 的第三个选项，所以这类区块要显式改成 columns，
// 否则升级后会突然从分栏变回卡片网格（看起来像「分栏设置丢了」）。
const stylePlan = [];
const homeSectionsData = groups.home_sections;
if (homeSectionsData && Array.isArray(homeSectionsData.section_blocks)) {
  for (const block of homeSectionsData.section_blocks) {
    if (block?.type !== 'news') continue;
    const hasColumns = Array.isArray(block.category_blocks) && block.category_blocks.length > 0;
    if (!hasColumns) continue;
    if (block.display_style === 'columns') continue;
    block.display_style = 'columns';
    stylePlan.push(`首页「${block.title || '文章内容'}」区块：分类栏非空 → 显示样式改为 columns`);
  }
}

if (Object.keys(legacy).length) {
  console.log(`content 老分组有 ${Object.keys(legacy).length} 个字段，映射命中 ${plan.length} 条：`);
  for (const item of plan) {
    const preview = typeof item.oldValue === 'string' ? item.oldValue.slice(0, 40) : JSON.stringify(item.oldValue).slice(0, 40);
    console.log(`  [${item.action}] content.${item.legacyField} → ${item.target.group}.${item.target.field} = ${preview}${item.reason ? '（' + item.reason + '）' : ''}`);
  }
}
const unmapped = Object.keys(legacy).filter((k) => !(k in LEGACY_FIELD_MAP));
if (unmapped.length) {
  console.log(`  未在映射表里的字段（保留在 content，不迁移）：${unmapped.join(', ')}`);
}

if (mergePlan.length) {
  console.log(`\n分组整并与字段搬家（${mergedFrom.join(', ') || '无整并'} → 目标组）：`);
  for (const line of mergePlan) console.log(`  ${line}`);
}
if (stylePlan.length) {
  console.log('\n显示样式迁移：');
  for (const line of stylePlan) console.log(`  ${line}`);
}
if (staleGroups.length) {
  console.log(`\n将清理僵尸分组（模板不再读取、settings.yaml 也不再声明）：${staleGroups.join(', ')}`);
}
const otherLegacy = legacyGroups.filter((g) => g !== LEGACY_GROUP);
if (otherLegacy.length) {
  console.log(`以下分组模板仍在读取，本次不动：${otherLegacy.join(', ')}`);
}

if (!args.apply) {
  console.log('\n当前是 dry-run，加 --apply 才会真正写入。');
  process.exit(0);
}

// 备份
fs.mkdirSync(args.backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(args.backupDir, `theme-config-backup-${stamp}.json`);
fs.writeFileSync(backupFile, JSON.stringify(current.json, null, 2), 'utf8');
console.log(`\n已备份原配置：${backupFile}`);

// 写回：新组用合并后的值，content 分组删除
const nextData = {};
for (const [name, raw] of Object.entries(data)) {
  if (name === LEGACY_GROUP) continue;
  if (mergedFrom.includes(name)) continue;
  if (staleGroups.includes(name)) continue;
  nextData[name] = groups[name] === null ? rawGroups[name] : JSON.stringify(groups[name] ?? {});
}
const saved = await api('PUT', CONFIGMAP, { ...current.json, data: nextData });
if (saved.status !== 200) {
  console.error('写回失败：', saved.status, JSON.stringify(saved.json).slice(0, 200));
  console.error('可用备份文件手动恢复：', backupFile);
  process.exit(1);
}
const doneParts = [];
if (data[LEGACY_GROUP]) doneParts.push('已删除 content 分组');
if (mergedFrom.length) doneParts.push(`已整并 ${mergedFrom.join(', ')} → 目标组`);
if (stylePlan.length) doneParts.push(`已迁移 ${stylePlan.length} 个区块的显示样式`);
doneParts.push(`${plan.filter((p) => p.action === 'move').length} 个字段搬进新组`);
doneParts.push(`${plan.filter((p) => p.action === 'skip').length} 个保留新组已有值`);
console.log(`迁移完成：${doneParts.join('，')}。`);
if (staleGroups.length) {
  console.log(`已清理僵尸分组（模板不再读取、settings.yaml 也不再声明）：${staleGroups.join(', ')}`);
}
if (legacyGroups.length) {
  console.log(`注意：这些分组模板仍在读取，未处理：${legacyGroups.join(', ')}`);
}
