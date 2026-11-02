#!/usr/bin/env node
/**
 * build-china-map.mjs — 生成成员页「成员概览」中国省级地图数据资产。
 *
 * 输出：theme-nucma/src/data/china-provinces.json
 *   { "viewBox": "0 0 1000 740", "provinces": [ { name, adcode, path, label:[x,y] } ] }
 *
 * 设计约束（勿随意改动）：
 *  1. 零 npm 依赖：投影、Douglas–Peucker 简化、质心、射线法求交全部本地实现，纯 Node。
 *  2. 原始 GeoJSON 只落在工作区临时目录 F:\0Project\halo\.tmp-build\china-map-source\，
 *     绝不写进 theme-nucma（否则会被 theme-package 打进安装包，体积翻数倍）。
 *  3. 幂等：源文件已存在且可解析则跳过下载，重复运行输出稳定。
 *  4. 名称归一化：产出 key 必须逐字等于 src/js/members.js 里 REGION_RULES 的 34 个简称，
 *     否则省级填色与人数聚合会静默对不上。见 NORM_SUFFIXES / NAME_ALIAS 的注释。
 *  5. 合规提示：境内公开发布的中国地图需审图号，且官方标准地图要求完整表示南海诸岛与
 *     九段线。本资产的主图按规格 bbox 裁到 18.1°N，另以独立附图（小图）补齐南海诸岛与
 *     九段线，满足「完整表示」的形式要求；但审图号需由发布方在正式发布前申请标注，
 *     或改用自然资源部标准地图底图（见 SOUTH_SEA 与 OUTPUT 注释）。
 *
 * 运行：node theme-nucma/tools/build-china-map.mjs
 * 可选：node theme-nucma/tools/build-china-map.mjs --from <本地GeoJSON路径>
 *      环境变量 CHINA_MAP_GEOJSON_URL（临时替换源）/ CHINA_MAP_GEOJSON_FILE（离线源文件）
 *      / CHINA_MAP_SOURCE=http|npm（锁定源类型，用于复现或验证兜底链路）
 *      / CHINA_MAP_MAX_KB（放宽体积上限）。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME_ROOT = resolve(HERE, '..');
const WORKSPACE_ROOT = resolve(THEME_ROOT, '..');

// ---------------------------------------------------------------- 常量与配置

/** 原始数据落盘目录：工作区临时区，不进安装包。 */
const SOURCE_DIR = join(WORKSPACE_ROOT, '.tmp-build', 'china-map-source');
const SOURCE_FILE = join(SOURCE_DIR, '100000_full.datav.json');
const OUT_FILE = join(THEME_ROOT, 'src', 'data', 'china-provinces.json');

/**
 * 数据源，按顺序尝试；每个源有独立缓存名，避免兜底的低精度数据覆写主源缓存后
 * 被后续运行当成主源静默复用。
 *  1. DataV.GeoAtlas 全国省级面（1:100 万级精度，含 properties.adcode/centroid）。
 *  2. DataV 同一数据集的 API 形式（等价内容，域名路径不同，抗单点失效）。
 *  3. npm 离线包 china-geojson（`npm pack` 取 tarball，仅作兜底，精度较低、名称已是简称）。
 * 兜底包不写入 theme-nucma 的 package.json，只在临时目录里解包读取。
 */
const SOURCES = [
  {
    kind: 'http',
    label: 'DataV.GeoAtlas 100000_full',
    url: 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json',
    cache: SOURCE_FILE,
  },
  {
    kind: 'http',
    label: 'DataV.GeoAtlas API 100000_full',
    url: 'https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=100000_full',
    cache: join(SOURCE_DIR, '100000_full.datav-api.json'),
  },
  {
    kind: 'npm',
    label: 'npm china-geojson (兜底)',
    pkg: 'china-geojson',
    member: 'package/src/geojson/china.json',
    cache: join(SOURCE_DIR, 'china-geojson.npm.json'),
  },
];

/** 中国主体 bbox（规格值，与 34 省并集实测一致：73.502–135.096°E / 18.14–53.563°N）。 */
const GEO_BBOX = { minLon: 73.5, maxLon: 135.1, minLat: 18.1, maxLat: 53.6 };
/** 画布：等距圆柱（plate carrée）线性映射到该 viewBox，x/y 独立缩放以铺满容器。 */
const VIEWBOX = { width: 1000, height: 740 };
const VIEWBOX_ATTR = `0 0 ${VIEWBOX.width} ${VIEWBOX.height}`;

const MAX_BYTES_DEFAULT = 140 * 1024;

/**
 * 简化容差搜索阶梯（单位＝输出 viewBox 像素，因此与分辨率相关、与经纬度无关）。
 * 取第一个能让产物体积 ≤ 上限的容差；同容差下输出确定性唯一。
 */
