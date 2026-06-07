# Fix Tracking

## 2026-05-12

- Fixed: `page-transition.js` — 添加末尾自动初始化，页面切换动画现已生效。
- Fixed: `scroll-animations.js` — 添加末尾自动初始化，滚动入场动画（reveal 效果）现已生效。
- Fixed: `typewriter.js` — 添加 `initTypewriters()` 自动调用，`[data-typewriter]` 打字机效果现已生效。
- Fixed: `lenis-scroll.js` — 添加末尾自动初始化，桌面端平滑滚动现已生效。
- Done: `main.js` — 添加废弃标记注释，说明各模块初始化已迁移至各自文件末尾。

根因：以上4个模块的初始化代码只存在于 `src/main.js` 的 `App.init()` 中，
但 `main.js` 不在 `scripts/build.js` 的复制列表中，导致从未被部署执行。

## 2026-04-28

- Done: removed the unused `main_js` build output path from Vite and added stale asset cleanup in `scripts/build.js`.
- Done: fixed duplicate code-copy controls on post pages by letting `post-page.js` own post copy behavior.
- Done: improved post lightbox interaction with `Esc` close support.
- Done: changed plugin initialization to support multiple containers, lazy hydration, and request caching.
- Done: cleaned temporary workspace leftovers that were not part of the shipping theme.

## Follow-up

- Review whether the legacy `src/main.js` entry should be archived or deleted after confirming no one still depends on it locally.
- Continue moving large inline scripts/styles out of template files where it reduces page complexity without breaking Halo template ergonomics.
