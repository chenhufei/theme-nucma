function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function textToHtml(value) {
  return esc(value).replace(/\r?\n/g, '<br>');
}

function normalizePluginName(name) {
  const raw = String(name || '').trim().toLowerCase();
  const aliasMap = {
    photo: 'photos',
    moment: 'moments',
    friends: 'links',
    friend: 'links',
    'friend-links': 'links',
    'friend-links-plugin': 'links'
  };

  return aliasMap[raw] || raw;
}

function resolveArray(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

function formatTime(value) {
  if (!value) return '';

  try {
    return new Date(value).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function createEmpty(message) {
  return `<p class="theme-empty-text text-sm">${esc(message)}</p>`;
}

const pluginApiCandidates = {
  'bilibili-bangumi': [
    '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginBilibiliBangumiPlugin/bangumis',
    '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginBangumi/bangumis',
    '/apis/bangumi.plugin.halo.run/v1alpha1/bangumis'
  ],
  'steam-games': [
    '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginSteamGames/games',
    '/apis/steam.plugin.halo.run/v1alpha1/games'
  ],
  gallery: [
    '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginPhotos/photos',
    '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginGallery/photos',
    '/apis/photos.plugin.halo.run/v1alpha1/photos'
  ],
  photos: [
    '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginPhotos/photos',
    '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginGallery/photos',
    '/apis/photos.plugin.halo.run/v1alpha1/photos'
  ],
  moments: [
    '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginMoments/moments',
    '/apis/moment.halo.run/v1alpha1/moments',
    '/apis/api.halo.run/v1alpha1/moments'
  ],
  links: [
    '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginLinks/links',
    '/apis/core.halo.run/v1alpha1/links',
    '/api/links'
  ],
  members: [
    '/apis/api.plugin.halo.run/v1alpha1/plugins/PluginMembers/members',
    '/apis/anonymous.member.plugin.halo.run/v1alpha1/members',
    '/apis/member.plugin.halo.run/v1alpha1/members'
  ]
};

class PluginAdapter {
  constructor() {
    this.adapters = new Map();
    this.requestCache = new Map();
  }

  register(pluginName, adapter) {
    this.adapters.set(normalizePluginName(pluginName), adapter);
  }

  get(pluginName) {
    return this.adapters.get(normalizePluginName(pluginName));
  }

  async fetchPluginData(pluginName, apiUrl) {
    const normalizedName = normalizePluginName(pluginName);
    const candidates = [apiUrl, ...(pluginApiCandidates[normalizedName] || [])]
      .filter(Boolean)
      .map((url) => String(url).trim())
      .filter((url, index, all) => all.indexOf(url) === index);

    let lastError = null;

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          lastError = new Error('Response is not JSON');
          continue;
        }

        const data = await response.json();
        return { data, url };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(`No available API for ${normalizedName}`);
  }

  async initPlugin(pluginName, container, apiUrl) {
    const normalizedName = normalizePluginName(pluginName);
    const adapter = this.get(normalizedName);
    if (!adapter || !container) return;

    const cacheKey = `${normalizedName}::${String(apiUrl || '').trim()}`;

    try {
      let request = this.requestCache.get(cacheKey);

      if (!request) {
        request = this.fetchPluginData(normalizedName, apiUrl);
        this.requestCache.set(cacheKey, request);
        setTimeout(() => this.requestCache.delete(cacheKey), 5 * 60 * 1000);
      }

      const { data } = await request;
      adapter.render(data, container);
      container.dataset.pluginInitialized = 'true';
    } catch (error) {
      this.requestCache.delete(cacheKey);
      container.innerHTML = createEmpty('内容加载失败');
      container.dataset.pluginInitialized = 'failed';
    }
  }
}

class BilibiliBangumiAdapter {
  getStatusClass(status) {
    const value = String(status || '').toLowerCase();

    if (value.includes('已') || value.includes('完') || value.includes('completed')) {
      return 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900';
    }

    if (value.includes('在') || value.includes('watching') || value.includes('progress')) {
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    }

    if (value.includes('搁') || value.includes('pause') || value.includes('hold')) {
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300';
    }

    return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300';
  }

  getStatusText(status) {
    return String(status || '想看');
  }

  render(data, container) {
    const items = resolveArray(data, ['items', 'bangumi', 'data']);

    if (!items.length) {
      container.innerHTML = createEmpty('暂无追番记录');
      return;
    }

    container.innerHTML = `
      <div class="bangumi-grid grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        ${items.map((item) => {
          const title = item?.title || item?.name || '未命名番剧';
          const cover = item?.cover || item?.images?.large || item?.image || '';
          const rating = typeof item?.rating === 'object' ? item.rating?.score : item?.rating;
          const summary = item?.summary || item?.description || item?.eps?.[0]?.long_title || '暂无简介';
          const episodes = item?.total_episodes || item?.eps?.length || item?.episodes || 0;

          return `
            <article class="nucma-card-glass rounded-xl overflow-hidden">
              <div class="aspect-[3/4] overflow-hidden relative" style="background: rgba(var(--color-text), 0.04);">
                ${cover ? `<img src="${esc(cover)}" alt="${esc(title)}" loading="lazy" class="w-full h-full object-cover">` : ''}
                ${rating ? `
                  <div class="absolute top-2 right-2 rounded-full bg-yellow-500 px-2 py-1 text-xs font-bold text-white">
                    ${esc(rating)}
                  </div>
                ` : ''}
              </div>
              <div class="p-4">
                <h3 class="mb-1 line-clamp-2 font-semibold theme-text-strong">${esc(title)}</h3>
                <p class="mb-3 text-xs theme-text-muted line-clamp-3">${esc(summary)}</p>
                <div class="flex items-center justify-between text-xs theme-text-soft">
                  <span>${esc(episodes)} 集</span>
                  <span class="rounded-full px-2 py-0.5 ${this.getStatusClass(item?.status)}">
                    ${esc(this.getStatusText(item?.status))}
                  </span>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }
}

class SteamGamesAdapter {
  render(data, container) {
    const games = resolveArray(data, ['items', 'games', 'data']);

    if (!games.length) {
      container.innerHTML = createEmpty('暂无游戏记录');
      return;
    }

    container.innerHTML = `
      <div class="steam-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        ${games.map((game) => {
          const name = game?.name || '未命名游戏';
          const cover = game?.header_image || game?.img_icon_url || game?.image || '';
          const playHours = game?.playtime_forever ? Math.floor(Number(game.playtime_forever) / 60) : 0;

          return `
            <article class="nucma-card-glass rounded-xl overflow-hidden">
              <div class="aspect-[3/2] overflow-hidden relative" style="background: rgba(var(--color-text), 0.04);">
                ${cover ? `<img src="${esc(cover)}" alt="${esc(name)}" loading="lazy" class="w-full h-full object-cover">` : ''}
                ${playHours ? `
                  <div class="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                    ${esc(playHours)} 小时
                  </div>
                ` : ''}
              </div>
              <div class="p-3">
                <h3 class="line-clamp-2 text-sm font-semibold theme-text-strong">${esc(name)}</h3>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }
}

class LinksAdapter {
  normalizeGroups(data) {
    const source = resolveArray(data, ['items']);

    if (source.length && source.some((item) => Array.isArray(item?.links))) {
      return source
        .map((group) => ({
          name: group?.spec?.displayName || group?.displayName || group?.metadata?.name || '',
          links: Array.isArray(group?.links) ? group.links : []
        }))
        .filter((group) => group.links.length > 0);
    }

    const flatLinks = source.length ? source : resolveArray(data?.links || data?.data || [], []);
    return flatLinks.length ? [{ name: '', links: flatLinks }] : [];
  }

  renderCard(link) {
    const spec = link?.spec || link || {};
    const title = spec.displayName || spec.name || spec.title || '未命名链接';
    const description = spec.description || spec.summary || '';
    const logo = spec.logo || spec.icon || '';
    const href = spec.url || spec.link || '#';

    return `
      <a href="${esc(href)}"
         target="_blank"
         rel="noopener noreferrer"
         class="plugin-inline-card link-card">
        <div class="link-card-logo">
          ${logo ? `
            <img src="${esc(logo)}" alt="${esc(title)}" loading="lazy"
                 style="width:48px;height:48px;object-fit:cover;display:block;">
          ` : `
            <span class="nucma-icon-circle" style="width:48px;height:48px;">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
            </span>
          `}
        </div>
        <div style="flex:1;min-width:0;overflow:hidden;">
          <div class="link-card-name">${esc(title)}</div>
              <div class="link-card-desc">${esc(description || '暂无说明')}</div>
        </div>
        <svg class="link-card-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
      </a>
    `;
  }

  render(data, container) {
    const groups = this.normalizeGroups(data);

    if (!groups.length) {
      container.innerHTML = createEmpty('暂无链接内容');
      return;
    }

    container.innerHTML = groups.map((group) => `
      <section class="plugin-page-stack">
        ${group.name ? `
          <header class="plugin-page-header">
            <h3 class="text-lg font-semibold theme-text-strong">${esc(group.name)}</h3>
          </header>
        ` : ''}
        <div class="plugin-cards-grid">
          ${group.links.map((link) => this.renderCard(link)).join('')}
        </div>
      </section>
    `).join('');
  }
}

class GalleryAdapter {
  resolveImages(data) {
    return resolveArray(data, ['items', 'images', 'photos', 'data']);
  }

  setupImagePreview(container) {
    container.querySelectorAll('[data-image-src]').forEach((card) => {
      card.addEventListener('click', () => {
        const src = card.dataset.imageSrc;
        const title = card.dataset.imageTitle || '';

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/92 p-4';
        overlay.innerHTML = `
          <img src="${esc(src)}" alt="${esc(title)}" class="max-w-[92vw] max-h-[92vh] object-contain rounded-lg">
          ${title ? `<div class="absolute bottom-4 left-0 right-0 px-4 text-center text-sm font-medium text-white">${esc(title)}</div>` : ''}
          <button type="button" class="absolute top-4 right-4 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/16">关闭</button>
        `;

        const cleanup = () => {
          overlay.remove();
          document.body.style.overflow = '';
          document.removeEventListener('keydown', handleKeydown);
        };

        const handleKeydown = (event) => {
          if (event.key === 'Escape') cleanup();
        };

        overlay.querySelector('button').addEventListener('click', cleanup);
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) cleanup();
        });

        document.body.style.overflow = 'hidden';
        document.body.appendChild(overlay);
        document.addEventListener('keydown', handleKeydown);
      });
    });
  }

  render(data, container) {
    const images = this.resolveImages(data);
    const isMasonry = data?.layout === 'masonry';

    if (!images.length) {
      container.innerHTML = createEmpty('暂无图片内容');
      return;
    }

    const gridClass = isMasonry
      ? 'columns-1 gap-4 sm:columns-2 lg:columns-3'
      : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

    container.innerHTML = `
      <div class="${gridClass}">
        ${images.map((image) => {
          const src = image?.url || image?.src || image?.image || image?.spec?.url || '';
          const title = image?.title || image?.name || image?.spec?.displayName || '';

          return `
            <div class="${isMasonry ? 'mb-4 break-inside-avoid' : ''}">
              <article class="nucma-card-glass rounded-xl overflow-hidden cursor-pointer"
                       data-image-src="${esc(src)}"
                       data-image-title="${esc(title)}">
                <div class="${isMasonry ? 'w-full' : 'aspect-[4/3]'} overflow-hidden" style="background: rgba(var(--color-text), 0.04);">
                  ${src ? `<img src="${esc(src)}" alt="${esc(title)}" loading="lazy" class="w-full ${isMasonry ? '' : 'h-full'} object-cover">` : ''}
                </div>
                ${title ? `
                  <div class="p-3">
                    <h3 class="line-clamp-1 text-sm font-medium theme-text-strong">${esc(title)}</h3>
                  </div>
                ` : ''}
              </article>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.setupImagePreview(container);
  }
}