const TOLERANCE_LADDER = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0, 2.5, 3.0];
/** 单个环的自适应容差上限比例：避免港澳这类 1–10px 的小面被整体抹平。 */
const SMALL_RING_TOL_RATIO = 0.02;
const MIN_POINTS_PER_RING = 5;

/**
 * 名称归一化：后缀必须「长前短后」有序剥离，否则
 *   新疆维吾尔自治区 --先剥「自治区」--> 新疆维吾尔（错）
 *   广西壮族自治区 --只剥「自治区」--> 广西壮族（错）
 * 顺序：特别行政区 > 维吾尔自治区 > 壮族自治区 > 回族自治区 > 自治区 > 省/市。
 */
const NORM_SUFFIXES = ['特别行政区', '维吾尔自治区', '壮族自治区', '回族自治区', '自治区', '土家族苗族', '省', '市'];

/**
 * 归一化后的显式别名表：覆盖「剥后缀仍不等」与「剥后缀结果有歧义」的情况。
 * 已知坑：
 *  - 内蒙古 / 黑龙江 是 3 字名，任何「取前两字」或「截断到 2 字」的写法都会得到 内蒙 / 黑龙；
 *  - 河北/河南、湖北/湖南 共享首字，按首字或前缀两字匹配会互相撞车；
 *  - 吉林 既是省也是市，广西 的「壮族」、宁夏 的「回族」是民族名不是地名；
 *  - 港澳台必须用简称（无「省/特别行政区」），且必须与 REGION_RULES 逐字相同。
 * 键为源数据原始 name，值为 REGION_RULES 里的目标简称。
 */
const NAME_ALIAS = {
  北京市: '北京',
  天津市: '天津',
  上海市: '上海',
  重庆市: '重庆',
  河北省: '河北',
  山西省: '山西',
  内蒙古自治区: '内蒙古',
  辽宁省: '辽宁',
  吉林省: '吉林',
  黑龙江省: '黑龙江',
  江苏省: '江苏',
  浙江省: '浙江',
  安徽省: '安徽',
  福建省: '福建',
  江西省: '江西',
  山东省: '山东',
  河南省: '河南',
  湖北省: '湖北',
  湖南省: '湖南',
  广东省: '广东',
  广西壮族自治区: '广西',
  海南省: '海南',
  四川省: '四川',
  贵州省: '贵州',
  云南省: '云南',
  西藏自治区: '西藏',
  陕西省: '陕西',
  甘肃省: '甘肃',
  青海省: '青海',
  宁夏回族自治区: '宁夏',
  新疆维吾尔自治区: '新疆',
  台湾省: '台湾',
  香港特别行政区: '香港',
  澳门特别行政区: '澳门',
};

/** REGION_RULES 产出的 34 个 key，最终产物必须一个不多、一个不少。 */
const REQUIRED_NAMES = [
  '北京', '天津', '上海', '重庆', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东',
  '广西', '海南', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏',
  '新疆', '香港', '澳门', '台湾',
];

/**
 * 南海诸岛附图（小图）。
 * 主图 bbox 止于 18.1°N，九段线与南海岛礁都落在框外，单独出一张附图补齐，
 * 附图叠放在主图右下角（该区域是纯海面，不压任何陆地）。
 *  - 底图内含九段线（源里 adcode === '100000_JD' 的 10 段虚线多边形）；
 *  - 南海诸岛取海南省源内 maxLat < 18.1°N 的 129 个岛礁分面；
 *  - 海南本岛同时画进附图，供位置参照（与标准地图一致）。
 */
const SOUTH_SEA = {
  enabled: true,
  /** 附图覆盖的经纬范围：九段线最西 108.20°E、最北 24.59°N，向外留边。 */
  bbox: { minLon: 107.5, maxLon: 123.2, minLat: 3.2, maxLat: 25.0 },
  /** 附图在主图 viewBox 中的位置（右下角海面区域）。 */
  box: { x: 810, y: 460, width: 180, height: 270 },
  /** 附图内地理要素的绘制高度，剩余高度留给「南海诸岛」标题。 */
  geoHeight: 240,
  /** 附图内地理要素的简化容差（像素）。 */
  tolerance: 0.5,
};

/**
 * 南海诸岛 / 九段线策略：
 *  - 源里 adcode === '100000_JD' 的无名要素是九段线（JD＝九段线），不是省，
 *    主图不使用它，改由 SOUTH_SEA 附图绘制；
 *  - 海南省源内含 133 个分面，其中 129 个是曾母暗沙/西沙/中沙/黄岩岛等南海岛礁
 *    （3.82–17.12°N），全部落在规格 bbox（18.1°N）以南：主图按 maxLat 丢弃，
 *    附图按「分面最高纬度 < 18.1°N」收进南海诸岛图层；
 *  - 实测没有任何环跨越 18.1°N，因此主图的海南本岛与近海小岛不受裁切影响。
 */

// ---------------------------------------------------------------- 工具函数

function log(...args) {
  console.log(...args);
}

