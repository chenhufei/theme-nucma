/**
 * 33 号页脚（页脚样式「样式三」）的行为脚本。
 *
 * 由 layout.html 按 footer_style 条件加载；站点数据不写在脚本里，
 * 统一由模板内联注入 window.__NUCMA_FOOTER_33，这里只负责把页脚 DOM 重排出来。
 */
(function(){
  var CFG = window.__NUCMA_FOOTER_33 || {};
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
  // 与 12 号页脚同一套兜底：标语、版权都取自站点与后台设置，不再写死品牌字串。
  var SLOGAN_TEXT = SLOGAN_CFG == null ? (SITE_SUBTITLE || '互动宣教 · 多元交流') : SLOGAN_CFG;
  var COPYRIGHT_TEXT = '\u00a9 ' + new Date().getFullYear() + ' ' + SITE_TITLE;
  var f=document.querySelector('footer.site-footer');
  if(!f||f.dataset.v) return; f.dataset.v='1';
  var inner=f.querySelector('.footer-inner');
  function el(tag,cls,txt){ var e=document.createElement(tag);
    if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }
  function lnk(txt,href){ var a=el('a','n-a',txt); a.setAttribute('href',href||'#');
    if(/^https?:/.test(href||'')){ a.setAttribute('target','_blank'); a.setAttribute('rel','noopener'); }
    return a; }
  function card(title,anchors){ var d=el('div','fl-c'); d.appendChild(el('h4','n-cap',title));
    var i=0; while(i!==anchors.length){ d.appendChild(anchors[i]); i++; } return d; }
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
    if(!JOIN_URL) return null;
    var style=/^(solid|outline|ghost|dark)$/.test(JOIN_STYLE)?JOIN_STYLE:'solid';
    var btn=el('a','n-btn l-btn fl-cta l-btn--'+style);
    btn.setAttribute('href',JOIN_URL);
    if(/^https?:/.test(JOIN_URL)){ btn.setAttribute('target','_blank'); btn.setAttribute('rel','noopener'); }
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

  /* 后台「页脚菜单栏目」= 一张白卡；「自定义栏目内容」= 二维码。
     只有含真实链接（非空、非 # 锚点）的栏目才建卡，
     站点栏目没有菜单时整块回退到内置 NAV，不会渲染出空卡或死链。 */
  var cards=[], qrs=[], seen={};
  [].forEach.call(inner.querySelectorAll('.footer-col'),function(c){
    var t=c.querySelector('.footer-col-title'), name=t?t.textContent.trim():'';
    if(c.querySelector('.footer-custom-items')){
      [].forEach.call(c.querySelectorAll('.footer-custom-item'),function(it){
        var im=it.querySelector('img'), tx=it.querySelector('.footer-custom-text');
        if(im) qrs.push([im.getAttribute('src'), tx?tx.textContent.trim():'']);
      });
      return;
    }
    var as=[].slice.call(c.querySelectorAll('.footer-nav a')), real=[], i=0;
    while(i!==as.length){
      var h=(as[i].getAttribute('href')||'').trim();
      var label=(as[i].textContent||'').trim();
      if(h&&h.charAt(0)!=='#'&&label){ real.push([label,h]); }
      i++;
    }
    if(!real.length) return;
    var title=name||'导航';
    if(seen[title]){ seen[title].links=seen[title].links.concat(real); return; }
    var entry={title:title,links:real};
    seen[title]=entry;
    cards.push(entry);
  });
  if(!cards.length) cards.unshift({title:'站点',links:NAV});

  var cardsWrap=el('div','fl-cards'), k=0;
  while(k!==cards.length){
    var anchors=[], j=0;
    while(j!==cards[k].links.length){ anchors.push(lnk(cards[k].links[j][0],cards[k].links[j][1])); j++; }
    cardsWrap.appendChild(card(cards[k].title,anchors)); k++;
  }

  var fl=el('div','fl'); fl.appendChild(cardsWrap);
  var idw=el('div','fl-id');
  var logo=el('img'); logo.setAttribute('src', SITE_LOGO); logo.setAttribute('alt','NUCMA');
  var txt=el('div');
  var h=el('div','fl-h');
  h.appendChild(el('span',null,'NUCMA')); h.appendChild(el('i',null,'·'));
  h.appendChild(el('em',null,SITE_TITLE));
  txt.appendChild(h);
  if(SLOGAN_TEXT) txt.appendChild(el('div','fl-say', SLOGAN_TEXT));
  var cta=makeJoinButton();
  if(cta){ txt.appendChild(cta); }
  idw.appendChild(logo); idw.appendChild(txt);

  var body=el('div','fl-body'); body.appendChild(idw);
  if(qrs.length){
    var qs=el('div','fl-qrs'), n=0;
    while(n!==qrs.length){
      var item=el('div','fl-qr'), box=el('div','fl-qf'), im=el('img');
      im.setAttribute('src',qrs[n][0]); im.setAttribute('alt','');
      box.appendChild(im); item.appendChild(box);
      item.appendChild(el('span',null,qrs[n][1]||'扫码关注'));
      qs.appendChild(item); n++;
    }
    body.appendChild(qs);
  }
  fl.appendChild(body);

  var cp=f.querySelector('.footer-copyright'), icpA=f.querySelector('.footer-links a');
  var cpTxt=cp?(cp.textContent.replace(/\s+/g,' ').trim()||''):'';
  var base=el('div','fl-base');
  base.appendChild(el('span',null, cpTxt || FOOTER_COPYRIGHT || COPYRIGHT_TEXT));
  var right=el('span');
  if(icpA){ var ia=el('a',null,icpA.textContent.trim());
    ia.setAttribute('href',icpA.getAttribute('href')||'#'); ia.setAttribute('target','_blank');
    ia.setAttribute('rel','noopener'); right.appendChild(ia); }
  base.appendChild(right); fl.appendChild(base);

  while(inner.firstChild) inner.removeChild(inner.firstChild);
  inner.appendChild(fl);
})();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