class MomentsAdapter {
  render(data, container) {
    const moments = resolveArray(data, ['items', 'moments', 'data']);

    if (!moments.length) {
      container.innerHTML = createEmpty('暂无动态内容');
      return;
    }

    container.innerHTML = `
      <div class="moments-grid grid grid-cols-1 gap-6">
        ${moments.map((moment) => {
          const author = moment?.owner?.displayName || moment?.author || moment?.user?.name || '匿名用户';
          const avatar = moment?.owner?.avatar || moment?.avatar || moment?.user?.avatar || '';
          const content = moment?.content?.raw || moment?.content || moment?.text || '';
          const media = resolveArray(moment?.images || moment?.media || [], []);
          const tags = resolveArray(moment?.tags || moment?.hashtags || [], []);

          return `
            <article class="nucma-card-glass rounded-2xl p-6">
              <div class="mb-4 flex items-start gap-4">
                ${avatar ? `<img src="${esc(avatar)}" alt="${esc(author)}" class="h-12 w-12 rounded-full object-cover">` : '<span class="nucma-icon-circle h-12 w-12"></span>'}
                <div class="min-w-0 flex-1">
                  <h3 class="font-semibold theme-text-strong">${esc(author)}</h3>
                  <time class="text-xs theme-text-soft">${esc(formatTime(moment?.creationTime || moment?.timestamp || moment?.createdAt))}</time>
                </div>
              </div>

              <div class="mb-4 max-w-none prose theme-text-muted">${textToHtml(content)}</div>

              ${media.length ? `
                <div class="mb-4 grid grid-cols-2 gap-2">
                  ${media.slice(0, 4).map((item) => {
                    const src = item?.url || item;
                    return `<img src="${esc(src)}" alt="" class="h-40 w-full rounded-lg object-cover">`;
                  }).join('')}
                </div>
              ` : ''}

              ${tags.length ? `
                <div class="flex flex-wrap gap-2">
                  ${tags.map((tag) => `
                    <span class="rounded-full px-2 py-1 text-xs" style="background: rgba(var(--color-accent), 0.08); color: rgb(var(--color-accent));">
                      #${esc(tag?.name || tag)}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
            </article>
          `;
        }).join('')}
      </div>
    `;
  }
}

class MembersAdapter {
  normalizeMembers(data) {
    const source = resolveArray(data, ['items']);

    if (source.length && source.some((item) => Array.isArray(item?.members))) {
      return source.flatMap((group) => group?.members || []);
    }

    return source.length ? source : resolveArray(data, ['members', 'data']);
  }