function fail(message) {
  console.error(`\n[build-china-map] 失败：${message}`);
  process.exit(1);
}

/** 解析命令行/环境变量覆盖项。 */
function readOverrides(argv) {
  const fromIdx = argv.indexOf('--from');
  return {
    from: fromIdx !== -1 ? resolve(argv[fromIdx + 1]) : process.env.CHINA_MAP_GEOJSON_FILE || null,
    url: process.env.CHINA_MAP_GEOJSON_URL || null,
    maxBytes: Number(process.env.CHINA_MAP_MAX_KB || 0) > 0
      ? Number(process.env.CHINA_MAP_MAX_KB) * 1024
      : MAX_BYTES_DEFAULT,
  };
}

function parseGeoJson(text, label) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} 不是合法 JSON：${error.message}`);
  }
  const features = data && data.features;
  if (!Array.isArray(features) || features.length < REQUIRED_NAMES.length) {
    throw new Error(`${label} 要素数不足（${Array.isArray(features) ? features.length : 0} < 34）`);
  }
  const named = features.filter((f) => f && f.properties && f.properties.name && f.geometry);
  if (named.length < REQUIRED_NAMES.length) {
    throw new Error(`${label} 具名省级要素不足（${named.length} < 34）`);
  }
  return data;
}

/** 源数据必须是覆盖 34 省的完整数据集，否则视为下载失败。 */
function assertUsable(data, label) {
  const seen = new Set();
  for (const feature of data.features) {
    const raw = feature && feature.properties && feature.properties.name;
    if (!raw) continue;
    const norm = normalizeName(raw);
    if (norm) seen.add(norm);
  }
  const missing = REQUIRED_NAMES.filter((n) => !seen.has(n));
  if (missing.length) throw new Error(`${label} 缺少省份：${missing.join('、')}`);
}

// ---------------------------------------------------------------- 数据获取

function downloadHttp(source, dest) {
  const tmp = `${dest}.part`;
  execFileSync('curl', ['-sS', '--fail', '--location', '--max-time', '60', '--retry', '2', '-o', tmp, source.url], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (!existsSync(tmp) || statSync(tmp).size < 1024) throw new Error(`下载内容过小：${source.url}`);
  const text = readFileSync(tmp, 'utf8');
  const data = parseGeoJson(text, source.url);
  assertUsable(data, source.label);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text, 'utf8');
  rmSync(tmp, { force: true });
  return { data, source: source.url, bytes: statSync(dest).size };
}

/** 兜底：npm pack 到临时目录解包，绝不写进 theme-nucma/package.json。 */
function fetchFromNpm(source, dest) {
  const pkg = source.pkg;
  const member = source.member;
  const workDir = join(SOURCE_DIR, `npm-${pkg}`);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  // Windows 上 npm 是 .cmd 垫片，Node 24 起必须经 shell 才能 spawn；
  // 参数只传包名、产物落在 cwd，避免带空格的路径被 shell 二次切分。
  execFileSync('npm', ['pack', pkg], {
    cwd: workDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  // 不解析 npm 的 stdout（版本间会混入 notice 行），直接找目录里真实的 tgz。
  const tarball = readdirSync(workDir)
    .filter((f) => f.endsWith('.tgz'))
    .sort((a, b) => statSync(join(workDir, b)).mtimeMs - statSync(join(workDir, a)).mtimeMs)[0];
  if (!tarball) throw new Error(`npm pack ${pkg} 未产出 tarball`);
  execFileSync('tar', ['-xzf', tarball, member], {
    cwd: workDir,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const extracted = join(workDir, member);
  if (!existsSync(extracted)) throw new Error(`npm 包 ${pkg} 内未找到 ${member}`);
  const text = readFileSync(extracted, 'utf8');
  const data = parseGeoJson(text, `npm:${pkg}`);
  assertUsable(data, `npm:${pkg}`);
  writeFileSync(dest, text, 'utf8');
  return { data, source: `npm:${pkg}/${member}`, bytes: statSync(dest).size };
}

function ensureSource(overrides) {
  mkdirSync(SOURCE_DIR, { recursive: true });

  if (overrides.from) {
    if (!existsSync(overrides.from)) fail(`--from 指定的文件不存在：${overrides.from}`);
    const text = readFileSync(overrides.from, 'utf8');
    const data = parseGeoJson(text, basename(overrides.from));
    assertUsable(data, basename(overrides.from));
    log(`源数据：本地文件 ${overrides.from}（跳过下载）`);
    return { data, source: `file:${overrides.from}`, bytes: statSync(overrides.from).size, downloaded: false };
  }

  // 显式指定 URL 时写入独立缓存，不覆写主源缓存。
  if (overrides.url) {
    const dest = join(SOURCE_DIR, 'override.geojson.json');
    try {
      const result = downloadHttp({ url: overrides.url, label: 'CHINA_MAP_GEOJSON_URL' }, dest);
      log(`采用源：CHINA_MAP_GEOJSON_URL（${(result.bytes / 1024).toFixed(1)} KB）`);
      return { ...result, downloaded: true };
    } catch (error) {
      fail(`CHINA_MAP_GEOJSON_URL 获取失败：${error.message}`);
    }
  }

  // CHINA_MAP_SOURCE 可锁定某一类源（http / npm），便于复现构建与验证兜底链路。
  const wanted = process.env.CHINA_MAP_SOURCE || '';
  const candidates = wanted ? SOURCES.filter((s) => s.kind === wanted) : SOURCES.slice();
  if (!candidates.length) fail(`CHINA_MAP_SOURCE=${wanted} 不是可用源类型（http / npm）`);

  // 幂等：按源优先级复用各自缓存文件，命中即不联网；每个源缓存独立，不会互相覆写。
  for (const source of candidates) {
    if (!existsSync(source.cache)) continue;
    try {
      const text = readFileSync(source.cache, 'utf8');
      const data = parseGeoJson(text, source.cache);
      assertUsable(data, source.label);
      log(
        `源数据：复用本地缓存 ${basename(source.cache)}（${(statSync(source.cache).size / 1024).toFixed(1)} KB，未联网）`,
      );
      return { data, source: `cache:${source.label}`, bytes: statSync(source.cache).size, downloaded: false };
    } catch (error) {
      log(`缓存 ${basename(source.cache)} 不可用（${error.message}），重新获取。`);
    }
  }

  const errors = [];
  for (const source of candidates) {
    try {
      log(`尝试源：${source.label}`);
      const result = source.kind === 'http'
        ? downloadHttp(source, source.cache)
        : fetchFromNpm(source, source.cache);
      log(`采用源：${source.label}（${(result.bytes / 1024).toFixed(1)} KB）`);
      return { ...result, downloaded: true };
    } catch (error) {
      errors.push(`  - ${source.label}: ${error.message}`);
    }
  }
  fail(`所有数据源均不可用：\n${errors.join('\n')}\n可用 --from <本地GeoJSON> 或 CHINA_MAP_GEOJSON_FILE 指定离线源。`);
}

// ---------------------------------------------------------------- 名称归一化

function normalizeName(raw) {
  const name = String(raw).trim();
  if (NAME_ALIAS[name]) return NAME_ALIAS[name];
  // 兜底：长后缀优先逐个剥离，再查别名表（应对源数据出现「内蒙古自治区（部分）」等变体）。
  let stripped = name;
  for (const suffix of NORM_SUFFIXES) {
    if (stripped.endsWith(suffix) && stripped.length > suffix.length) {
      stripped = stripped.slice(0, -suffix.length);
      break;
    }
  }
  if (REQUIRED_NAMES.includes(stripped)) return stripped;
  for (const [key, value] of Object.entries(NAME_ALIAS)) {
    if (key !== name && (name.startsWith(key) || stripped === key)) return value;
  }
  return null;
}

// ---------------------------------------------------------------- 投影

/**
 * 等距圆柱投影：lon/lat 线性映射到目标画布，纬度翻转（屏幕 y 向下）。
 * path 与 label 共用同一变换，因此气泡一定落在所属省轮廓的同一坐标系里。
 */
function makeProjectorFor(bbox, viewBox) {
  const spanLon = bbox.maxLon - bbox.minLon;
  const spanLat = bbox.maxLat - bbox.minLat;
  const sx = viewBox.width / spanLon;
  const sy = viewBox.height / spanLat;
  return {
    sx,
    sy,
    project([lon, lat]) {
      return [(lon - bbox.minLon) * sx, (bbox.maxLat - lat) * sy];
    },
  };
}

function makeProjector() {
  return makeProjectorFor(GEO_BBOX, VIEWBOX);
}

/** 保留 1 位小数并去掉多余的 .0，省下约 8% 字节。 */
function fmt(n) {
  const r = Math.round(n * 10) / 10;
  if (Object.is(r, -0)) return '0';
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// ---------------------------------------------------------------- 几何

/** Douglas–Peucker（迭代式，避免 1900 点长环爆栈）。 */
function douglasPeucker(points, tolerance) {
  const n = points.length;
  if (n < 3) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const tol2 = tolerance * tolerance;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    if (end <= start + 1) continue;
    const [x1, y1] = points[start];
    const [x2, y2] = points[end];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let maxIdx = -1;
    for (let i = start + 1; i < end; i += 1) {
      const [px, py] = points[i];
      let d2;
      if (len2 === 0) {
        const ax = px - x1;
        const ay = py - y1;
        d2 = ax * ax + ay * ay;
      } else {
        const t = ((px - x1) * dx + (py - y1) * dy) / len2;
        const cx = x1 + t * dx;
        const cy = y1 + t * dy;
        const ax = px - cx;
        const ay = py - cy;
        d2 = ax * ax + ay * ay;
      }
      if (d2 > maxD) {
        maxD = d2;
        maxIdx = i;
      }
    }
    if (maxIdx > 0 && maxD > tol2) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx], [maxIdx, end]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i += 1) if (keep[i]) out.push(points[i]);
  return out;
}

/**
 * 闭合环简化：按「离首点最远点」把环切成两条开链分别做 DP，
 * 比固定首尾为锚点的做法在长窄环（内蒙古、甘肃）上少得多锯齿。
 */
function simplifyClosedRing(ring, tolerance) {
  let pts = ring.slice();
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) pts = pts.slice(0, -1); // GeoJSON 闭合重复点
  }
  const n = pts.length;
  if (n < 4) return pts;
  let farIdx = 1;
  let farD = -1;
  for (let i = 1; i < n; i += 1) {
    const dx = pts[i][0] - pts[0][0];
    const dy = pts[i][1] - pts[0][1];
    const d = dx * dx + dy * dy;
    if (d > farD) {
      farD = d;
      farIdx = i;
    }
  }
  const chainA = douglasPeucker(pts.slice(0, farIdx + 1), tolerance);
  const chainB = douglasPeucker(pts.slice(farIdx).concat([pts[0]]), tolerance);
  const merged = chainA.concat(chainB.slice(1, -1));
  if (merged.length >= MIN_POINTS_PER_RING) return merged;
  // 小面（澳门约 1.1×2.1px）被抹平时，从原始环均匀取样保底，保证省份不消失。
  const step = Math.max(1, Math.floor(n / MIN_POINTS_PER_RING));
  const sampled = [];
  for (let i = 0; i < n && sampled.length < MIN_POINTS_PER_RING; i += step) sampled.push(pts[i]);
  return sampled;
}

/** 有向面积（shoelace）与面积质心。 */
function ringAreaCentroid(points) {
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    a2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  const area = a2 / 2;
  if (Math.abs(area) < 1e-9) {
    const b = ringBBox(points);
    return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, area];
  }
  return [cx / (3 * a2), cy / (3 * a2), area];
}

function ringBBox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** 射线法：点是否落在单个环内部。 */
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 点是否落在多边形（外环 + 洞）内。 */
function pointInPart([x, y], exterior, holes) {
  if (!pointInRing([x, y], exterior)) return false;
  for (const hole of holes) if (pointInRing([x, y], hole)) return false;
  return true;
}

// ---------------------------------------------------------------- 构建

/** 取要素的分面列表：每个分面 = [外环, ...洞环]，已投影。 */
function featureParts(geometry, projector) {
  const polygons = geometry.type === 'MultiPolygon'
    ? geometry.coordinates
    : geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : null;
  if (!polygons) return [];
  const out = [];
  for (const polygon of polygons) {
    let maxLat = -Infinity;
    for (const ring of polygon) {
      for (const [, lat] of ring) {
        if (maxLat < lat) maxLat = lat;
      }
    }
    if (!Number.isFinite(maxLat)) continue;
    // 整块分面都在 bbox 以南＝南海诸岛岛礁，主图丢弃，改由 SOUTH_SEA 附图承载。
    if (maxLat < GEO_BBOX.minLat) continue;
    out.push(polygon.map((ring) => ring.map((coord) => projector.project(coord))));
  }
  return out;
}

function buildParts(parts, tolerance) {
  const rings = [];
  let largest = null;
  let largestArea = -Infinity;
  let holesOfLargest = [];
  let pointCount = 0;

  parts.forEach((ringsOfPart) => {
    const [exteriorRaw, ...holeRaws] = ringsOfPart;
    if (!exteriorRaw) return;
    const diagB = ringBBox(exteriorRaw);
    const diag = Math.hypot(diagB.maxX - diagB.minX, diagB.maxY - diagB.minY);
    // 小面用更细容差，避免港澳整块消失。
    const ringTol = Math.max(0.02, Math.min(tolerance, diag * SMALL_RING_TOL_RATIO));
    const exterior = simplifyClosedRing(exteriorRaw, ringTol);
    pointCount += exterior.length;
    for (const raw of holeRaws) {
      const holesB = ringBBox(raw);
      const holeDiag = Math.hypot(holesB.maxX - holesB.minX, holesB.maxY - holesB.minY);
      const holeTol = Math.max(0.02, Math.min(tolerance, holeDiag * SMALL_RING_TOL_RATIO));
      const hole = simplifyClosedRing(raw, holeTol);
      if (hole.length < 3) continue;
      pointCount += hole.length;
      rings.push({ points: hole, isHole: true, partArea: 0 });
    }
    if (exterior.length < 3) return;
    const [, , area] = ringAreaCentroid(exterior);
    rings.push({ points: exterior, isHole: false, partArea: Math.abs(area) });
    if (Math.abs(area) > largestArea) {
      largestArea = Math.abs(area);
      largest = exterior;
      holesOfLargest = ringsOfPart.slice(1).map((raw) => raw.map((c) => c));
    }
  });

  return { rings, largest, holesOfLargest, pointCount };
}

/** 标注点：最大分面的面积质心；越界则依次退化到分面 bbox 中心、最近边界点。 */
function pickLabel(built) {
  const { largest, holesOfLargest } = built;
  if (!largest) return [0, 0];
  const holes = (holesOfLargest || []).filter((r) => r.length >= 3);
  const [cx, cy] = ringAreaCentroid(largest);
  const candidates = [
    [cx, cy],
    (() => {
      const b = ringBBox(largest);
      return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
    })(),
  ];
  for (const point of candidates) {
    if (pointInPart(point, largest, holes)) return [round1(point[0]), round1(point[1])];
  }
  // 凹形省（内蒙古、河北、甘肃）质心可能落在海/邻省：退化为最靠近质心的边界顶点。
  let best = largest[0];
  let bestD = Infinity;
  for (const point of largest) {
    const d = Math.hypot(point[0] - cx, point[1] - cy);
    if (d < bestD) {
      bestD = d;
      best = point;
    }
  }
  return [round1(best[0]), round1(best[1])];
}

function round1(n) {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * path 采用「M 首点 + 隐式 lineto」语法（SVG 规定 moveto 之后的坐标对自动视为 lineto），
 * 每点少一个 `L` 字符；环末 `Z` 闭合，洞作为独立子路径，配 fill-rule:evenodd 使用。
 */
function buildPath(rings) {
  let d = '';
  for (const ring of rings) {
    if (ring.points.length < 3) continue;
    d += `M${fmt(ring.points[0][0])},${fmt(ring.points[0][1])}`;
    for (let i = 1; i < ring.points.length; i += 1) {
      d += ` ${fmt(ring.points[i][0])},${fmt(ring.points[i][1])}`;
    }
    d += 'Z';
  }
  return d;
}

function buildProvinces(data, tolerance) {
  const projector = makeProjector();
  const provinces = [];
  const skipped = [];

  for (const feature of data.features) {
    const rawName = feature && feature.properties && feature.properties.name;
    if (!rawName) {
      const adcode = feature && feature.properties ? String(feature.properties.adcode || '') : '';
      skipped.push(`无名要素(${adcode || '无 adcode'})`);
      continue;
    }
    const name = normalizeName(rawName);
    if (!name) {
      skipped.push(`无法归一化(${rawName})`);
      continue;
    }
    if (!REQUIRED_NAMES.includes(name)) {
      skipped.push(`非省级要素(${rawName})`);
      continue;
    }
    if (!feature.geometry) {
      skipped.push(`无几何(${rawName})`);
      continue;
    }
    const parts = featureParts(feature.geometry, projector);
    if (!parts.length) {
      skipped.push(`裁剪后无分面(${rawName})`);
      continue;
    }
    const built = buildParts(parts, tolerance);
    const path = buildPath(built.rings);
    if (!path) {
      skipped.push(`path 为空(${rawName})`);
      continue;
    }
    const adcode = feature.properties.adcode;
    provinces.push({
      name,
      adcode: adcode === undefined || adcode === null || adcode === '' ? '' : String(adcode),
      path,
      label: pickLabel(built),
      _points: built.pointCount,
    });
  }

  // 稳定顺序：按 REQUIRED_NAMES 的既有次序输出，便于 diff。
  provinces.sort((a, b) => REQUIRED_NAMES.indexOf(a.name) - REQUIRED_NAMES.indexOf(b.name));
  return { provinces, skipped };
}

/**
 * 南海诸岛附图：九段线 + 南海岛礁 + 海南本岛，投影到附图坐标系后各自输出一条 path。
 *  - dash：源里 adcode === '100000_JD' 的 10 段虚线（多边形），合并为一条 path；
 *  - islands：海南省源内最高纬度低于 18.1°N 的岛礁分面；
 *  - hainan：海南省源内其余分面（本岛、东沙），仅作位置参照。
 */
function buildSouthSea(data) {
  if (!SOUTH_SEA.enabled) return null;
  const geoViewBox = { width: SOUTH_SEA.box.width, height: SOUTH_SEA.geoHeight };
  const projector = makeProjectorFor(SOUTH_SEA.bbox, geoViewBox);
  const layers = { dash: [], islands: [], hainan: [] };

  const pushPolygon = (target, polygon) => {
    for (const ring of polygon) {
      const projected = ring.map((coord) => projector.project(coord));
      const simplified = simplifyClosedRing(projected, SOUTH_SEA.tolerance);
      if (simplified.length < 3) continue;
      layers[target].push({ points: simplified, isHole: false, partArea: 0 });
    }
  };

  for (const feature of data.features) {
    const props = (feature && feature.properties) || {};
    const adcode = String(props.adcode || '');
    if (adcode === '100000_JD') {
      const polygons = feature.geometry && feature.geometry.type === 'MultiPolygon'
        ? feature.geometry.coordinates
        : [];
      for (const polygon of polygons) pushPolygon('dash', polygon);
      continue;
    }
    if (normalizeName(props.name) !== '海南') continue;
    const polygons = feature.geometry && feature.geometry.type === 'MultiPolygon'
      ? feature.geometry.coordinates
      : [];
    for (const polygon of polygons) {
      let maxLat = -Infinity;
      for (const ring of polygon) {
        for (const [, lat] of ring) if (lat > maxLat) maxLat = lat;
      }
      pushPolygon(maxLat < GEO_BBOX.minLat ? 'islands' : 'hainan', polygon);
    }
  }

  const southSea = {
    x: SOUTH_SEA.box.x,
    y: SOUTH_SEA.box.y,
    width: SOUTH_SEA.box.width,
    height: SOUTH_SEA.box.height,
    viewBox: `0 0 ${SOUTH_SEA.box.width} ${SOUTH_SEA.box.height}`,
    dash: buildPath(layers.dash),
    islands: buildPath(layers.islands),
    hainan: buildPath(layers.hainan),
    label: { x: Math.round(SOUTH_SEA.box.width / 2), y: SOUTH_SEA.geoHeight + 16 },
  };
  southSea._stats = {
    dash: layers.dash.length,
    islands: layers.islands.length,
    hainan: layers.hainan.length,
  };
  return southSea;
}

function serialize(provinces, southSea) {
  const payload = {
    viewBox: VIEWBOX_ATTR,
    provinces: provinces.map(({ name, adcode, path, label }) => ({ name, adcode, path, label })),
  };
  if (southSea) {
    const { x, y, width, height, viewBox, dash, islands, hainan, label } = southSea;
    payload.southSea = { x, y, width, height, viewBox, dash, islands, hainan, label };
  }
  return JSON.stringify(payload);
}

// ---------------------------------------------------------------- 自检

function runSelfCheck(provinces, southSea, json, maxBytes) {
  const problems = [];
  const produced = provinces.map((p) => p.name);
  const dup = produced.filter((n, i) => produced.indexOf(n) !== i);
  const missing = REQUIRED_NAMES.filter((n) => !produced.includes(n));
  const extra = [...new Set(produced.filter((n) => !REQUIRED_NAMES.includes(n)))];

  log('\n—— 自检 ——');
  log(`省份数量：${provinces.length} / ${REQUIRED_NAMES.length}`);
  if (dup.length) problems.push(`重复省名：${dup.join('、')}`);
  if (missing.length) problems.push(`缺失省名：${missing.join('、')}`);
  if (extra.length) problems.push(`多余省名：${extra.join('、')}`);

  let totalPoints = 0;
  let minPath = Infinity;
  let maxPath = 0;
  for (const p of provinces) {
    const ringCount = (p.path.match(/M/g) || []).length;
    const subPaths = (p.path.match(/Z/g) || []).length;
    totalPoints += p._points;
    minPath = Math.min(minPath, p.path.length);
    maxPath = Math.max(maxPath, p.path.length);
    if (!p.path.startsWith('M')) problems.push(`${p.name} 的 path 未以 M 开头`);
    if (ringCount !== subPaths) problems.push(`${p.name} 的 M/Z 子路径数不匹配（${ringCount}/${subPaths}）`);
    if (!Number.isFinite(p.label[0]) || !Number.isFinite(p.label[1])) {
      problems.push(`${p.name} 标注点非法：${JSON.stringify(p.label)}`);
    } else if (
      p.label[0] < 0 || p.label[0] > VIEWBOX.width || p.label[1] < 0 || p.label[1] > VIEWBOX.height
    ) {
      problems.push(`${p.name} 标注点越出 viewBox：(${p.label[0]}, ${p.label[1]})`);
    }
    // 轮廓越界检测：任何点落在画布外都说明 bbox 没兜住该省（港澳台湾必须完整在框内）。
    const nums = p.path.match(/-?\d+(?:\.\d+)?/g) || [];
    let outOfCanvas = 0;
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = Number(nums[i]);
      const y = Number(nums[i + 1]);
      if (x < -0.05 || x > VIEWBOX.width + 0.05 || y < -0.05 || y > VIEWBOX.height + 0.05) outOfCanvas += 1;
    }
    if (outOfCanvas) problems.push(`${p.name} 有 ${outOfCanvas} 个轮廓点越出 viewBox`);
    log(`  ${p.name.padEnd(4, ' ')} adcode=${(p.adcode || '-').padEnd(6)} path=${String(p.path.length).padStart(7)}B 子路径=${String(ringCount).padStart(3)} 点=${String(p._points).padStart(5)} label=(${p.label[0]}, ${p.label[1]})`);
  }

  const bytes = Buffer.byteLength(json, 'utf8');
  log(`\npath 长度区间：${minPath}–${maxPath} 字节`);
  log(`输出点数合计：${totalPoints}`);
  log(`文件字节数：${bytes}（${(bytes / 1024).toFixed(1)} KB，上限 ${(maxBytes / 1024).toFixed(0)} KB）`);

  if (southSea) {
    const stats = southSea._stats;
    log(
      `南海诸岛附图：九段线 ${stats.dash} 段 / 岛礁 ${stats.islands} 个 / 海南参照 ${stats.hainan} 块`
      + `（附图 ${SOUTH_SEA.box.width}×${SOUTH_SEA.box.height}，位于主图 (${southSea.x}, ${southSea.y})）`,
    );
    if (!southSea.dash) problems.push('南海附图缺少九段线');
    if (!southSea.islands) problems.push('南海附图缺少南海诸岛');
    if (!southSea.hainan) problems.push('南海附图缺少海南参照轮廓');
    const box = SOUTH_SEA.box;
    if (box.x < 0 || box.y < 0 || box.x + box.width > VIEWBOX.width || box.y + box.height > VIEWBOX.height) {
      problems.push('南海附图位置越出主图 viewBox');
    }
    for (const key of ['dash', 'islands', 'hainan']) {
      const nums = southSea[key].match(/-?\d+(?:\.\d+)?/g) || [];
      for (let i = 0; i < nums.length - 1; i += 2) {
        const x = Number(nums[i]);
        const y = Number(nums[i + 1]);
        if (x < -0.05 || x > SOUTH_SEA.box.width + 0.05 || y < -0.05 || y > SOUTH_SEA.geoHeight + 0.05) {
          problems.push(`南海附图 ${key} 有轮廓点越出附图范围`);
          break;
        }
      }
    }
  } else {
    problems.push('南海诸岛附图缺失：公开发布的中国地图必须完整表示南海诸岛与九段线');
  }

  if (bytes > maxBytes) problems.push(`体积超限：${bytes} > ${maxBytes}`);
  if (problems.length) {
    console.error(`\n自检发现 ${problems.length} 个问题：`);
    problems.forEach((problem) => console.error(`  ✗ ${problem}`));
    process.exit(1);
  }
  log('自检通过：34 个省级要素齐全，南海诸岛附图完整，path/label/volume 全部合规。');
}

// ---------------------------------------------------------------- 主流程

function main() {
  const overrides = readOverrides(process.argv.slice(2));
  log('构建成员页中国地图数据资产');
  log(`工作区：${WORKSPACE_ROOT}`);
  log(`投影 bbox：${GEO_BBOX.minLon}–${GEO_BBOX.maxLon}°E / ${GEO_BBOX.minLat}–${GEO_BBOX.maxLat}°N`);
  log(`viewBox：${VIEWBOX_ATTR}（比例 ${VIEWBOX.width / (GEO_BBOX.maxLon - GEO_BBOX.minLon)} px/°经度、${VIEWBOX.height / (GEO_BBOX.maxLat - GEO_BBOX.minLat)} px/°纬度）`);
  log(`南海诸岛/九段线：${SOUTH_SEA.enabled ? '以南海诸岛附图补齐（主图右下角，含九段线）' : '省略（不合规）'}`);

  const { data, source, bytes: sourceBytes } = ensureSource(overrides);
  log(`源数据：${source}（${(sourceBytes / 1024).toFixed(1)} KB）`);

  const southSea = buildSouthSea(data);
  if (!southSea) fail('南海诸岛附图构建失败：公开发布的中国地图必须完整表示南海诸岛与九段线');

  let chosen = null;
  for (const tolerance of TOLERANCE_LADDER) {
    const { provinces, skipped } = buildProvinces(data, tolerance);
    const json = serialize(provinces, southSea);
    const size = Buffer.byteLength(json, 'utf8');
    log(`容差 ${tolerance}px → ${provinces.length} 省 / ${size} 字节${size <= overrides.maxBytes ? ' ✅' : ''}`);
    if (size <= overrides.maxBytes) {
      chosen = { provinces, json, tolerance, skipped };
      break;
    }
  }
  if (!chosen) {
    fail(`在容差 ${TOLERANCE_LADDER.at(-1)}px 仍超过 ${(overrides.maxBytes / 1024).toFixed(0)}KB；请放宽 CHINA_MAP_MAX_KB 或降低源精度。`);
  }

  const { provinces, json, tolerance, skipped } = chosen;
  if (skipped.length) log(`已忽略要素：${skipped.join('、')}`);

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, `${json}\n`, 'utf8');
  log(`\n简化容差：${tolerance}px（自适应，小面按环尺寸下调）`);
  log(`写入：${OUT_FILE}`);

  const written = readFileSync(OUT_FILE, 'utf8').trim();
  runSelfCheck(provinces, southSea, written, overrides.maxBytes);
  log(`\n完成：${OUT_FILE}`);
}

main();
