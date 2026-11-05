/**
 * 12 号页脚（页脚样式「样式一」）的行为脚本。
 *
 * 由 layout.html 按 footer_style 条件加载；站点数据不写在脚本里，
 * 统一由模板内联注入 window.__NUCMA_FOOTER_12，这里只负责把页脚 DOM 重排出来。
 */
(function(){
  var CFG = window.__NUCMA_FOOTER_12 || {};
  var NAV=[ ["首页","/"], ["文章", CFG.archivesUri || '/archives'], ["分类", CFG.categoriesUri || '/categories'], ["成员","/members"] ];
  var SITE_LOGO = CFG.siteLogo || '/upload/1783587678472.png';
  var SITE_TITLE = CFG.siteTitle || '全国高校自媒体联盟';
  var JOIN_URL = CFG.joinUrl || '';
  var JOIN_TEXT = CFG.joinText || '加入我们';
  var JOIN_STYLE = CFG.joinStyle || 'solid';
  var JOIN_ICON = CFG.joinIcon || 'arrow';
  var JOIN_IMAGE = CFG.joinImage || '';
  var SITE_SUBTITLE = CFG.siteSubtitle || '';
  var SLOGAN_CFG = Object.prototype.hasOwnProperty.call(CFG, 'slogan') ? CFG.slogan : null;
  var FOOTER_COPYRIGHT = CFG.copyright || '';
  function boot(){
(function(){
  // 页脚文案全部来自站点与后台设置：之前版权兜底写死了 NUCMA 的品牌字串，
  // 非联盟站点照着这套页脚只能显示别人的名字。留空即不渲染，不再凭空编一句。
  // 没配置过 → 站点副标题优先，其次是主题默认标语；明确清空（空串）则不显示。
  var SLOGAN_TEXT = SLOGAN_CFG == null ? (SITE_SUBTITLE || '互动宣教 · 多元交流') : SLOGAN_CFG;
  var COPYRIGHT_TEXT = '\u00a9 ' + new Date().getFullYear() + ' ' + SITE_TITLE;
  var f=document.querySelector('footer.site-footer');
  if(!f||f.dataset.l) return; f.dataset.l='1';
  var inner=f.querySelector('.footer-inner');
  var cols=f.querySelectorAll('.footer-inner .footer-col');
  function el(tag,cls,txt){ var e=document.createElement(tag);
    if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
  function lnk(txt,href){ var a=el('a',null,txt); a.setAttribute('href',href);
    if(/^https?:/.test(href)){ a.setAttribute('target','_blank'); a.setAttribute('rel','noopener');
      a.appendChild(el('i',null,'↗')); } return a; }
  // 内置图标（Remix 风格的单色线性图标）：只用路径，颜色跟随按钮文字
  var ICONS={
    arrow:['end','M5 12h14M13 6l6 6-6 6'],
    plus:['start','M12 5v14M5 12h14'],
    'user-plus':['start','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M19 8v6M22 11h-6'],
    chat:['start','M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z'],
    mail:['start','M4 5h16v14H4zM4 7l8 6 8-6'],
    external:['end','M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3']
  };
  function svgIcon(key){
    var def=ICONS[key]; if(!def) return null;
    var ns='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','2'); svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round'); svg.setAttribute('aria-hidden','true');
    var path=document.createElementNS(ns,'path'); path.setAttribute('d',def[1]);
    svg.appendChild(path);
    return svg;
  }
  function makeJoinButton(){
    var style=/^(solid|outline|ghost|dark)$/.test(JOIN_STYLE)?JOIN_STYLE:'solid';
    var btn=el('a','n-btn l-btn l-btn--'+style);
    var jh=JOIN_URL||'/';
    btn.setAttribute('href',jh);
    if(/^https?:/.test(jh)){ btn.setAttribute('target','_blank'); btn.setAttribute('rel','noopener'); }
    var label=el('span',null,JOIN_TEXT||'加入我们');
    var def=ICONS[JOIN_ICON]||null;
    var icon=null;
    if(JOIN_IMAGE){ icon=el('img','l-btn-img'); icon.setAttribute('src',JOIN_IMAGE);
      icon.setAttribute('alt',''); icon.setAttribute('width','16'); icon.setAttribute('height','16'); }
    else if(def){ icon=svgIcon(JOIN_ICON); }
    var atStart=JOIN_IMAGE?false:(def?def[0]==='start':false);
    if(icon&&atStart){ btn.appendChild(icon); }
    btn.appendChild(label);
    if(icon&&!atStart){ btn.appendChild(icon); }
    return btn;
  }
  if(cols[0]){ cols[0].classList.add('f-brand');
    while(cols[0].firstChild) cols[0].removeChild(cols[0].firstChild);
    var brand=el('a','l-brand'); brand.setAttribute('href','/');
    var mark=el('span','l-mark'), lg=el('img');
    lg.setAttribute('src', SITE_LOGO); lg.setAttribute('alt','');
    lg.setAttribute('width','34'); lg.setAttribute('height','34');
    mark.appendChild(lg); mark.appendChild(el('span','l-word','NUCMA'));
    brand.appendChild(mark);
    brand.appendChild(el('div','l-name', SITE_TITLE));
    if(SLOGAN_TEXT) brand.appendChild(el('div','l-slogan', SLOGAN_TEXT));
    cols[0].appendChild(brand);
    cols[0].appendChild(makeJoinButton()); }
  var hasMenuNav=[].some.call(inner.querySelectorAll('.footer-nav a'),function(a){var h=a.getAttribute('href')||'';return h!==''&&h.charAt(0)!=='#';});
  if(!hasMenuNav){
    var navcol=el('div','footer-col');
    navcol.appendChild(el('div','footer-col-title','站点'));
    var navEl=el('nav','footer-nav');
    NAV.forEach(function(n){ navEl.appendChild(lnk(n[0],n[1])); });
    navcol.appendChild(navEl);
    if(cols[0]) cols[0].after(navcol);
  }
  [].forEach.call(cols,function(c){ var t=c.querySelector('.footer-col-title'); if(!t) return;
    if(/底部菜单/.test(t.textContent)) c.remove();
    else if(/关注/.test(t.textContent)) c.classList.add('l-qr'); });
  var wm=el('div','l-wm','NUCMA');
  var n=[].filter.call(inner.children,function(c){return c.classList&&c.classList.contains('footer-col')}).length;
  if(n>4){
    var desk='1.75fr ', tab='', i=0;
    while(i!==n-2){ desk+='1fr '; i++; }
    i=0; while(i!==n-2){ tab+='1fr '; i++; }
    inner.style.setProperty('--l-cols',desk+'max-content');
    inner.style.setProperty('--l-gap','28px');
    inner.style.setProperty('--l-cols-t',tab+'max-content');
    inner.style.setProperty('--l-gap-t','18px');
  }
  inner.appendChild(wm);
})();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