  render(data, container) {
    const members = this.normalizeMembers(data);

    if (!members.length) {
      container.innerHTML = createEmpty('暂无成员内容');
      return;
    }

    container.innerHTML = `
      <div class="plugin-cards-grid">
        ${members.map((member) => {
          const spec = member?.spec || member || {};
          const avatar = spec.avatar || '';
          const name = spec.displayName || spec.username || spec.name || '匿名成员';
          const meta = spec.school || spec.bio || spec.description || '';
          const href = spec.qqFriendLink || spec.url || spec.website || '';
          const initial = esc(String(name).trim().slice(0, 1) || 'M');

          const content = `
            <div class="link-card-logo">
              ${avatar ? `
                <img src="${esc(avatar)}" alt="${esc(name)}" loading="lazy"
                     style="width:48px;height:48px;object-fit:cover;display:block;">
              ` : `
                <span class="nucma-icon-circle" style="width:48px;height:48px;">${initial}</span>
              `}
            </div>
            <div style="flex:1;min-width:0;overflow:hidden;">
              <div class="link-card-name">${esc(name)}</div>
              <div class="link-card-desc">${esc(meta || '暂无简介')}</div>
            </div>
            ${href ? `
              <svg class="link-card-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            ` : ''}
          `;

          return href
            ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="plugin-inline-card member-card">${content}</a>`
            : `<div class="plugin-inline-card member-card">${content}</div>`;
        }).join('')}
      </div>
    `;
  }
}

const pluginAdapter = new PluginAdapter();
pluginAdapter.register('bilibili-bangumi', new BilibiliBangumiAdapter());
pluginAdapter.register('steam-games', new SteamGamesAdapter());
pluginAdapter.register('gallery', new GalleryAdapter());
pluginAdapter.register('photos', new GalleryAdapter());
pluginAdapter.register('photo', new GalleryAdapter());
pluginAdapter.register('moments', new MomentsAdapter());
pluginAdapter.register('moment', new MomentsAdapter());
pluginAdapter.register('links', new LinksAdapter());
pluginAdapter.register('friends', new LinksAdapter());
pluginAdapter.register('members', new MembersAdapter());

window.PluginAdapter = PluginAdapter;
window.pluginAdapter = pluginAdapter;

function hydratePluginContainer(container) {
  if (!container) return;
  if (container.dataset.pluginInitialized === 'true' || container.dataset.pluginInitialized === 'pending') return;

  const pluginName = container.dataset.plugin;
  if (!pluginName || !pluginAdapter.get(pluginName)) return;

  container.dataset.pluginInitialized = 'pending';
  pluginAdapter.initPlugin(pluginName, container, container.dataset.apiUrl);
}

function initPluginContainers() {
  const containers = Array.from(document.querySelectorAll('[data-plugin]'));
  if (!containers.length) return;

  if (!('IntersectionObserver' in window)) {
    containers.forEach(hydratePluginContainer);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      hydratePluginContainer(entry.target);
    });
  }, {
    rootMargin: '160px 0px',
    threshold: 0.01
  });

  containers.forEach((container) => observer.observe(container));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPluginContainers, { once: true });
} else {
  initPluginContainers();
}
