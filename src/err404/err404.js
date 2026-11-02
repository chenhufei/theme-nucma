(function () {
  /* ================= 数据 ================= */
  /* 配置由 404 模板用 th:inline 注入到 window.__ERR404__（见 templates/error/404.html）：
       memberSource   plugin（成员插件）| manual（手动 JSON / 内置快照）
       memberGroups   只展示这些分组（名称或标识，逗号分隔）
       memberPick     只展示这些成员（姓名或 QQ，逗号/换行分隔）
       members        手动成员数组或 JSON 文本
       strapColor     织带主色（后台「404 页面」设置里的颜色）
       animation      full | lite | off —— 入场动画强度
       flipEnabled    是否允许点击翻面
       randomMember   是否每次进入随机换人
     插件来源时成员由 404 模板服务端读取并写成 #err404MemberData 里的 data-*，
     这里只解析 DOM，不再请求接口：数据与页面同源同批，插件停用时容器不存在，
     自动回落到手动数据 → 内置快照。
     快照只保留文字字段：头像不再内嵌 base64（原来 5 张图就占 340KB，
     还都是过期头像），改由 QQ 号实时取 q1.qlogo.cn，与成员页同一规则。 */
  var CONF = window.__ERR404__ || {};
  /* members 允许两种形态：数组，或后台 textarea 里填的 JSON 文本。
     解析放在这里而不是模板里 —— 一段手滑的 JSON 在模板里会把整页变成 500，
     在这里失败只会退回内置快照，404 照常显示。 */
  function manualMembers() {
    var raw = CONF.members;
    if (typeof raw === 'string' && raw) {
      try { raw = JSON.parse(raw); } catch (e) { raw = null; }
    }
    if (Object.prototype.toString.call(raw) === '[object Array]' && raw.length) return raw;
    return [{"name":"重庆校墙联","qq":"1493953691","school":"重庆校墙联","group":"官方成员","url":"https://qm.qq.com/q/1RGuyOCnb2","verified":true,"intro":"联盟官方主号，全国高校自媒体联盟的对外窗口。投稿、爆料、合作，认准这个号就够了。","no":"01"},{"name":"一中万能墙","qq":"1181648180","school":"重庆市大足一中","group":"重庆地区","url":"https://qm.qq.com/q/vto1fVtYmQ","verified":true,"intro":"大足一中校园墙。失物招领、表白投稿、校内资讯，每天更新，欢迎同学们来玩。","no":"02"},{"name":"八中万能墙","qq":"1832831049","school":"重庆市第八中学校","group":"重庆地区","url":"https://qm.qq.com/q/6Q9mZMz0CA","verified":true,"intro":"重庆八中校园墙。扩列、吃瓜、求助、树洞，校园里的大小事都在这里发生。","no":"03"},{"name":"南开万能墙","qq":"3021722019","school":"重庆市南开中学","group":"重庆地区","url":"https://qm.qq.com/q/XXAB23aZ2I","verified":true,"intro":"南开中学校园墙。匿名投稿，说说你身边的事，全校同学都在看。","no":"04"},{"name":"测试成员1","qq":"2323122332","school":"重庆大学","group":"重庆地区","url":"https://qm.qq.com/q/N2XK4nFXWu","verified":false,"intro":"（测试账号）正式成员的介绍文案由后台维护，上线后在此展示。","no":"05"}];
  }

  function qqFromLink(link) {
    var m = String(link || '').match(/[?&]uin=(\d{5,12})/);
    return m ? m[1] : '';
  }
  /* 加好友链接可能来自前台自助申请，只认 http(s)，挡掉 javascript: 这类伪协议 */
  function safeUrl(u) {
    var s = String(u == null ? '' : u).trim();
    return /^https?:\/\//i.test(s) ? s : '';
  }
  function pluginMembers() {
    var box = document.getElementById('err404MemberData');
    if (!box) return [];
    var nodes = box.querySelectorAll('.err404-member'), out = [];
    for (var i = 0; i < nodes.length; i++) {
      var d = nodes[i].dataset || {};
      var name = String(d.name || '').trim();
      if (!name) continue;
      var link = safeUrl(d.link);
      out.push({
        name: name,
        school: String(d.school || '').trim(),
        group: String(d.group || '').trim() || '未分组',
        gid: String(d.gid || '').trim(),
        avatar: String(d.avatar || '').trim(),
        url: link,
        qq: String(d.qq || '').trim() || qqFromLink(link),
        mid: String(d.mid || '').trim(),
        verified: true,
        intro: ''
      });
    }
    return out;
  }
  function splitList(v) {
    var parts = String(v == null ? '' : v).split(/[,，\n\r;；]+/), out = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i].trim().toLowerCase();
      if (s) out.push(s);
    }
    return out;
  }
  /* 后台填的分组 / 名单只是过滤器：
       分组同时认显示名和资源名（后台改过显示名也不会失效）；
       名单认姓名或 QQ，不区分大小写。
     过滤后一个不剩 → 退回未过滤的成员池，宁可多展示也不要空工牌。 */
  function pickMembers(pool) {
    var groups = splitList(CONF.memberGroups), picks = splitList(CONF.memberPick);
    if (!groups.length && !picks.length) return pool;
    var gset = {}, pset = {}, i;
    for (i = 0; i < groups.length; i++) gset[groups[i]] = 1;
    for (i = 0; i < picks.length; i++) pset[picks[i]] = 1;
    var out = [];
    for (i = 0; i < pool.length; i++) {
      var m = pool[i];
      var inGroup = !groups.length ||
        gset[String(m.group || '').toLowerCase()] || gset[String(m.gid || '').toLowerCase()];
      var inPick = !picks.length ||
        pset[String(m.name || '').toLowerCase()] ||
        !!(m.qq && pset[String(m.qq).toLowerCase()]);
      if (inGroup && inPick) out.push(m);
    }
    return out.length ? out : pool;
  }
  var MEMBERS = (function () {
    var pool = null;
    if (CONF.memberSource !== 'manual') {
      var fromPlugin = pluginMembers();
      if (fromPlugin.length) pool = fromPlugin;
    }
    if (!pool) pool = manualMembers();
    return pickMembers(pool);
  })();

  /* ================= 主题 / 状态 ================= */
  /* 移动端菜单、返回顶部按钮由主题主脚本（src/js/main.js）统一绑定。
     这里原本也绑了一份 —— 落到主题后一次点击会跑两遍（菜单开了又立刻被关），
     所以重复的部分整段删掉，只留工牌自己用的东西。 */
  var root = document.documentElement;

  /* 织带配色：后台「404 页面 → 织带颜色」覆盖，留空沿用品牌红。
     原来三段色是写死的，改为由基色推导：亮 +12% / 本色 / 暗 -22%。 */
  var STRAP_BASE = CONF.strapColor || '#cf3538';
  function strapShade(hex, amt) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return hex;
    function f(v) {
      return Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
    }
    return 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }

  /* ================= 成员渲染 ================= */
  var els = {};
  ['badgeName','badgeSchool','badgeGroup','badgeStatus',
   'badgeQr','badgeAdd','badgeAvatarWrap','badgeFootQq',
   'backAvatarWrap','backName','backSchool','backIntro','backGroup','backQq',
   'badge'].forEach(function (id) { els[id] = document.getElementById(id); });

  /* DOM 写入的小工具：模板里少一个 id 不该让整段渲染中断。
     原来 setMember 直接对 els.* 调 textContent，只要模板与脚本有一处对不上，
     第一个空节点就抛 TypeError，后面的证件背面字段全部停在上一任成员。 */
  function setText(el, v) { if (el) el.textContent = v == null ? '' : v; }
  function setHtml(el, v) { if (el) el.innerHTML = v == null ? '' : v; }
  function toggleClass(el, cls, on) { if (el) el.classList.toggle(cls, !!on); }
  function setAttr(el, name, v) {
    if (!el) return;
    if (v == null || v === '') el.removeAttribute(name);
    else el.setAttribute(name, v);
  }
  function parentOf(el) { return el ? el.parentNode : null; }

  /* 二维码画不出来时的占位：虚线框 + 文案，比留一张上一任的白板诚实 */
  function drawQrPlaceholder(ctx, size) {
    ctx.save();
    ctx.strokeStyle = '#d8d8de';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(4.5, 4.5, size - 9, size - 9);
    ctx.restore();
    ctx.fillStyle = '#8b8b93';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('二维码不可用', size / 2, size / 2);
  }

  function drawQr(canvas, text) {
    if (!canvas) return;
    var size = canvas.width;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    /* 先铺白：没有加好友链接的成员也要把上一位的二维码擦掉，不能留残影 */
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    if (!text || !window.qrcode) return;
    var qr = window.qrcode(0, 'M');
    if (!qr) return;
    try {
      qr.addData(text); qr.make();
    } catch (e) {
      /* 链接过长 / 编码器内部报错时 make() 会抛，原实现没有兜底，
         异常一路冒到 setMember 中断，证件背面就留在上一位成员身上。 */
      drawQrPlaceholder(ctx, size);
      return;
    }
    var n = qr.getModuleCount();
    var quiet = 1;                       /* 每侧 1 模块静区，二维码尽量撑满 */
    var cell = Math.floor(size / (n + quiet * 2)) || 2;
    var off = Math.floor((size - cell * n) / 2);
    ctx.fillStyle = '#1c1c1f';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(off + c * cell, off + r * cell, cell, cell);
    }
  }

  /* 头像来源优先级：成员自带 avatar → QQ 号实时图（q1.qlogo.cn，与成员页同一规则）
     → 首字占位。原来快照里塞了 5 张 base64 大图（340KB）且都是旧头像，
     成员换头像后永远不会更新，所以一并去掉。 */
  function avatarSrc(m) {
    var raw = String(m.avatar == null ? '' : m.avatar).trim();
    /* 头像同样可能来自前台申请：挡掉伪协议，相对路径（/upload/...）照常可用 */
    if (raw && !/^(javascript|vbscript|data):/i.test(raw)) return raw;
    var qq = String(m.qq == null ? '' : m.qq).trim();
    if (!/^\d{5,12}$/.test(qq)) return '';
    return 'https://q1.qlogo.cn/g?b=qq&nk=' + encodeURIComponent(qq) + '&s=640';
  }
  function avatarNode(m, cls, wrapCls) {
    var src = avatarSrc(m);
    var rawName = String(m.name == null ? '' : m.name);
    var name = esc(rawName);
    if (src) {
      return '<span class="' + wrapCls + '"><img class="' + cls + '" src="' + esc(src) +
        '" alt="' + name + '" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>';
    }
    return '<span class="' + wrapCls + ' badge-avatar--ph">' + esc(rawName.charAt(0)) + '</span>';
  }

  /* ---- 名字自适应：一行不行折两行，两行放不下才缩字号，绝不截断 ---- */
  var mctx = document.createElement('canvas').getContext('2d');
  function nameWidth(text, px) {
    mctx.font = '400 ' + px + 'px KuaiKanShiJieTi, sans-serif';
    return mctx.measureText(text).width;
  }
  /* 按字符贪心折行，返回需要几行 */
  function linesNeeded(text, px, maxW) {
    var lines = 1, cur = '';
    for (var i = 0; i < text.length; i++) {
      var t = cur + text[i];
      if (cur && nameWidth(t, px) > maxW) {
        lines++; cur = text[i];
        if (lines > 2) return lines;
      } else cur = t;
    }
    return lines;
  }
  function esc(t) {
    return t.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* 找最均衡的断点：两段都能放下、宽度差最小 */
  function bestSplit(text, fs, maxW) {
    if (text.length < 2) return -1;
    var best = -1, diff = 1e9;
    for (var i = 1; i < text.length; i++) {
      var w1 = nameWidth(text.slice(0, i), fs);
      if (w1 > maxW) break;
      var w2 = nameWidth(text.slice(i), fs);
      if (w2 > maxW) continue;
      var d = Math.abs(w1 - w2);
      if (d < diff) { diff = d; best = i; }
    }
    return best;
  }
  function fitName(el, text, baseRem, maxW) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('is-two');
    var base = baseRem * 16, fs = base, lim = maxW * 0.975, guard = 0;
    /* 一行放得下就一行 */
    if (nameWidth(text, fs) <= lim) { el.style.fontSize = (fs / 16).toFixed(3) + 'rem'; return; }
    /* 放不下 → 降一档，两行排；断行位置挑左右最接近的，避免最后一行只剩一个字 */
    fs = base * 0.72;
    var sp = bestSplit(text, fs, lim);
    while (sp < 0 && fs > 10 && guard++ < 160) { fs -= 0.5; sp = bestSplit(text, fs, lim); }
    if (sp > 0) {
      el.innerHTML = esc(text.slice(0, sp)) + '<br>' + esc(text.slice(sp));
      el.classList.add('is-two');
    }
    el.style.fontSize = (fs / 16).toFixed(3) + 'rem';
  }
  var curMember = null;
  function fitAll(m) {
    if (!m) return;
    var cw = (els.badge && els.badge.offsetWidth) || 316;
    var small = cw < 280;
    var pad = small ? 16 : 22, bav = small ? 50 : 64;
    /* 正面名字独占一整行，可用宽度 = 卡宽 − 左右内边距 */
    fitName(els.badgeName, m.name, small ? 1.36 : 1.66, cw - pad * 2);
    fitName(els.backName, m.name, small ? 1.06 : 1.34, cw - pad * 2 - bav - 13);
  }
  window.__badgeRefit = function () { fitAll(curMember); };

  function setMember(idx) {
    var m = MEMBERS[(parseInt(idx, 10) || 0) % MEMBERS.length];
    curMember = m;
    setText(els.badgeSchool, m.school);
    setText(els.badgeGroup, m.group);
    setText(els.badgeFootQq, m.qq);
    setHtml(els.badgeAvatarWrap, avatarNode(m, 'badge-avatar', 'badge-avatar-wrap'));
    setText(els.badgeStatus, m.verified ? '已认证' : '待认证');
    toggleClass(els.badgeStatus, 'is-vip', m.verified);
    /* 插件成员可以没有加好友链接（成员页也只给有链接的人显示加好友）：
       二维码、按钮一起收起，并把画布擦白，别把上一位的码留在卡上。 */
    var link = safeUrl(m.url), hasLink = !!link;
    setAttr(els.badgeAdd, 'href', hasLink ? link : null);
    toggleClass(els.badgeAdd, 'is-empty', !hasLink);
    toggleClass(parentOf(els.badgeQr), 'is-empty', !hasLink);
    var addCol = parentOf(els.badgeAdd);
    if (addCol) {
      toggleClass(addCol.querySelector('.bp-label'), 'is-empty', !hasLink);
      toggleClass(addCol.querySelector('.bp-qq'), 'is-empty', !m.qq);
    }
    drawQr(els.badgeQr, link);
    setHtml(els.backAvatarWrap, avatarNode(m, 'badge-back-avatar', 'badge-back-avatar-wrap'));
    fitAll(m);
    setText(els.backSchool, m.school);
    setText(els.backIntro, m.intro || '');
    toggleClass(els.backIntro, 'is-empty', !m.intro);
    setText(els.backGroup, m.group);
    setText(els.backQq, m.qq);
    return m;
  }
  window.__badgeSetMember = function (idx) {
    if (idx === 'random') idx = Math.floor(Math.random() * MEMBERS.length);
    return setMember(idx);
  };
  /* 探针用：看当前生效的成员池（插件/手动/快照、分组与名单过滤后的结果） */
  window.__badgePool = function () { return MEMBERS.slice(); };

  /* ================= 挂绳物理 + 织带绘制 ================= */
  function initBadge() {
    var scene = document.querySelector('.err404-scene');
    var main = document.querySelector('.err404-main');
    var copy = document.querySelector('.err404-copy');
    if (!scene) return;
    var badge = els.badge;
    var flipEl = badge && badge.querySelector('.badge-flip');
    if (!flipEl) return;
    var faces = flipEl.children;
    var canvas = document.getElementById('strapCanvas');
    var ctx = canvas && canvas.getContext('2d');
    if (!ctx) return;
    var claspWrap = document.getElementById('claspWrap');
    /* 卡扣是卡片的同级兄弟元素，由 JS 每帧套用「与卡片同款」的变换。
       用 transform-origin 0 0，这样变换串里能显式写出绕支点/绕卡心的两级缩放。 */
    if (claspWrap) claspWrap.style.transformOrigin = '0 0';

    var DPR = Math.min(1.5, window.devicePixelRatio || 1);
    /* 画布不能只盖住场景：卡片最多能拖到 3.15·L0 处（远超 scene 宽度），
       而画布原来只到 scene+340 ⇒ 绳子在那一列之外整段消失，看上去就是一道
       从上到下贯穿的「隐形墙」。改成让画布等于整个 .err404-main 的盒子，
       和 overflow-x:clip 的裁切线重合：卡片能被裁到哪，绳子就画到哪，永不同步失败。
       OFFX/OFFY 因此变成「场景左上角在画布内的坐标」，在 measure() 里按实际布局算。 */
    var host = document.querySelector('.err404-main') || scene;
    var OFFX = 0, OFFY = 0, BLEED = 0;
    var cw = 0, ch = 0;

    var W = 316, HOLE = 20.5, CH = 492;
    /* 卡扣夹片几何（viewBox 单位，随卡片尺寸等比缩放）：
       卡孔 → 支点(横杆中心) 17，支点 → 织带终点 17.3（夹片 y -60.6..-38 的中段）。
       不能写死像素：卡扣是 preserveAspectRatio="none" 的 SVG，窄屏会被整体缩放，
       写死的话带端就落在夹片外面 → 露白缝。 */
    var L0 = 208, EXT = 178;
    var PIV_G = 17, END_G = 17.3, vSX = 1, vSY = 1, bandW = 26;
    var swiv = 0, radQ = 0;                     /* 夹片绕横杆的摆角 / 量化后的卡面角 */
    var ax = 0, ay = -4, th = 0.05, om = 0, r = L0, vr = 0;
    var dragging = false, px = 0, py = 0, moved = 0, downT = 0;
    var last = performance.now();
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var demo = false, demoT0 = null, hold = null;
    var flipShown = 0, flipping = false, flipT0 = 0, flipFrom = 0, flipTo = 0;
    var freezeFp = null;   /* 深链 #fp= 冻结翻转进度时，卡扣跟着卡面一起压窄 */
    var lastTf = '', lastTf2 = '', strapDirty = true;
    var clipHeads = claspWrap ? claspWrap.querySelectorAll('.clip-head') : null;
    var lastHeadTf = '';
    var lastCx = -1e9, lastCy = -1e9, lastDeg = -1e9;   /* 卡片与织带共用的量化姿态 */
    var bulS = 0, bulDir = 0;                          /* 织带弯曲量 / 它「往哪边鼓」的慢跟随方向 */
    var leanS = 0, leanV = 0;                          /* 卡片倾角：值 / 角速度（二阶滞后的状态） */
    /* 入场不再用「整体下坠的关键帧」。
       旧做法：把 dropY 同时加到卡片和织带上端 ⇒ 带子长度不变、整块牌子平移下来，
       落地那一下再靠分段抛物线弹回去 —— 用户反复说的「触底反弹」就是这个：
       地面上弹球的手感，不是挂在绳子上晃的手感。
       新做法：织带上端钉死在锚点，卡片从卡扣附近松手，沿绳向加速下落把**吊带拉长**，
       弹簧再把它拽回去 ⇒ 上下是「绳子被拉伸后回弹」，同时钟摆左右晃，
       两者共用一套物理积分，收尾保留 ±2.6° 的永久慢晃（振幅掉到地板就不再耗能）。
       entAt   —— 入场启动时刻（含 140ms 等字体/布局的延迟）
       entT    —— 已播放秒数
       entFall —— true = 自由下落段（只加速，不拉弹簧）
       rFree   —— true = 绳长交给物理（入场起永久 true，measure() 不许再复位成 L0） */
    var entAt = null, entT = 0, entFall = false, rFree = false, entFrozen = false;
    /* 入场「收住」的单向闩锁：见 loop() 里 dropping 那段 */
    var entDone = false, entDoneAt = 0;
    /* 松手回弹段标记：拖拽会把绳拉到 2~3 倍静息长，轻阻尼的入场弹簧会在这种幅度下
       和钟摆打拍（两个振荡器速度同时归零 → 卡片「停一下又接着走」= 用户报的卡顿） */
    var postDrag = false;
    /* 19:4x 两段式接住：caught = 已经飞过松手后的第一个顶点（之后绷紧段换成 FL_CB2 的接住阻尼）；
       vrPrev = 上一子步的径向速度，只在 stepPhys 末尾更新。 */
    var caught = false, vrPrev = 0;
    var dropFreeze = null;   /* 深链 #drop=<ms>：把入场冻结在第 ms 毫秒（验图专用） */

    /* --- 采样缓冲（复用，避免每帧 GC） --- */
    var N = 40, PX = [], PY = [], TX = [], TY = [], SEG = [], TOTAL = 0;
    var dbgBul = 0, dbgSlack = 0, dbgTang = 0;   /* 探针用：当前拱量/松弛量/角速度项，别拿去驱动画面 */
    var flipK = 1;  /* 翻转时的横向压扁系数，织带跟着一起收，才不会比环宽出一截 */
    var fsCache = 0, wCache = null, lastBox = null, gradCache = null;

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function shortAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

    function measure() {
      var iw = window.innerWidth;
      var rect = scene.getBoundingClientRect();
      CH = badge.offsetHeight || 492;
      W = badge.offsetWidth || 316;
      var slots = badge.querySelectorAll('.badge-slot'), hmax = 0;
      for (var si = 0; si < slots.length; si++) {
        var v = slots[si].offsetTop + slots[si].offsetHeight / 2;
        if (v > hmax) hmax = v;
      }
      HOLE = hmax || 11.5;
      /* 卡扣 SVG 的 viewBox 是 316×492、preserveAspectRatio=none → 换算成卡面 px */
      vSX = W / 316; vSY = CH / 492;
      bandW = Math.max(15, Math.round(26 * vSX));
      /* 吊带静息长度 = 0.35·卡高（原 0.42）。看得见的带长就是这个量再加锚点到
         导航栏底那约 63px，0.42 时合计 270px，太长。 */
      L0 = Math.round(CH * 0.35);
      if (L0 < 128) L0 = 128;
      ax = rect.width / 2; ay = -4;
      /* 场景高度刚好容纳「挂绳 + 卡片 + 地面留白」，绝不压到 footer */
      var need = L0 + CH + 42;
      scene.style.height = need + 'px';
      /* 画布尺寸 = 整个 .err404-main 的盒子（原来只 = 场景宽 + 2×340）。
         卡片能拖到的位置远超场景宽度，画布不够大时绳子会在画布边界被整段截掉，
         看起来就是一道竖直的「隐形墙」从页面顶贯到底。 */
      /* ⚠️ 逐像素实测（.workbuddy/_404probe.cjs clip 模式）：`overflow-clip-margin` 在
         「overflow-x:clip + overflow-y:visible」这种**单轴 clip** 下**完全不生效** —— 裁剪线
         仍死死压在 main 的盒边（1512 屏 x=172.5），卡片一拖过那条线整块消失 = 用户报的
         「左边一块区域把拖动截断」。只有 `overflow:clip`（两轴）才认 clip-margin，但那会在
         卡片正下方凭空多出一道地板墙（卡片能往下拖到 3.15·L0）。
         所以改用「负 margin + 等值 padding」：盒边自己外扩到屏幕两侧、内容盒一寸不动
         （border-box 下 padding 正好抵掉 margin）⇒ 裁剪线 = 屏幕边，看不见。 */
      var innerW = host.clientWidth - BLEED * 2;   /* 减掉上一次的外扩 = 幂等，不会自激振荡 */
      BLEED = Math.max(0, Math.round((document.documentElement.clientWidth - innerW) / 2));
      host.style.boxSizing = 'border-box';
      host.style.marginLeft = host.style.marginRight = -BLEED + 'px';
      host.style.paddingLeft = host.style.paddingRight = BLEED + 'px';
      var hr = host.getBoundingClientRect(), sr0 = scene.getBoundingClientRect();
      OFFX = Math.round(sr0.left - hr.left);
      OFFY = Math.round(sr0.top - hr.top);
      cw = Math.round(hr.width);
      /* 画布上边**就停在导航栏底那条线**（19:2x 撤掉 19:0x 的 TOPB 上抬）：
         用户口径「绳子应该在 header 那条线以下，不应该在它之上；反弹可以藏进 header」。
         带子越过那条线 = 爬到导航栏上面，是要禁掉的观感；卡片飞到线以上则由导航栏自然盖住。 */
      ch = Math.max(host.clientHeight || 0, need + OFFY + 170);
      canvas.width = Math.round(cw * DPR);
      canvas.height = Math.round(ch * DPR);
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      canvas.style.left = -OFFX + 'px';
      canvas.style.top = -OFFY + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, OFFX * DPR, OFFY * DPR);
      lastBox = null;   /* 原点/尺寸变了，上一帧的脏矩形作废，下一帧整屏清一次 */
      badge.style.transformOrigin = (W / 2) + 'px ' + HOLE + 'px';
      /* 卡扣是卡片的同级兄弟，尺寸必须跟卡片完全一致：
         SVG viewBox 与卡面 mask 同为 0 0 316 492 且 preserveAspectRatio=none，
         元素盒跟着卡片缩放 → 金属环与卡孔在任何断点都严丝合缝。 */
      if (claspWrap) {
        claspWrap.style.width = W + 'px';
        claspWrap.style.height = CH + 'px';
      }
      /* 右栏与工牌平行：顶边齐、底边齐。先清零量一次实际偏差，再把高度锁到卡片高。
         卡片尺寸/断点/字体任何变化都不会让两侧上下错开。 */
      if (copy) {
        copy.style.paddingTop = '0px'; copy.style.height = '';
        if (iw > 960) {
          /* 右栏与工牌平行：顶边齐、底边齐。
             不要用 getBoundingClientRect 读 badge——它会把挂绳动画施加的 translate
             一起算进去（卡片随钟摆荡下来），导致 pad 跟着动画实时变，且首帧
             （动画还没跑、transform 为空）量到的是 0，必须等 fonts.ready 或 resize
             重算才对齐（表现就是「刷新一次才齐」）。
             改用静止悬挂姿态的确定几何：孔在锚点下方约 L0，卡顶比孔高 HOLE；
             这两个量是常量，首帧即正确，不再依赖刷新时序。 */
          var pad = Math.max(0, Math.round((ay + L0) - HOLE));
          copy.style.paddingTop = pad + 'px';
          copy.style.height = (pad + Math.round(CH)) + 'px';
        }
      }
      /* 入场/回弹期间绳长由物理管（rFree），别在这里按回 L0 —— 会把正在弹的绳子一帧抹平 */
      if (!dragging && !rFree) r = L0;
      lastBox = null; gradCache = null;
      lastCx = -1e9; lastCy = -1e9; lastDeg = -1e9;
      /* canvas 改尺寸会清空位图，必须让织带在下一帧重画（否则字体就绪后重排 → 织带消失） */
      strapDirty = true;
      window.__badgeRefit && window.__badgeRefit();
      fsCache = 0;
    }
    measure();
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
      fsCache = 0; wCache = null; measure();
    });

    /* ---- 按弧长取点 ---- */
    function atArc(s) {
      var acc = 0;
      for (var i = 1; i <= N; i++) {
        var d = SEG[i - 1];
        if (acc + d >= s || i === N) {
          var t = d ? (s - acc) / d : 0;
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          return [
            PX[i - 1] + (PX[i] - PX[i - 1]) * t,
            PY[i - 1] + (PY[i] - PY[i - 1]) * t,
            Math.atan2(PY[i] - PY[i - 1], PX[i] - PX[i - 1])
          ];
        }
        acc += d;
      }
      return [PX[N], PY[N], 0];
    }

    /* 织带终点：夹片绕横杆摆 swiv 之后，夹口中段的世界坐标。
       支点(横杆) = 卡孔沿卡面法线 PIV_G；夹口中段 = 支点沿夹片轴向 END_G。 */
    function mouthPos(cx, cy, rad, radB) {
      var piv = HOLE + PIV_G * vSY;
      var px0 = cx + Math.sin(rad) * piv, py0 = cy - Math.cos(rad) * piv;
      return [px0 + Math.sin(radB) * END_G * vSY, py0 - Math.cos(radB) * END_G * vSY];
    }

    function drawStrap(cx, cy, rad, radB, now, fx) {
      fx = (fx && fx < 0.995) ? Math.max(0.004, fx) : 1;
      /* 带端落在金属夹片内部，末端切线沿夹片轴向 —— 两条一起保证「布面从夹口插进去」：
         不管卡片被拽成什么角度，夹口都被布面顶住，不会露出白缝。 */
      var mp = mouthPos(cx, cy, rad, radB);
      var sx = mp[0], sy = mp[1];
      var hx = Math.sin(radB), hy = -Math.cos(radB);   /* 夹片轴向（朝外/朝上） */
      /* 画出来的起点比物理支点更高，让织带从画面上方垂下来，不在半空断头。
         ⚠️ 这里**只跟锚点**，不要再加 dropY —— 入场靠 r 变长来表现「吊带被拉长」，
            上端一起动就变回「整块牌子平移」。 */
      var a0x = ax, a0y = ay - EXT;
      var tang = om * r;
      var mdx = sx - a0x, mdy = sy - a0y, mlen = Math.hypot(mdx, mdy) || 1;
      var nx = -mdy / mlen, ny = mdx / mlen;
      /* 弯曲量跟角速度成正比时，摇摆过零点会整条带子翻面 → 像面条一样抖。
         软绳的弯曲有惯性，做一阶低通；端点仍然严格跟卡片，只让中段慢半拍。 */
      /* 「橡皮筋」和「硬杆」的分别（用户 2026-11-01 18:0x：顶部像有东西挡着）：
         带子没有压缩刚度 —— r 比静息短多少，中段就必须被**挤**出去多少。
         ⚠️ 上一版是把这个量乘在滞后项上（slackK），于是「鼓包」跟着 om 走：
            卡片升到最高点时 om 正在变小 ⇒ 带子刚好在那一刻被画成一根短硬杆，
            顶在工牌头上 = 用户看到的「区块」。现在拱量只看折起的量，方向另存一份
            慢跟随的 `bulDir`（om 过零时不会跟着清零）。
         ⚠️ 滞后项本身（−tang·0.085，限幅 ±30）一个字不动 ⇒ 入场/常态观感不变；
            拱项门控在 postDrag ⇒ 静止 r=L0 时 slack=0，画面一寸不变。 */
      /* 19:0x 飞行段 r 可以远小于 L0，但拱量必须**饱和**：真实带子折过头以后多出来的长度
         是堆在挂点附近的，不是继续往旁边鼓。不限的话满量程能拱到 0.46·400=184px，
         整条带子会在卡片升到锚点上方时被画成一根夸张的大弧。130 = 用户已经认可的那档顶点拱量。 */
      var slack = postDrag ? Math.min(130, Math.max(0, L0 - r)) : 0;
      /* 绷紧的带子没有侧向自由度：r ≥ L0（吊点被拽到位或更远）时布面必须是**直线**，
         只有真松了（r < L0，吊点被托到静息位上方）才有多出来的长度可以鼓出去。
         ⚠️ 以前 `−tang·0.085` 无条件生效 ⇒ 拖拽/摆动一晃就按角速度弯一下：
            浏览器实测 drag 按住时 dev 7.5px、入场早期 22px = 用户说的「绳子有的时候是弯的」。
         现在这一项乘 `bowK = clamp((L0−r)/8, 0, 1)`：绷紧段恒为 0，松弛段（含入场前 600ms
         r 远小于 L0）门开满 —— 入场可见段实测只差 ≤2px（dev −1.8 → 0），定版观感不动。
         松弛鼓包那一项（bulDir·SLACK_K·slack）一个字没动。 */
      var slackRaw = Math.max(0, L0 - r);
      var bowK = Math.min(1, slackRaw / 8);
      var bulT = clamp(clamp(-tang * 0.085, -30, 30) * bowK + bulDir * SLACK_K * slack, -92, 92);
      bulS += (bulT - bulS) * 0.22;
      /* 不再叠一条独立的正弦「呼吸」：它和物理摆动不同相位，静止时看着就是带子自己在抖 */
      var bul = bulS;
      dbgBul = bul; dbgSlack = slack; dbgTang = tang;
      /* 三次贝塞尔：末端切线强制沿夹片轴向（= 带子插进夹口的方向）。
         二次贝塞尔做不到 —— 终点切线由控制点定，卡片一转带子就斜着横跨卡面。 */
      var k2 = Math.min(96, mlen * 0.34);
      /* 需要拐的角度太大时缩短末端控制柄，否则贝塞尔会自交成一个圈 */
      var turn = ((a0x - sx) * (-hx) + (a0y - sy) * (-hy)) / mlen;
      if (turn < 0.35) k2 *= 0.45;
      var mx1 = a0x + (sx - a0x) * 0.42 + nx * bul * 0.9;
      var my1 = a0y + (sy - a0y) * 0.42 + ny * bul * 0.9;
      /* 终点切线 = -h → 控制点落在 S 的 +h 一侧 */
      var mx2 = sx + hx * k2, my2 = sy + hy * k2;

      TOTAL = 0;
      for (var i = 0; i <= N; i++) {
        var u = i / N, mu = 1 - u;
        var b0 = mu * mu * mu, b1 = 3 * mu * mu * u, b2 = 3 * mu * u * u, b3 = u * u * u;
        PX[i] = b0 * a0x + b1 * mx1 + b2 * mx2 + b3 * sx;
        PY[i] = b0 * a0y + b1 * my1 + b2 * my2 + b3 * sy;
        var dx = 3 * mu * mu * (mx1 - a0x) + 6 * mu * u * (mx2 - mx1) + 3 * u * u * (sx - mx2);
        var dy = 3 * mu * mu * (my1 - a0y) + 6 * mu * u * (my2 - my1) + 3 * u * u * (sy - my2);
        var L = Math.hypot(dx, dy) || 1;
        TX[i] = dx / L; TY[i] = dy / L;
        if (i) {
          var d = Math.hypot(PX[i] - PX[i - 1], PY[i] - PY[i - 1]);
          SEG[i - 1] = d; TOTAL += d;
        }
      }
      /* 翻转时整条带子随卡片一起侧过去。
         必须在「卡片局部坐标系」里压：卡片上的 scaleX 压的是它自己的横轴，不是屏幕 x 轴。
         只做屏幕 x 缩放，卡片倾斜 30° 时端点会偏出 50px 以上（带子和卡扣断开）。
         局部横坐标 lu=0 的点（正中线，也就是卡扣连接点）压完仍在原处，所以接头永远不断。 */
      if (fx !== 1) {
        var co = Math.cos(rad), si = Math.sin(rad);
        for (i = 0; i <= N; i++) {
          var ddx = PX[i] - cx, ddy = PY[i] - cy;
          var lu = ddx * co + ddy * si;
          var lv = -ddx * si + ddy * co;
          lu *= fx;
          PX[i] = cx + lu * co - lv * si;
          PY[i] = cy + lu * si + lv * co;
        }
        /* 形状变了，切线 / 弧长要重算，否则带体边缘和织带字会歪 */
        TOTAL = 0;
        for (i = 0; i <= N; i++) {
          var ia = i > 0 ? i - 1 : 0, ib = i < N ? i + 1 : N;
          var tdx = PX[ib] - PX[ia], tdy = PY[ib] - PY[ia];
          var tdl = Math.hypot(tdx, tdy) || 1;
          TX[i] = tdx / tdl; TY[i] = tdy / tdl;
          if (i) {
            var sdd = Math.hypot(PX[i] - PX[i - 1], PY[i] - PY[i - 1]);
            SEG[i - 1] = sdd; TOTAL += sdd;
          }
        }
      }

      /* 只清上一帧织带占的矩形，整屏 clear 会拖慢 60fps */
      if (lastBox) ctx.clearRect(lastBox[0], lastBox[1], lastBox[2] - lastBox[0], lastBox[3] - lastBox[1]);
      else ctx.clearRect(-OFFX, -OFFY, cw, ch);
      var bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (i = 0; i <= N; i++) {
        if (PX[i] < bx0) bx0 = PX[i]; if (PX[i] > bx1) bx1 = PX[i];
        if (PY[i] < by0) by0 = PY[i]; if (PY[i] > by1) by1 = PY[i];
      }
      var bpad = bandW * 1.1;
      lastBox = [bx0 - bpad, by0 - bpad, bx1 + bpad, by1 + bpad];

      var hw = bandW / 2 * fx;
      /* 带体 */
      ctx.beginPath();
      for (i = 0; i <= N; i++) {
        var lx = PX[i] - TY[i] * hw, ly = PY[i] + TX[i] * hw;
        if (i) ctx.lineTo(lx, ly); else ctx.moveTo(lx, ly);
      }
      for (i = N; i >= 0; i--) ctx.lineTo(PX[i] + TY[i] * hw, PY[i] - TX[i] * hw);
      ctx.closePath();
      if (!gradCache) {
        gradCache = ctx.createLinearGradient(ax - 90, ay - 60, ax + 90, ay + 200);
        gradCache.addColorStop(0, strapShade(STRAP_BASE, .14));
        gradCache.addColorStop(.45, STRAP_BASE);
        gradCache.addColorStop(1, strapShade(STRAP_BASE, -.24));
      }
      ctx.fillStyle = gradCache;
      ctx.fill();

      if (fx < 0.55) return;   /* 压成一条线了，细节一律不画 */
      /* 中心光泽：让带子像织物不是纸片 */
      ctx.beginPath();
      for (i = 0; i <= N; i++) { if (i) ctx.lineTo(PX[i], PY[i]); else ctx.moveTo(PX[i], PY[i]); }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,214,210,.16)';
      ctx.lineWidth = hw * 0.88;
      ctx.stroke();

      /* 两侧压边 */
      ctx.beginPath();
      for (i = 0; i <= N; i++) {
        var a1 = PX[i] - TY[i] * (hw - 0.9), b1 = PY[i] + TX[i] * (hw - 0.9);
        if (i) ctx.lineTo(a1, b1); else ctx.moveTo(a1, b1);
      }
      ctx.strokeStyle = 'rgba(74,10,10,.34)'; ctx.lineWidth = 1.7; ctx.stroke();
      ctx.beginPath();
      for (i = 0; i <= N; i++) {
        var a2 = PX[i] + TY[i] * (hw - 0.6), b2 = PY[i] - TX[i] * (hw - 0.6);
        if (i) ctx.lineTo(a2, b2); else ctx.moveTo(a2, b2);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.26)'; ctx.lineWidth = 1.2; ctx.stroke();

      /* 织带上的空心字：高度占带宽 ~86%，紧贴两侧边 */
      if (fx < 0.50) return;   /* 带子已经压成一条线，字压扁只会糊成一团 */
      var TEXT = 'NUCMA';
      if (!fsCache) {
        ctx.font = '400 100px KuaiKanShiJieTi, sans-serif';
        var capm = ctx.measureText('N').actualBoundingBoxAscent || 72;
        fsCache = 100 * (bandW * 0.60) / capm;
        wCache = null;
      }
      var fs = fsCache;
      ctx.font = '400 ' + fs.toFixed(2) + 'px KuaiKanShiJieTi, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = Math.max(1.15, fs * 0.058);
      ctx.strokeStyle = 'rgba(255,255,255,.97)';
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';

      if (!wCache) {
        var tmp = [], acc = 0;
        for (i = 0; i < TEXT.length; i++) { tmp[i] = ctx.measureText(TEXT[i]).width; acc += tmp[i]; }
        wCache = { w: tmp, sum: acc };
      }
      var widths = wCache.w, sum = wCache.sum;
      /* 字样固定在靠近卡片的一段，不随织带总长漂移 */
      /* 字距跟着绳长走（用户 2026-11-01：「要像橡皮筋一样」）：印字是印在带子材料上的，
         带子被拉长 2 倍时字与字必须跟着拉开，折回去时挤拢 —— 原来写死 118px，
         带子从 350 拉到 716 字距却一寸不动，看着就是「一块硬牌子往下掉」。
         用 (EXT+r)/(EXT+L0) 而不是实测弧长：静息时严格等于 1 ⇒ 停着的画面一寸不变。 */
      var ls = 118 * Math.max(0.82, Math.min(1.5, (EXT + r) / (EXT + L0)));
      var s2 = Math.max(60, TOTAL - 16), s1 = s2 - ls;
      /* ⚠️ 这里原来还有一档 `s1 = Math.max(EXT + 8, s2 - ls)`，用来挡住「首字母被画布顶边裁掉」。
         带子折起来时 TOTAL 变短，这一档就把整个单词**往下顶**，五个字母挤进几十 px ⇒
         就是用户截图里「NUCM 挤成一坨、像一块压在工牌头上的东西」。
         裁掉首字母才是对的：那截本来就在导航栏后面，字母跟着带子一起藏进去。 */
      var span = s2 - s1;
      var gap = (span - sum) / (TEXT.length - 1);
      if (gap < 0) gap = 0;
      var runW = sum + gap * (TEXT.length - 1);
      var pos = s1 + (span - runW) / 2;
      for (i = 0; i < TEXT.length; i++) {
        var p = atArc(pos + widths[i] / 2);
        ctx.save();
        ctx.translate(p[0], p[1]);
        ctx.rotate(p[2]);
        /* 翻转期间带子被压窄，字也要跟着横向压，否则字会宽出带子两边 */
        if (fx !== 1) ctx.scale(1, fx);
        var mm = ctx.measureText(TEXT[i]);
        ctx.strokeText(TEXT[i], 0, (mm.actualBoundingBoxAscent - mm.actualBoundingBoxDescent) / 2);
        ctx.restore();
        pos += widths[i] + gap;
      }
    }

    /* ---- 翻转：2D 挤压，无 3D → 无白底 ---- */
    function showFace(k) {
      faces[0].classList.toggle('is-on', k === 0);
      faces[1].classList.toggle('is-on', k === 1);
      flipShown = k;
    }
    function flipCard() {
      if (flipping) return;
      /* 后台「404 页面 → 允许翻面」关闭后，点击只拖不翻 */
      if (CONF.flipEnabled === false) return;
      flipping = true; flipT0 = performance.now();
      flipFrom = flipShown; flipTo = 1 - flipShown;
      badge.classList.add('is-flipping');
    }
    window.__badgeFlip = flipCard;

    /* ---- 整页可拖 ---- */
    function inUI(t) {
      return t && t.closest && (t.closest('.bp-link') || t.closest('a'));
    }
    /* 拖拽时每个 pointermove 都读一次 getBoundingClientRect 会强制同步布局，
       事件密的时候就是一阵一阵地卡。改成按下时读一次，之后只用指针位移增量。 */
    var sceneL = 0, sceneT = 0, px0 = 0, py0 = 0, pcx = 0, pcy = 0;
    /* 按下点相对卡扣的偏移，记在**卡面自己的坐标系**里（gx 沿卡面横轴、gy 沿卡面纵轴）。
       拖拽时用「指针 − R(卡面角)·(gx,gy)」反解孔位 ⇒ 按下的那一点始终贴着指针：
       抓卡身就拖卡身，抓卡扣才拖卡扣。以前一律按「孔位 + 指针位移」算，
       抓卡身时卡扣会飞到指尖、卡身反向甩开，就是「拉扯永远在扣环上」。 */
    var gx = 0, gy = 0;
    function startDrag(e) {
      if (e.button || inUI(e.target)) return;
      dragging = true; moved = 0; downT = performance.now();
      var rect = scene.getBoundingClientRect();
      sceneL = rect.left; sceneT = rect.top;
      pcx = e.clientX; pcy = e.clientY;
      px = px0 = e.clientX - sceneL; py = py0 = e.clientY - sceneT;
      var hx0 = ax + Math.sin(th) * r, hy0 = ay + Math.cos(th) * r;
      var rx = px - hx0, ry = py - hy0;
      var gcr = Math.cos(radQ), gsr = Math.sin(radQ);
      gx = rx * gcr + ry * gsr;      /* R(−rad)·r */
      gy = -rx * gsr + ry * gcr;
      badge.classList.add('is-drag');
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    }
    function moveDrag(e) {
      if (!dragging) return;
      var nx = px0 + (e.clientX - pcx), ny = py0 + (e.clientY - pcy);
      moved += Math.abs(nx - px) + Math.abs(ny - py);
      px = nx; py = ny;
    }
    /* 拖到一半页面滚动了（手机上很常见）：场景在屏幕上的位置变了，把起点补回去 */
    window.addEventListener('scroll', function () {
      if (!dragging) return;
      var rect = scene.getBoundingClientRect();
      px0 -= rect.left - sceneL; py0 -= rect.top - sceneT;
      sceneL = rect.left; sceneT = rect.top;
    }, { passive: true });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      /* 松手 = 进入「拖拽回弹段」：这一段要给绳长弹簧额外阻尼（见 stepPhys 里 postDrag 那段）。
         拖拽会把绳子拉到 2~3 倍静息长，而入场那套轻阻尼（ζ≈0.19）会让它和钟摆互相打拍。 */
      postDrag = true;
      caught = false;
      badge.classList.remove('is-drag');
      document.body.style.cursor = '';
      var onCard = e && e.target && e.target.closest && e.target.closest('#badge');
      if (onCard && moved < 9 && performance.now() - downT < 520) flipCard();
    }
    (main || scene).addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', moveDrag, { passive: true });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    badge.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(); }
    });

    function loop(now) {
      /* dt 必须严格落在 (0, 32ms]：rAF 时间戳回退（后台标签页复活、虚拟时钟、
         系统改时间）会给负数，而下面全是 1-e^(-k·dt) 形式的低通 —— dt<0 时系数变负，
         低通立刻反过来变成放大，卡片会被甩到 -200°、夹片乱转。 */
      var dt = (now - last) / 1000;
      if (!(dt > 0) || dt > 0.032) dt = 0.016;
      last = now;

      /* 入场推进：启动延迟（140ms，等字体/布局量完）结束后才开始积分 */
      if (entAt !== null && !entFrozen && now >= entAt) entT += dt;
      /* 入场期间 lean 必须取 0（见下方 leanT 那段的相位注释）。
         ⚠️ 收住之后必须**单向闩锁**，不能再拿 |r-L0|>2.5 / |vr|>30 这类实时阈值反复判断：
            绳子慢慢停的时候正好在那条线上来回穿，lean 每被打开一次就把卡面硬甩 3~4°，
            微风也一会被吞一会被放 —— 用户看到的「慢慢停时顿两下」就是这个。
            entT>2.2 是为了别让下落途中误判成「已收住」。 */
      if (!entDone && entAt !== null && !entFrozen && entT > 2.2 &&
          Math.abs(r - L0) < 3 && Math.abs(vr) < 40) { entDone = true; entDoneAt = now; }
      var dropping = entAt !== null && !entDone;
      /* 交回常态倾斜用 0.6s 渐入：二阶跟随的起振仍要 ~100ms 才吃满，闩锁那一帧目标从 0 跳到
         LEAN_A·om 还是会甩一下，所以渐入不能省 */
      var leanIn = entAt === null ? 1 : (entDone ? Math.min(1, (now - entDoneAt) / 600) : 0);

      if (hold) { th = hold[0]; r = hold[1]; om = 0; vr = 0; }
      else if (dragging) {
        /* 反解孔位：让按下的那一点正好落在指针下（卡片当刚体：孔位 + R(卡面角)·g = 指针）。
           卡面角 = −(th + lean)，先用上一帧的 lean 把抓取偏移转进吊绳坐标系，
           再一次性解出 (th, r)，而不是逐帧「按当前卡角试一个孔位」：
           卡角本身由 th 决定，逐帧试就是正反馈（孔位偏一点 → 卡角多转一度 → 孔位更偏），
           抓得越靠下越容易发散 —— 实测抓卡片下部往锚点方向拖会飙到 ±3.15·L0 被夹住。
           闭式解（A = r + g'_y，T 是锚点到指针的向量）：
             T_x = A·sinθ + g'_x·cosθ,  T_y = A·cosθ − g'_x·sinθ
             ⇒ A = ±√(|T|² − g'_x²),  θ = atan2(T_x,T_y) − atan2(g'_x, A),  r = A − g'_y
           两个 A 符号 = 卡面正反两解，取离当前 th 更近的那支，拖过锚点也不会翻 180°。 */
        var lcL = Math.cos(leanS), lsL = Math.sin(leanS);
        var gpx = gx * lcL + gy * lsL;          /* R(−lean)·g */
        var gpy = -gx * lsL + gy * lcL;
        var tAx = px - ax, tAy = py - ay;
        var a2 = tAx * tAx + tAy * tAy - gpx * gpx;
        var th_t, r_t;
        if (gx * gx + gy * gy < 256 && tAx * tAx + tAy * tAy < 256) {
          /* 抓卡扣、又拖到锚点 16px 内：角度由 atan2 决定、在原地乱转，保角只收半径 */
          th_t = th; r_t = r < 0 ? -16 : 16;
        } else if (a2 > 0) {
          var sA = Math.sqrt(a2), psi = Math.atan2(tAx, tAy);
          var thA = psi - Math.atan2(gpx, sA), rA = sA - gpy;
          var thB = psi - Math.atan2(gpx, -sA), rB = -sA - gpy;
          if (Math.abs(shortAngle(thB - th)) < Math.abs(shortAngle(thA - th))) {
            th_t = thB; r_t = rB;
          } else {
            th_t = thA; r_t = rA;
          }
        } else {
          /* 指针落进「侧向抓取偏移」的圈里（抓的是卡片侧边、又拖到锚点旁）：够不着，
             保角只收半径，不硬掰（掰了就是原地疯转）。 */
          th_t = th; r_t = -gpy;
        }
        r_t = clamp(r_t, -L0 * 3.15, L0 * 3.15);
        /* 指数平滑 1-e^(-k·dt)：跟帧率无关。原来的线性 dt*k 掉到 30fps 时 k 直接翻倍，
           手一快就是一顿一顿地贴上去。角度速率也做低通，倾角不会跟着抖。 */
        var kA = 1 - Math.exp(-dt * 24);
        var kR = 1 - Math.exp(-dt * 20);
        var nth = th + shortAngle(th_t - th) * kA;
        om += (shortAngle(nth - th) / dt - om) * 0.5;
        th = nth;
        var nr = r + (r_t - r) * kR;
        vr += ((nr - r) / dt - vr) * 0.5; r = nr;
      } else if (!reduced && !entFrozen) {
        /* 子步积分（≤12ms 一步）：60/90/120Hz 下轨迹一致，掉帧时也不会积出大幅摆动 */
        var st = dt > 0.012 ? Math.ceil(dt / 0.012) : 1;
        var sdt = dt / st;
        for (var si2 = 0; si2 < st; si2++) stepPhys(sdt);
        /* 这里原来有一档「微风」(om += sin(now*0.00115)*0.012*dt)：它唯一的用处是托住
           旧的「永久慢晃」，现在晃要逐渐停止 ⇒ 留着只会把停下后的歪角慢慢拖到摩擦死区边缘。删掉。 */
      }
      /* 下限：入场起手 r 是**负值**（卡片在锚点上方 700px，整块在画面之外），
         用拖拽那个 0.3·L0 下限会被一帧夹上去，卡片会凭空出现在画面里。
         19:0x 起松手段也可能升到锚点上方（自由飞行）⇒ 深链 #hold= 同样要放行负值，
         否则截图/探针会被这条 clamp 夹在 r=51.6，量不到飞行段。
         拖拽态按 ±3.15·L0 对称放行：不然往上一拖会被入场那条 −532 顶住，卡片掉回指针下方。 */
      r = clamp(r, dragging ? -L0 * 3.15
        : ((entAt !== null || hold) ? L0 - EN_D0 - 40 : L0 * 0.3), L0 * 3.15);

      /* 入场：卡片沿绳向自由下落 → 吊带被拉长 → 弹回，同时钟摆左右晃 */
      var cx = ax + Math.sin(th) * r, cy = ay + Math.cos(th) * r;
      /* 织带「往哪边鼓」：量由折起多少决定（见 drawStrap），方向单独存一份慢跟随的状态。
         不能直接用 −sign(tang)：卡片升到最高点那一刻 tang 正在过零，鼓包会跟着塌成直线。
         第二项 `−tanh(th·3)·0.2` 是兜底 —— 慢慢把工牌举起来时 tang≈0，
         带子仍要往卡片偏心的那一侧鼓出去，否则又变回一根短硬杆。 */
      var dirT = -Math.tanh((om * r) / 200) * 0.8 - Math.tanh(th * 3) * 0.2;
      bulDir += (dirT - bulDir) * (1 - Math.exp(-dt * 3.2));
      /* ⚠️ 卡片倾角这里**不能有任何饱和函数**。旧写法 `0.26·tanh(om)` 的问题不是「幅度收得太狠」，
         而是 om 在松手回弹时峰值到 4.25 ⇒ tanh=0.99997 完全饱和，rad−th 被钉死在
         0.26rad=14.90° 连续 27 帧（≈432ms，_stut_trace_rubber.json 实测），
         卡片绝对角冲到 42.5° 而吊绳只有 30.2° —— 恒定歪角挂住再翻边 = 「左右值写死」。
         现在改成**二阶跟随**（有质量、会过冲、自己回正），目标 = LEAN_A·om 线性无上限；
         峰值仍落在 ~15°（用户看过的那档幅度），但平台从 452ms 掉到 124ms，
         Δ²rad 从 0.743 降到 0.288、HITCH 从 16 降到 7（_404lean.cjs 同一套物理对比）。
         ⚠️ 同样不许加「|om| 低于阈值就归零」的门控：om 在摆的端点本来就过零，
            门控会让 lean 的导数在同一时刻也变成 0 ⇒ rad'=om' 双重零点，实测就是「顿」一下。
         ⚠️ 入场期间目标必须取 0：lean 由 om 派生，而 om 与摆角 th 差 90° 相位，
            两者一叠正好互相抵消 —— 卡片位置在左右移、朝向却几乎不变，
            看上去就是「整块被平移」。入场时吊着的卡片，倾斜角本来就等于吊绳方向 th。 */
      var lN = dt > 0.012 ? Math.ceil(dt / 0.012) : 1, lDt = dt / lN;
      for (var li = 0; li < lN; li++) {
        var leanT = dropping ? 0 : LEAN_A * om * leanIn;
        leanV += (-LEAN_W * LEAN_W * (leanS - leanT) - 2 * LEAN_Z * LEAN_W * leanV) * lDt;
        leanS += leanV * lDt;
      }
      /* 深链冻结（#hold=）要的是稳态：om 已被置 0 ⇒ 直接把状态收在 0，别留给低通去慢慢爬 */
      if (hold) { leanS = 0; leanV = 0; }
      var rad = th + leanS;
      /* ⚠️ 负号：吊绳在 +th 侧时，卡身要往 +th 侧倒（顺着吊绳挂下来），不是反向折回去。
         以前用 +rad，卡面沿「锚点方向」折 180°：th=+35° 时吊绳往右下、卡身却往左下，
         看上去像卡扣被人拎着、卡身吊在后面甩不进来 —— 拖拽时就是「扣环永远在最前面」。
         整个 rad 一起取反（含 leanS）⇒ 卡面世界角正好镜像，倾角动态/平滑度逐帧不变。 */
      var deg = -rad * 180 / Math.PI;
      /* 用 2D translate：translate3d 会把 .idcard 提成不透明合成层，翻转时露白 */
      /* 一份量化姿态，卡片和织带共用。
         以前两者各吃未量化值、各有各的阈值 → 摇摆时卡片每帧动、织带隔几帧才跳一次，
         端点必然迟半拍（就是「吊带抖、和卡扣有延迟」）。量化到 1/16px、0.01° 肉眼无台阶。 */
      var qx = Math.round(cx * 16) / 16;
      var qy = Math.round(cy * 16) / 16;
      var qd = Math.round(deg * 100) / 100;
      var moved = (qx !== lastCx || qy !== lastCy || qd !== lastDeg);
      if (moved) {
        badge.style.transform = 'translate(' + (qx - W / 2).toFixed(3) + 'px,' +
          (qy - HOLE).toFixed(3) + 'px) rotate(' + qd.toFixed(2) + 'deg)';
        lastCx = qx; lastCy = qy; lastDeg = qd;
      }
      radQ = qd * Math.PI / 180;
      /* 夹片绕横杆微摆：让夹口始终对着织带的来向。真挂扣的转轴就是这个作用，
         不摆的话卡片一转，夹口方向就和布面差 30°+，布面只能从夹片侧面穿出去 → 露白缝。
         限幅 ±0.62rad，避免金属甩到卡面外。 */
      var mt = mouthPos(qx, qy, radQ, radQ + swiv);
      var wantB = Math.atan2(ax - mt[0], mt[1] - (ay - EXT));
      var dB = clamp(shortAngle(wantB - radQ), -0.62, 0.62);
      /* hold（截图/深链冻结）直接取稳态，否则一阶低通收敛不到位，截出来的是中间态 */
      if (hold) swiv = dB;
      else swiv += (dB - swiv) * (1 - Math.exp(-dt * 16));
      var radB = radQ + swiv;
      var headMoved = false;
      if (clipHeads) {
        var headTf = 'rotate(' + (swiv * 180 / Math.PI).toFixed(2) + ' 0 -32)';
        if (headTf !== lastHeadTf) {
          for (var hi = 0; hi < clipHeads.length; hi++) clipHeads[hi].setAttribute('transform', headTf);
          lastHeadTf = headTf;
          headMoved = true;
        }
      }
      /* 卡扣（同级兄弟）套用卡片同款变换，压在吊带之上 → 吊带任何姿态都接进卡扣。
         用 origin 0 0 的显式串：先平移到支点(W/2,HOLE)做卡片的 translate+rotate，再平移回去，
         等价于卡片的 transform-origin=(W/2,HOLE)，保证卡扣与卡片/吊带严丝合缝。 */
      var claspBase = '';
      if (claspWrap) {
        claspBase = 'translate(' + (W / 2) + 'px,' + HOLE + 'px) ' + badge.style.transform +
          ' translate(-' + (W / 2) + 'px,-' + HOLE + 'px)';
        /* 深链冻结翻转（#fp=）时，卡扣要跟卡面一起被压窄；
           卡面翻转是绕卡心做的，卡扣同样绕卡心压才不错位。 */
        var claspFreeze = freezeFp != null
          ? ' translate(' + (W / 2) + 'px,' + (CH / 2) + 'px) scaleX(' + freezeFp.toFixed(4) + ')' +
            ' translate(-' + (W / 2) + 'px,-' + (CH / 2) + 'px)'
          : '';
        if (!flipping) claspWrap.style.transform = claspBase + claspFreeze;
      }

      /* 翻转动画（先算，织带要按同一压扁系数重画） */
      if (flipping) {
        var p = clamp((now - flipT0) / 560, 0, 1);
        var e2 = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        var cs = Math.cos(Math.PI * e2);
        var ax2 = Math.abs(cs);
        var syf = 1 + 0.018 * Math.sin(Math.PI * e2);
        var tff = 'scaleX(' + Math.max(0.012, ax2).toFixed(4) + ')' +
          ' scaleY(' + syf.toFixed(4) + ')';
        flipEl.style.transform = tff;
        /* 卡扣用完全相同的变换（含 scaleY），否则金属与卡面上下错开 1.8%。
           在卡片同款变换之后，再绕卡心(W/2,CH/2)叠加压扁，保证金属与卡面同步挤压。 */
        if (claspWrap) claspWrap.style.transform = claspBase +
          ' translate(' + (W / 2) + 'px,' + (CH / 2) + 'px) ' + tff +
          ' translate(-' + (W / 2) + 'px,-' + (CH / 2) + 'px)';
        flipK = ax2;
        var want = e2 < 0.5 ? flipFrom : flipTo;
        if (want !== flipShown) showFace(want);
        if (p >= 1) {
          flipping = false;
          flipK = 1;
          flipEl.style.transform = '';
          if (claspWrap) claspWrap.style.transform = claspBase;
          showFace(flipTo);
          badge.classList.toggle('is-flipped', flipTo === 1);
          badge.classList.remove('is-flipping');
          strapDirty = true;   /* 收尾必须把织带按原宽度重画一次 */
        }
      }

      /* 织带：只要卡片这一帧动过就必须跟着重画，绝不能用另一套阈值去省
         （省下的每一帧都是「带子停在原地、卡扣已经走了」的错位） */
      if (moved || headMoved || flipping || flipK !== 1 || strapDirty) {
        drawStrap(qx, qy, radQ, radB, now, flipK);
        strapDirty = false;
      }

      /* 演示模式：自动模拟一次拉拽（供截图核对） */
      if (demo) {
        if (demoT0 === null) demoT0 = now;
        var t = (now - demoT0) / 1000;
        if (t > 0.4 && t < 2.1) {
          dragging = true;
          var ee = Math.min(1, (t - 0.4) / 1.3);
          ee = 1 - Math.pow(1 - ee, 3);
          px = ax + ee * 250;
          py = ay + 200 + Math.sin(ee * Math.PI) * 30;
        } else if (t >= 2.1) { dragging = false; demo = false; }
      }
      requestAnimationFrame(loop);
    }
    /* ================= 入场：吊带被拉长 → 弹回 → 慢慢晃，永不「定住」================= */
    /* 用户 2026-11-01 反馈：「有一次还是触底反弹，都改成绳子那种上下弹跳，有点左右摇摆，
       最后也是慢慢摇晃，不固定」。三句话对应三处：
       ① 「触底反弹」= 旧实现把卡片和织带上端一起平移下来（dropY 同时加到 a0y），
          再在 y=0 处用分段抛物线弹回 —— 带子长度不变，那就是「整块牌子搬到地上再弹」，
          没有地面却像撞地。现在织带上端钉死在锚点，卡片沿绳向自由下落把**吊带拉长**，
          靠弹簧拽回：到最低点是「被绳子拽住」，不是「撞到底再弹起」。
       ② 「绳子那种上下弹跳」= 竖直只有一个自由度：绳长 r 的阻尼振荡（不再有关键帧）。
          半个来回 0.47s、振幅 ×0.54，约 5~6 次收住 —— 绳子慢弹，不是皮球脆弹。
       ③ 「左右摇摆」= 钟摆 th 带阻尼 + 一点库仑摩擦（夹片转轴 + 空气），
          摆幅一路衰减到**真的停下**（用户 2026-11-01 16:0x：「不是永久慢晃，根据实际逐渐停止」）。
          摩擦会带来一个很小的死区：|th| ≤ OM_FRIC·L0/G_EQ ≈ 0.7° 以内就停住不再回正，
          这正是「挂绳夹子」该有的样子 —— 它不会绝对竖直，但肉眼看不出歪。
       三个量共用一个积分函数 stepPhys()，位置仍是 cx=ax+sin(th)·r、cy=ay+cos(th)·r，
       所以上下左右天然耦合：绳子伸缩带出横向位移、摆动本身又把绳长拉长一点，轨迹是椭圆。
       ④ 「一开始画面里什么都没有，卡片是掉下来的」（用户 2026-11-01 追加）
          —— 起手不放在「锚点下方一点点」，而是把 r 取成**负值**：卡片整块位于锚点**上方**
          700px，连卡片底边都在页面顶端之上（页面坐标 y<0，正常滚动下不可见），
          所以第一帧画面是空的。随后 r 由负涨到 L0，卡片就是从上往下真正「掉进画面」，
          吊带跟着一起下来（a0y 仍钉在锚点，卡片在上方时整条带子也在画外，看不到）。
       参数（L0=208、卡片高 492 时）：
         EN_D0 = 700    起手在静息位上方 700px（卡片底边在页顶上方 40px ⇒ 画面里彻底没有）
         EN_G  = 2400   沿绳加速度（约真实重力 1/3）⇒ 0.76s 落到底、落底速度 1830px/s
         EN_RAMP/EN_VIN 最后 130px 是「带子绷紧」段：速度被拉到 470px/s 再交给弹簧，
                        位移连续、没有一帧跳变 —— 观感是「被绳子拽住」，不是「撞到隐形地板」
         EN_K  = 34     吊带回弹刚度 ω≈5.8 ⇒ 半个来回 0.54s（越软越像绳子）
         EN_C  = 2.2    阻尼 ζ≈0.19 ⇒ 每次弹起 ×0.55（首次拉长约 82px，之后 45/25/14…）
         EN_TH0/EN_OM0  起手摆角 0.09 + 角速度 -0.08 ⇒ 落定后摆幅约 5°、横向 ±18px
       整段：落 0.76s + 弹 ≈2.2s，左右摆 0.5s 内收住。
       #hold / #d / prefers-reduced-motion 下不播；#drop=<ms> 把入场冻结在第 ms 毫秒。 */
    var EN_D0 = 700, EN_G = 2400, EN_RAMP = 130, EN_VIN = 470;
    var EN_K = 34, EN_C = 2.2;
    /* 松手回弹段（postDrag）专用参数，见紧跟着的 18:1x「胶圈两翼」。
       ⚠️⚠️ 19:0x 起下面这段 EN_PW/EN_WP/EN_PC 与 EN_CD/EN_CDZ/EN_CDW/EN_KC 全部**已删除**，
          只留作死法记录：折起侧改成「带子松掉 = 自由飞行」（FL_G/FL_DRAG/FL_RAMP，见 19:0x 那段）。
       EN_PW/EN_WP/EN_PC = 绳子折起侧的渐硬项，**只当「卡片不许顶过夹子」的保险丝**，
       不当行程旋钮：折起量超过 EN_PC·L0 才开始顶，再顶 EN_WP 长度时刚度加到 (1+PW) 倍。
       ⚠️ 这一项的起点被否过三次，教训是「软墙的位置就是观感上的天花板」：
            EN_PC=0   （一越过静息位就顶）→ 上弹只有 50px ⇒「工作证顶部有个区块挡住往上弹」
            EN_PC=0.48（折起一半才顶）    → 上弹 99px，但拐点 r=89.6 就在行程里，
                                            卡片在离夹子还有 90px 的地方开始被「掐」住减速
                                            ⇒ 用户 18:0x：「很明显在这里一样有阈值」
            EN_PC=0.86（折到只剩 14px 才顶）→ 松手回弹全程碰不到拐点（实测最低 r=59），
                                            上下改由「弹簧+阻尼」连续减速，没有拐点。
                                            ⚠️ 但这是**按当时只弹 4 下**定的：18:1x 第一版两翼档要冲到
                                            r≈13，0.86 的起点 r=24 又落回路当中（压墙 84ms）——
                                            同一坑的第四次，所以提到 0.97（起点 r=5.2 = 夹子跟前）。
                                            终版把最低点收回 r=35，0.86 其实已经不碰了，但 0.97
                                            留的是「无论怎么拉都在路下」，不因再调旋钮而失效。
       实测（_404tune.cjs rad，松手 r=538.7/vr=−160/th=−70.9°）：
         PC=82px(0.48) → −97.5@496 → +41.9@958 → −14.6@1528 → +5.1@2094，最低 r=74
         PC=148px(0.86)→ −113.1@564 → +37.2@1142 → −13@1710 → +4.5@2278，最低 r=59
                                            ⇒ 17:1x 定版（就是下面 18:1x 的 A 侧，只弹 4 下、564ms 才到顶）
         左右逐项不变（32@678 → 15@1322 → 6.7@1960 → 2.7@2598）。 */
    /* 18:1x 松手段改成「胶圈两翼」——用户：反弹还是慢 + 回到固定位太快 ⇒ 要更快、更多下。
       一段比例阻尼动不了这两件事：ζ 同时决定「几下」和「第一下冲多深」。降 ζ 的扫法
       （ring 第 1 轮 144 组）全枪毙：下数到了 9，但 369px 的拉伸能量把卡片顶到 r=−50
       （卡顶 y=57，导航栏底 64.2）= 又撞回「顶部有东西挡住」。恒定加折叠侧阻尼（第 2 轮）
       也不行：第一下削住了，几像素的碎弹也被同一条阻尼秒停，「几下」永远上不去。
       真实胶圈的能量本来就是不对称吃掉的——绷着的下侧又脆又快，能量在折起来的上侧被带子自己吃掉：
         EN_KT = 1.3   拉伸侧刚度倍，ω 5.83→6.6 ⇒ 首次到顶 581ms→364ms（浏览器实测，离线 352ms）
         EN_CB = 0.35  拉伸侧阻尼（替掉旧 DR_C 那一档额外阻尼）⇒ 碎弹不再被秒停，
                       末次 >4px 从 2281ms→3381ms，拖到左右（2882ms）之后才收干净
         EN_CD/EN_CDZ/EN_CDW = 30/50/70  折起侧「深度门」耗能：折进 50px 才起步、再 70px 到满。
                       只削第一下的大冲量；后面几下的上弹都进不了这个窗口 ⇒ 越弹越小但一直在弹。
                       ⚠️ 18:4x 作废：这一档把顶点压到 r=35，夹子离导航栏那条线只剩 38px，
                          就是第五次「顶部有阈值」。换成 EN_KC 线性刚度 + CDZ=0 的起步阻尼。
                       ⚠️ 必须是「深度门 + 连续行程」，不能写成 x<−50 就 +30 的开关，
                          也不能写成不随深度收放的常量——那两条就是上面第 1/2 轮的死法。
       ⚠️ 第一版两翼档（KT=1.45/CD=18/CDZ=40）也是在这一行被否掉的：那组第一下冲到 r=13，
          深折 + 34~37° 大倾角撞在一起，卡片包围盒顶到 y=62.9 —— 导航栏底 64.2 之上
          赖了 4 帧 ≈60ms = 「顶部有东西挡住」第 5 次。改吃「深度门」把第一下的冲量
          换成「折得更早、削得更狠」：CD 18→30、CDZ 40→50、KT 1.45→1.3 ⇒ 最低 r 13→35（浏览器 40）、
          离线卡顶 58→67（浏览器 62.9→72.2，余量 8px），几下仍 6、首次到顶 352/364ms 反而更早。
       ⚠️ 同时把 EN_PC 从 0.86 提到 0.97：保险丝的起点 r=24 会在旧两翼档落在路当中，
          等于又立一堵被否过两次的软墙（17:1x 之后第 4 次踩同一个坑）。
          保险丝的起点必须在**正常回弹能到的最低点之下**，只留「卡片不许顶过夹子」这一件事。
       可见下数 4→6（松手拉伸 367/200/90px 三档都是 6 下，旧版只有 4/3/2；见 _404tune.cjs mild），
       全程压墙 0ms、最低 r=35（浏览器 40）远在夹子之下。
       ⚠️ 18:4x 复核：这句「远在夹子之下」是错的 —— 夹片顶边在卡孔上方 40.1px，
          r=35 时它离导航栏底只剩 38px（包围盒顶边离线 8px）= 第五次「顶部有阈值」的成因。
       门控在 postDrag ⇒ 入场（13:20 定版）与钟摆侧一寸未动（左右逐帧复核）。 */
    /* 18:4x 第五次「顶部有阈值」→ 定性改成定量，墙是**几何**的，不是阻尼：
       ① 用户那张截图量出来 = 第一下顶点（卡顶离导航栏底 ≈85px）。模型「导航栏底到卡顶 = r+42.5」
          ⇒ r≈42.5，正是上一版第一下顶点（离线 36.5 / 浏览器 40.3）。**对上了**：那张图不是入场也不是静止。
       ② 先怀疑「深度门阻尼 = 短行程硬刹」，于是把制动力拆开逐子步积分（_404tune.cjs wall）：
          上一版「速度掉一半走了多少行程 / 折到多深」= 112/135 = **0.83**，纯弹簧的理论值是 0.866
          ⇒ 减速本来就是弹簧主导的，没有硬刹；17:1x 那版反而只有 0.76。**假设否掉，别再往这条路上改。**
       ③ 真墙：织带钉在锚点 ayVp=127.2，导航栏底只有 64.2 ⇒ 锚点离天花板 63px。
          卡片上弹被「夹子顶到锚点」卡死（夹片占卡孔上方 17.5~40.1px），r 越小夹子越贴那条线，
          带子被挤成 63px 的一截 —— 上一版顶点夹子净空只有 r+2.5 = 38px，包围盒顶边离线 67 / 浏览器 72.2
          = 离那条线 8px。**弹得越高越像被那条线挡住**，所以每加一次行程就被否一次。
       ⇒ 旋钮换成「折起侧刚度」EN_KC：把顶点从 r=35 抬回 r=64，行程只短 20%（135→108px），
          但净空从 8px 变成 80px。它是**从静息位就生效的线性弹簧**，两侧力都在 r=L0 过零、
          没有起点没有拐点 ⇒ 不可能再长出一堵墙（前四次被否的都是「行程里有个起点」）。
          物理说法：带子挤成一团以后本身顶手，不是零刚度的软塌塌 —— 胶圈回弹的 signature 就是
          「收得快、弹得浅、连着抖好几下」。
       同一次改动把折叠侧耗能的「深度门」也拆了：EN_CDZ 50→0、EN_CDW 70→120、EN_CD 30→20，
          从折起第一像素就按行程线性起步 ⇒ 力全程连续可导，小碎弹照样进得来（几下 6→10）。
       离线 A/B（_404tune.cjs wall，满量程 367px 松手）：
         上一版 1.3/1/30/50  几下6  首到顶352ms  末次3406ms  包围盒卡顶 y=63（**越线**）
         本版   1.3/4.6/20/0 几下10 首到顶316ms  末次3652ms  包围盒卡顶 y=139（离导航栏 75px）
         制动比 0.81（弹簧主导）· 压墙 0ms · 轻拉 90px 与中等 200px 同样 8~9 下、压墙 0。
       门控仍在 postDrag ⇒ 入场（13:20 定版）与钟摆侧一寸未动。 */
    var EN_KT = 1.8, EN_CB = 3.8;   /* 「弓的张力」EN_KT；绷紧后的阻尼 EN_CB=3.8（19:3x：只回弹两下就挂住）。
                                       19:5x：EN_KT 2.6→1.8 与 FL_G 一起降（用户「落得太快、扯着费劲」），
                                       k/g 一起走 ⇒ 顶点高度几乎不变（卡顶 −66.0→−67.7）、上升/下落慢 21%/31%。 */
    /* 19:0x 第六次「顶部有东西挡着」⇒ 用户改口径：不要「别撞顶」，要「允许弹出上方区域，
       甚至完全弹出，像拉弓一样」。探针（_404probe.cjs above/ztest 两档）量到的事实：
       ① 卡片**没有被纵向裁剪**（r=−245 时卡顶 −145，祖先链只有 overflow-x:clip）；
       ② 真正的「挡住」= 站点导航栏 `HEADER.site-header` 是 `position:sticky; z-index:100`，
          卡片升到那条线**以后被它盖住**（elementsFromPoint 在 y=6/30/50 命中的全是 NAV），
          所以看起来就是「顶上有一块东西把它按回去了」；`.err404-scene{z-index:101}` 一抬就压过去（实测命中卡面子元素）。
       ③ 上一版「折不起量」是**阻尼**吃的：折起侧 EN_CD 到满档时 ζ≈0.71（20 / 2√(34·4.6)），
          顶点行程 106px 就再没能量往上 —— 那不是墙，但比墙还像墙。
       ⇒ 物理换成**绳子本来就该有的样子**：带子只能拉、不能压。
          `r ≥ L0` 仍是拉伸弹簧（EN_K·EN_KT + EN_CB，一寸未动）；
          `r < L0` 带子松了 ⇒ **没有恢复力**，卡片沿绳方向做自由飞行：
            · `FL_G·cos(th)` 只在「松掉以后的 FL_RAMP px」里线性起量 ⇒ 过静息位**加速度连续**，
              不会在 r=L0 那一点从 0 跳到 g（那才叫顿一下）；
            · `FL_DRAG·v·|v|` 二次阻力：静息处严格为 0（不碰冻结的静息指纹/入场），
              高速段吃能量 ⇒ 顶点自动收敛（v0→∞ 时也只会逼近 1/(2·FL_DRAG) px），
              所以既不用「软墙」也不用保险丝，行程里**一个起点都没有**。
          观感 = 拉弓松手：猛地抽回去 → 冲过静息位 → 升到导航栏之上/画面外 → 重力拽着回落 →
          带子再次绷紧再抽一下，振幅一轮轮自己收小。顶点在画面里还是画面外由**拉力**决定，不是我设的限位。
       ⚠️ 删掉的三个旋钮都是「行程里的墙」，别再写回来：EN_KC（折起侧线性刚度）、EN_CD/CDZ/CDW（深度门阻尼）、
          EN_PW/EN_WP/EN_PC（折起保险丝，拐点 r=5.2 现在正好在飞行段里）。
       离线扫参（_404tune.cjs pop，满量程 367px 松手，判据**反过来**：过线是目的）定版
       FL_G=2600 / FL_DRAG=0.0003 / EN_KT=2.3 / EN_CB=1.0（⚠️ 这组已被下面 ③ 取代，此处只留观感记录）：
         卡顶第一次冲到 **y=−103**（视口顶以上 103px，「弹出画外」）@408ms，
         越过导航栏底那条线 344ms、出画 236ms、**整块脱屏 0ms**（底边始终留在画面里，不像页面坏了）；
         上下连弹 11 下、周期 353ms、末次 >4px 3920ms；行程内**没碰任何数值下限（限=0ms）**。
       拉伸越猛冲得越高（能量 ∝ x²，非线性限位）：+200px 卡顶 52（过线 106ms）/ +90px 卡顶 68 / +40px 卡顶 50。
       浏览器复测（dx=−620 实拖，_stut_trace_fly19.json，判据同前）：
         卡顶最低 **y=−84.8@431ms**、越线 369ms、出画 252ms、几下 11、末次 3915ms、静息回 r=172.0；
         上一版（18:4x，_stut_trace_kc46.json）同一拖法 = 卡顶 **y=+142.4**、越线 **0ms**、几下 9、末次 3282ms
         ⇒ 「越线 0 → 369ms」「卡顶 142 → −85（越过视口顶 85px）」，左右端点逐帧**完全相同**
            （31.7@698 / −14.8@1332 / 6.6@1964 / −2.6@2598 / 0.6@3249）= 冻结项没动。
         ⚠️ 离线这次比浏览器**乐观 18px**（−103 vs −84.8；以前是悲观 4~5px）：浏览器松手那一帧
            已经带 vr=−427 的初速（离线 IC 只给 −250），但飞行段 th 转得更多、cos(th) 起量更早。
            换算别按老偏差符号来。
       门控仍在 postDrag ⇒ 入场（13:20 定版）与钟摆侧（G_EQ=4400）一寸未动。 */
    /* ③ 19:2x「这个重力有问题，需要修改」+「绳子应该在 header 那条线以下，反弹可以隐藏在 header 之外」。
       病是量出来的（浏览器 _stut_trace_fly19.json 与离线 g2600/dr0.0003/kt2.3/cb1.0 两个口径**完全对上**）：
         上升 212ms / 下落 270ms ⇒ sym=1.27；上穿静息位 vr=−2948 / 落回 +1590 ⇒ 一趟飞行只剩 54% 的速度。
         抛物线只有上半条是干净的，下去那段是羽毛 —— 用户看到的「重力不对」就是这个。
       病灶不止 FL_DRAG：离线把 FLD 设 0，vOut/vIn 也只回到 0.66，剩下的那口气是**飞行段一直挂着
       基线径向阻尼 EN_C=2.2**（松弛段没人改 cR，工牌等于在糖浆里飞）。二次阻力只是把它放大得更好笑。
       改法三条，都不碰冻结项：
         · **场景里只留一个 g**：FL_G 2600 → 4400 = 钟摆侧 G_EQ 同一个值（原来两套重力并存，
           上下和左右不是同一个世界，观感就是「飘」）。
         · **FL_DRAG 删掉**：工牌飞 0.3m，气动阻力可忽略；∝v² 那一项本来只是为了让顶点「自动收敛」
           才请回来的隐墙（顶点上限 = 1/(2·FLD)），现在高度改由拉伸侧储能决定 ⇒ 拉得越猛冲得越高，
           是能量关系，不是被阻力截掉的。
         · **飞行段用自己的阻尼 FL_C=0.2**，并且和重力共用 FL_RAMP=34px 那个起量窗做**连续过渡**
           （`cR = EN_C档·(1−w) + FL_C·w`，w=0 在静息位、w=1 折进 34px 以后）。
           ⚠️ 必须连续：硬切会在 r=L0 那一点留下 `(EN_C档−FL_C)·v ≈ 4400px/s²` 的力台阶 = 第六次「顶部有阈值」
           的同一种死法。改完 max|Δa| 从 4135 掉到 **1184 px/s²/ms**，比 19:0x 还平滑。
       拉伸侧阻尼档 1.0 → 先试回 EN_C=2.2（能量没有飞行段那口空气吃了，得在带子内部收），
         但浏览器实拖后用户立刻说「上晃太多、像不倒翁、垂直吊感很弱」⇒ 19:3x 定为 **EN_CB=3.8**、
         `EN_KT 2.3→2.6`：第一下照样冲出线（卡顶 −65，仍藏进 header），但看得见的来回只剩 2 次、
         2.3s 就挂住（A 19:2x：卡顶 −112、末尾 4.0s 还在 4px 抖）。
         ⚠️ 抬 EN_CB 只影响**绷紧段**（r>L0），第一下上冲在松弛段里、完全不吃它 ⇒ 不会重新变成「顶部有阻挡」。
       离线扫参（_404tune.cjs grav，IC=浏览器松手那一帧，判据：sym∈[0.92,1.12] + vOut/vIn≥0.85 +
       卡顶越过导航栏底那条线（藏进 header 是允许的）+ 越线≤500ms + 整块不脱屏 + ≥8 下 + 末次≤4.3s + 不碰数值下限）：
         A（19:0x） 卡顶 −89.5@414 上升212/下落270 sym1.27 v2948→1590(0.54) 跳变4135 越线370 几下11 末次3916
         B（本版） 卡顶 −111.3@422 上升222/下落224 **sym1.01** v2604→2451(**0.94**) **跳变1184** 越线388 几下12 末次4020 限0 脱屏0
         顶点序列 −167@400 / 0@1176 / 92@1884 / 136@2522（越弹越浅、间隔自己变短 = 真抛物线列，不是撞回来的）
         拉伸稳健性（+367/+200/+90/+40px）：几下 12/10/8/6、末次 4020/3298/2426/1748、限全部 0。
       悬空 446ms（上升 222 + 下落 224）是 4400px/s² 下 200px 冲程的**该有时长**，不是慢：
         「弹得高」和「干脆利落」在同一个 g 下是一件事，靠 EN_KT 换，不靠假阻力糊。
       ⚠️ 同一次改动把 19:0x 那两个「让卡片盖住导航栏」的写法撤了（CSS z-index 101→2、画布 TOPB 上抬删掉）：
          用户口径是**带子不许爬到 header 那条线以上，卡片飞上去可以藏进 header**。见 err404.css 与 measure()。 */
    /* ④ 19:4x「上下晃动速度有问题、一直在那个区域、上弹力量比往下大、像飘、没有垂直掉落感」。
       量出来两件事，都不是「再调一个阻尼」能解决的：
         ① 松弛段其实一直挂着 kEff=EN_K=34 的**压力弹簧**：下面 `var kEff = EN_K` 是默认值，
            `xT<0` 那个分支只改了 cR 和 g，从没把刚度清零。浏览器实测下落 a≈14,700
            = 34·130 + 4400·cos(th) —— 工牌不是落下来的，是被那根看不见的弹簧推下来的，
            所以顶点被截住、下落不加速、永远在锚点那一带转 = 用户说的「一直在那个区域」。
         ② g 只有 4400，而上冲是 88·x（最猛时 3 万）推的 ⇒「上弹力量比往下大」是字面事实。
       改法（仍然全部门控在 postDrag，入场/钟摆一寸不动）：
         · 松弛段 kEff = **0**：带子只能拉不能压，锚点上方就是抛体。
         · FL_G 4400 → **12000**：一屏 400px 的坠落 ≈ 260ms（4400 时要 430ms，是「飘」的来源）。
           卡顶高度由 v²/2g 定 ⇒ 挑 12000 正好让第一下和 19:3x **一模一样**（离线 −133 / 浏览器 −76），
           改的只是「怎么回来」。
         · **两段式接住**（FL_CB2=13）：松手那一冲还是 EN_CB=3.8（弓弦在放能量）；
           飞过第一个顶点以后换 13（真实挂绳接住下落中的工牌是撞击，restitution≈0.2，不是弹簧）。
           换档点取顶点（vr=0，阻尼力 c·v=0）⇒ 没有任何力台阶，jPk 3213（19:3x 是 7290）。
       离线（_404tune.cjs drop，IC=浏览器松手那一帧 367px 拖拽）：
         A 19:3x  卡顶 −76@422 顶点 −133 落深 352 悬空438 sym1.01 看得见8 几下10 末次3224
         B 本版   卡顶 −82@434 顶点 −133 落深 289 悬空464 sym1.00 **看得见3** 几下6 **末次1970**
         极值 −305@408（顶点）→ 117@720（落到底）→ −9@1186 → 14@1404 → −4.5 → 7.5（±10px 收尾）
       稳健性（+367/+200/+90/+40）：卡顶 −82/93/57/40、末次 1970/1756/1600/1526、看得见 3/3/3/2、限全 0。
       ⚠️ 19:5x 用户：「落得太快了，另外感觉扯着很费劲，下弹没几次怎么就忙着固定了？」
           = 19:4x 把「飘」反过来了：FL_G=12000 让下落只有 217ms，FL_CB2=13 一接就把振幅吃掉。
         扫参（_404tune.cjs drop）⇒ FL_G 12000→**7000**、EN_KT 2.6→**1.8**、FL_CB2 13→**7**。
         浏览器 A/B（_404probe.cjs stut -620，同一 IC）：
           19:4x 卡顶 −66.0@447 上升234/下落217 sym0.93 极值 −291/121/−13/17/7 末次1898
           19:5x 卡顶 −67.7@532 上升282/下落284 sym1.01 极值 −267/126/−29/33/−10/13/7 末次2931
         顶点高度守住、下落慢 31%、后几下的振幅翻倍；左右端点 31.7/14.8/6.6/2.6/0.6 逐帧未变。 */
    var FL_G = 7000, FL_C = 0.2, FL_RAMP = 34;
    /* 两段式接住的第二段：飞过顶点以后，绷紧段（r>L0）用这一档阻尼。
       1.7 倍的近静息加成保留（(1+0.7·max(0,1−xR/28))），所以落回静息位前会比半途更「黏」。
       19:5x 13→7：13 的 c·v 峰值 ~28,600px/s²，接住那一下「扯」得用户手疼；7 落到 ~15,400，
       同时把振幅留到第二、三下（看得见 3→7）⇒ 不再「忙着固定」。 */
    var FL_CB2 = 7;
    /* 织带「被挤出去」的拱量：带子没有压缩刚度，r 比静息短多少，中段就往外鼓多少。
       旧版只把「速度滞后弯曲」乘一个 slackK 系数 ⇒ 到顶点 om 变小、鼓包跟着塌掉，
       带子被画成一根短硬杆顶在工牌头上 = 用户说的「顶部有东西阻挡」。 */
    var SLACK_K = 0.46;
    /* 卡片绕卡孔的倾角：二阶跟随 A·om（有惯性、会过冲、**没有上限**）。
       旧版 0.26·tanh(om) 在 om 峰值 4.25 时 tanh=0.99997 ⇒ 完全饱和，实测
       rad−th 死死钉在 14.90°（=0.26rad 的渐近线）连续 27 帧 ≈ 432ms
       = 用户看到的「左右值写死、晃得非常不自然」。 */
    var LEAN_A = 0.062, LEAN_W = 13, LEAN_Z = 0.6;
    var EN_TH0 = 0.09, EN_OM0 = -0.08;
    var OM_DMP = 2.2;                  /* 黏性阻尼 ζ≈0.22（常态与入场共用，避免收尾「变档」） */
    var OM_FRIC = 0.2;                 /* 库仑摩擦 rad/s²：夹片转轴 + 空气 ⇒ 摆会在有限时间内**真的停下** */
    var FRIC_EPS = 0.03;               /* 摩擦的正则化窗（rad/s）：|om| 在此窗内线性收力，避免在 0 附近抖 */
    /* 钟摆等效重力。三档都被用户否过：
         2400 = 慢镜头（周期 1.68s、摆回竖直 0.67s）⇒「回弹太慢、不符合实际、喘不过气」
         6000 = 真实挂绳档（周期 1.10s、回正 0.28s）⇒「静止得有点快，回弹不如之前」
       4400 取中：周期 1.29s、回正 0.40s，每半个来回衰到 ~0.47（和 2400 那版的弹性观感一致），
       看得见 4 次来回摆，约 4.5s 完全静止。 */
    var G_EQ = 4400;

    /* 唯一的一套物理：绳长 r（上下）+ 摆角 th（左右） */
    function stepPhys(sdt) {
      /* 左右：吊绳钟摆。阻尼全程都在（不再有「振幅地板」），加上小角度摩擦 ⇒ 越晃越小、最后停住。
         只动阻尼/摩擦不动周期以外的量；等效重力 G_EQ 是全局同一个值 ⇒ 入场和常态不会「变档」。 */
      var dmp = (entAt !== null && entT < 2.6) ? 1.0 : OM_DMP;   /* 入场段放轻：不然左右还没荡开就被吃掉 */
      om += (-(G_EQ / L0) * Math.sin(th) - dmp * om) * sdt;
      /* 库仑摩擦：方向跟 om 相反、大小恒定。在 0 附近用 FRIC_EPS 线性收口（不是开关），
         所以既能在有限时间停下，又不会在过零点来回抖。 */
      om -= OM_FRIC * sdt * Math.max(-1, Math.min(1, om / FRIC_EPS));
      th += om * sdt;
      /* 上下：吊带被拉长的量 x = r - L0。
         下落段只加速（松手后自由下落），触到原长后交给弹簧；
         弹簧段的「最低点」是被绳子拽住，不是撞地反弹。 */
      if (entFall) {
        /* 掉落段：r 从 L0-EN_D0（负值）涨到 L0，卡片从画面外上方掉进来 */
        vr += EN_G * sdt; r += vr * sdt;
        /* 最后 EN_RAMP px 是「带子绷紧」段：把速度往 EN_VIN 收。用逐帧阻尼而不是直接赋值，
           位移完全连续，不会出现一帧的速度跳变；观感是掉到某处被带子拽住、减速后继续下坠。 */
        var over = r - (L0 - EN_RAMP);
        if (over > 0) {
          var uu = Math.min(1, over / EN_RAMP);
          vr += (EN_VIN - vr) * uu * 16 * sdt;
        }
        if (r >= L0) entFall = false;
      } else if (rFree) {
        /* 尾巴多一档阻尼：最后几下的 3~8px 碎抖不放掉会显得「磨叽」。
           ⚠️ 必须按「伸长的量」连续加，不能写成 |r-L0|<12 那种开关 —— 绳子每来回穿过
              一次静息位就被硬拽一次速度，慢停的路上正好卡两下（用户报的两次卡顿）。
              现在 0px→×1.7、28px 以上→×1 线性过渡，只动阻尼不动刚度，频率不变。 */
        var xR = Math.abs(r - L0);
        /* lite = 临界阻尼，不来回弹 */
        var cR = ANIM_LITE ? 2 * Math.sqrt(EN_K) : EN_C * (1 + 0.7 * Math.max(0, 1 - xR / 28));
        /* 松手回弹段：按振幅**连续**加一档阻尼（40px 以上给满）。
           ⚠️ 根因备忘：`rFree` 从入场起永久为 true，所以下面 `else if (!dragging)` 那档
              专门调过的「拖拽回弹弹簧(-95·x -10·vr)」其实**从来没跑到过**，改这里才有效。
              只加阻尼不改刚度 ⇒ 频率不变、不会「变档」；振幅回到 3px 内自动交回常态轻阻尼。
           ⚠️ 2026-11-01 15:1x 曾把这段换成「临界阻尼 ζ=1 + 刚度按振幅外扩 EN_K_DRAG」，
              用户看过连拍后要求**原样退回这一版手感**（只退回弹，其余修复保留）。别再自作主张改。
           ⚠️ 2026-11-01 16:5x：这一档原来是 **8.2**（= 40px 以上合计 ζ≈0.89，近临界），
              它把 366px 拉伸的能量在第一段来回就全吃干 —— 上下只弹 1 下（1266ms 就没振幅了），
              而左右摆到 2898ms ⇒ 用户看到「要停的地方只剩左右晃」。降到 DR_C=2.0，
              上下改由下面的「绳子折起」渐硬项 EN_PW/EN_WP 兜住能量。
              ⚠️ 这一档 DR_C 已在 18:1x 被「胶圈两翼」（EN_KT/EN_CB/EN_CD）替掉，留着这段只为记死法。 */
        var kEff = EN_K, gEff = 0;
        if (postDrag) {
          /* 19:0x「带子只能拉不能压」：拉伸段是弹簧，折起段改成自由飞行（见常量区 ③）。
             19:2x 补上**接头的连续性**：重力起量窗和阻尼换档窗用同一个 w（0 在静息位、1 在折进
             FL_RAMP px 以后），所以穿过 r=L0 时力、加速度、阻尼三样都连续 ——
             前六次「顶部有阈值」的判据始终是同一个：**行程里不许出现任何起点/拐点/台阶**。 */
          var xT = r - L0;
          if (xT >= 0) {
            kEff = EN_K * EN_KT;
            /* 19:3x 把 EN_CB 请回来：弦绷着那一段的阻尼必须比常态大得多
               （EN_C=2.2 → 3.8），否则第一下冲得高、后面还要晃十几下 = 用户说的「像不倒翁、吊感很弱」。
               19:4x 再分两段：飞过第一个顶点以后换成 FL_CB2（接住 = 撞击，不是弹簧，见常量区 ④）。
               两段之间在顶点换档（那里 vr≈0、阻尼力为 0）⇒ 换档本身不产生任何力台阶。 */
            if (!ANIM_LITE) {
              cR = (caught ? FL_CB2 : EN_CB) * (1 + 0.7 * Math.max(0, 1 - xR / 28));
              /* 同一档阻尼也要和飞行段连续：xT=0 处必须是 FL_C，不能是 1.7×CB。 */
              var wC = Math.min(1, xT / FL_RAMP);
              cR = cR * wC + FL_C * (1 - wC);
            }
          } else if (!ANIM_LITE) {
            /* 19:4x：真·自由飞行。以前这里只是「没给额外刚度」，kEff 仍停在 EN_K=34，
               等于锚点上方藏了一根压力弹簧（浏览器实测 a≈14,700）——卡片被推下来，不像落体。 */
            kEff = 0;
            var wT = Math.min(1, -xT / FL_RAMP);
            cR = cR * (1 - wT) + FL_C * wT;
            gEff = FL_G * Math.cos(th) * wT;
          }
          /* 交回常态只看绳子：钟摆侧现在全程同一套阻尼+摩擦，没有力挂在 postDrag 上，
             所以这里清标志不会在摆动尾巴上造成任何突变（15:4x 那版要判 amp 是因为额外阻尼挂在它上面）。 */
          if (xR < 3 && Math.abs(vr) < 20) postDrag = false;
        }
        vr += (-kEff * (r - L0) - cR * vr + gEff) * sdt; r += vr * sdt;
      } else if (!dragging) {
        /* 拖拽松手后的回弹（沿用原参数，别混进入场手感里） */
        vr += (-95 * (r - L0) - 10 * vr) * sdt; r += vr * sdt;
      }
      /* 「第一个顶点」= 工牌飞到锚点上方、径向速度由负转正那一刻。松手后的两段式接住在这里换档。 */
      if (!caught && vrPrev < 0 && vr >= 0 && r < L0) caught = true;
      vrPrev = vr;
    }

    /* 入场动画档位（后台「404 页面 → 入场动画」）：
         full 卡片从画面上方掉进来 + 吊带拉长回弹 + 永久慢晃
         lite 仍从上方掉进来，但吊带用临界阻尼一次稳住，不来回弹
         off  不播入场，首帧就落在静息位 */
    var ANIM_MODE = CONF.animation || 'full';
    var ANIM_LITE = ANIM_MODE === 'lite';
    function startDrop() {
      if (reduced || hold || demo || freezeFp !== null || ANIM_MODE === 'off') return;
      /* 140ms 延迟只会等字体/布局量完尺寸；期间卡片停在画面外上方，页面是空的 */
      entAt = performance.now() + 140;
      entT = 0; entFall = true; rFree = true; entFrozen = false;
      entDone = false;
      /* 起手 r 为负 = 卡片位于锚点上方 EN_D0 px，整块在页面顶端之外 */
      r = L0 - EN_D0; vr = 0;
      th = EN_TH0; om = EN_OM0;
      strapDirty = true;
      if (dropFreeze !== null) {
        /* 深链 #drop=<ms>：以固定步长把入场跑到指定毫秒后冻结（验图用） */
        var tEnd = dropFreeze / 1000, EPS = 1 / 240;
        for (var tt = 0; tt < tEnd; tt += EPS) stepPhys(EPS);
        entFrozen = true;
        /* 冻结帧也要判一次「已收住」：主循环的闩锁在冻结态不会再触发，
           不补这一步，#drop=6000 这类验图会一直停在「入场中」（没有常态倾斜、微风也不给） */
        if (tEnd > 2.2 && Math.abs(r - L0) < 3 && Math.abs(vr) < 40) {
          entDone = true; entDoneAt = performance.now() - 600;
        }
      }
    }

    window.__badgeDebug = function () {
      return JSON.stringify({ dragging: dragging, th: +th.toFixed(3), r: +r.toFixed(1), L0: L0,
        lean: +leanS.toFixed(3), rad: +radQ.toFixed(3), swiv: +swiv.toFixed(3),
        entT: +entT.toFixed(2), entFall: entFall ? 1 : 0, vr: +vr.toFixed(1), om: +om.toFixed(3),
        bul: +dbgBul.toFixed(1), bulDir: +bulDir.toFixed(2), slack: +dbgSlack.toFixed(1),
        tang: +dbgTang.toFixed(0),
        sceneH: scene.offsetHeight, cardBottom: CH,
        cx: +(ax + Math.sin(th) * r).toFixed(1), cy: +(ay + Math.cos(th) * r).toFixed(1),
        ax: +ax.toFixed(1), ay: +ay.toFixed(1) });
    };
    /* 探针用：画出来的织带相对两端连线的最大侧向偏离（px，带符号）。
       >0 = 往 +法线（行进方向左手侧）鼓。只读，不参与渲染。 */
    window.__strapDebug = function () {
      if (N < 2) return '{}';
      var dx = PX[N] - PX[0], dy = PY[N] - PY[0], L = Math.hypot(dx, dy) || 1;
      var nx = -dy / L, ny = dx / L, best = 0, bi = 0;
      for (var i = 0; i <= N; i++) {
        var d = (PX[i] - PX[0]) * nx + (PY[i] - PY[0]) * ny;
        if (Math.abs(d) > Math.abs(best)) { best = d; bi = i; }
      }
      return JSON.stringify({ dev: +best.toFixed(1), at: bi / N, chord: +L.toFixed(1), total: +TOTAL.toFixed(1) });
    };
    requestAnimationFrame(loop);

    /* 深链：#d=1 演示拉拽；#hold=th,r 冻结；#f=1 背面；#fp=0..1 冻结翻转进度 */
    var hsh = location.search + location.hash;
    if (/[?&#]d=1/.test(hsh)) demo = true;
    var hm = /hold=([-0-9.]+),([-0-9.]+)/.exec(location.hash);
    if (hm) hold = [parseFloat(hm[1]), parseFloat(hm[2])];
    var dpm = /drop=([0-9.]+)/.exec(location.hash);
    if (dpm) dropFreeze = parseFloat(dpm[1]);
    if (/[?&#]f=1/.test(hsh)) { showFace(1); badge.classList.add('is-flipped'); }
    var fm = /fp=([0-9.]+)/.exec(location.hash);
    if (fm) {
      var pp = parseFloat(fm[1]);
      var kk = Math.max(0.012, Math.abs(Math.cos(Math.PI * pp)));
      var sxfp = 'scaleX(' + kk.toFixed(4) + ')';
      flipEl.style.transform = sxfp;
      /* 卡扣不再直接设 transform（它现在是卡片同级元素，得带上卡片同款变换）；
         这里只记录冻结系数，由主循环统一合成，保证与卡面同步。 */
      freezeFp = kk;
      flipK = kk; strapDirty = true;
      if (pp >= 0.5) showFace(1);
    }
    /* 入场动画放在深链解析之后：带 #hold / #d / #f 时画面要静止 */
    startDrop();
  }

  /* ================= 初始化 ================= */
  var q = {};
  location.hash.replace(/^#/, '').split('&').forEach(function (kv) {
    if (!kv) return; var p = kv.split('='); q[p[0]] = p[1];
  });
  var initIdx = (q.m !== undefined && q.m !== 'random') ? parseInt(q.m, 10) : 'random';
  /* 后台「404 页面 → 固定展示成员」：按名字或 QQ 匹配，匹配不到退回随机；
     「每次随机换人」关闭时固定展示第一位。 */
  if (initIdx === 'random' && CONF.memberName) {
    var wantName = String(CONF.memberName).trim().toLowerCase();
    for (var mi = 0; mi < MEMBERS.length; mi++) {
      if (String(MEMBERS[mi].name || '').toLowerCase() === wantName ||
          String(MEMBERS[mi].qq || '').toLowerCase() === wantName) { initIdx = mi; break; }
    }
  }
  if (initIdx === 'random' && CONF.randomMember === false) initIdx = 0;
  if (q.nm) {
    /* 预览用：临时替换名字，验证超长名字的排版 */
    if (initIdx === 'random') initIdx = 0;
    var _i = (parseInt(initIdx, 10) || 0) % MEMBERS.length;
    /* 名字来自 location.hash，可能是畸形百分号编码（如 100%、%）：
       decodeURIComponent 会抛 URIError，一旦冒泡就会中断整段初始化，
       让后面的 __badgeSetMember / initBadge 全都不执行。这里按原文兜底。 */
    var _nm = q.nm.replace(/[+]/g, ' ');
    try {
      _nm = decodeURIComponent(_nm);
    } catch (_e) {
      /* 保留未解码的原始串 */
    }
    MEMBERS[_i] = Object.assign({}, MEMBERS[_i], { name: _nm });
  }
  window.__badgeSetMember(initIdx);
  if (q.t === 'dark' || q.t === 'light') {
    root.setAttribute('data-theme', q.t);
    root.setAttribute('data-color-scheme', q.t);
  }
  initBadge();

  /* 底部提示：点击随机调出一位成员，并翻到左边工牌的档案面（联动，非成员选择） */
  (function () {
    var tip = document.getElementById('fwTip');
    if (tip) tip.addEventListener('click', function () {
      if (typeof window.__badgeSetMember === 'function') window.__badgeSetMember('random');
      var badge = document.getElementById('badge');
      var onBack = badge && badge.classList.contains('is-flipped');
      if (!onBack && typeof window.__badgeFlip === 'function') window.__badgeFlip();
    });
  })();

})();
