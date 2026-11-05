# 文章页设计规则（NUCMA 主题）

> 依据：Halo 官方文档《文章》（https://docs.halo.run/guide/use/posts.md ）、《模板编写 → 文章》（https://docs.halo.run/developer-guide/theme/template-variables/post.md ），
> 叠加 2026-11 用户逐条拍板的版式决定。**改文章页前先读这份，改完按第 6 节自检。**
> 适用范围：`templates/post.html` 及 `theme.yaml` 里 `customTemplates.post` 列出的全部文章模板（共 11 个）。

## 一、数据契约（只认 Halo 给的字段）

| 编号 | 规则 | 依据 |
|---|---|---|
| R1 | 标题取 `post.spec.title`；正文取 `post.content.content`（`th:utext`，不要二次转义） | 模板变量 post |
| R2 | **摘要必须双源**：`post.spec.excerpt.raw`（自定义摘要）为空时，回落 `post.status.excerpt`（最终生成摘要）。后台把「自动生成摘要」设为「是」时 `spec.excerpt.raw` 是空的，只读它会导致副标题与 SEO 描述整块消失 | 文章设置 → 自动生成摘要 |
| R3 | 发布时间统一取 `post.spec.publishTime`（后台可手动指定，未指定即实际发布时间），不取 `metadata.creationTimestamp` | 文章设置 → 发表时间 |
| R4 | 分类是**多值**（`post.categories`，可多个），一律 `th:each` 全量渲染；禁止只渲染 `categories[0]` 当「所属分类」，该写法仅允许用于分享卡等单值场景 | 文章设置 → 分类目录、分类管理 |
| R5 | 作者取 `post.owner`（ContributorVo）的 `displayName`。**暂不做链接**：主题没有 `templates/author.html`，`/authors/{name}` 会 404；Halo 提供 `owner.permalink`，等补上作者归档页再加链接 | 模板变量 → ContributorVo |
| R6 | 阅读量取 `post.stats.visit`，并受后台「显示阅读量」开关控制；`null` 时不输出「0 次阅读」 | 变量 stat |
| R7 | 封面取 `post.spec.cover`，受后台「显示文章封面」开关控制；缺失即整块不渲染，不留空框 | 文章设置 → 封面图 |
| R8 | 上下篇用 `postFinder.cursor(post.metadata.name)` 的 `hasPrevious()/hasNext()`，链接取 `status.permalink`，标题取 `spec.title` | Finder API |
| R9 | 正文内图片、图注、表格全部来自编辑器产出的 HTML，主题只做样式，不改 DOM 结构 | 正文 `th:utext` |

## 二、信息层级（已定版，不再另起风格）

顺序与对齐固定为：

```
默认分类 · 2026年11月 · 80 次阅读        ← 居中，12px，栏目为主题红
六安茶山书新卷，瓜片香中话振兴            ← 居中，28–40px，700
2025暑期社会实践皖美茶行之遇见六安瓜片      ← 居中，19–22px，600（标题第二行，不是灰字导语）
文 / Administrator                      ← 居中，12.5px，下面一道 30px 短红线
```

| 编号 | 规则 |
|---|---|
| R10 | 标题块（眉标 + 标题 + 副标题 + 署名）**整体居中**；署名下方 30px 短红线收尾，全部对齐同一中轴 |
| R11 | 副标题属于**标题层级**：字号 ≥ 主标题的 55%、字重 ≥ 600、与主标题间距 12–16px；不得做成 15px 灰色正文。自动摘要可能长达两百字，副标题**最多 3 行**（超出行尾截断），不许长成一段正文 |
| R12 | 日期精度由后台「发布日期精度」控制（年月日 / 仅年月 / 仅年份），文章页与侧栏「文章信息」必须同步，列表与归档页保持完整日期 |
| R13 | 头部「文」走 i18n 键 `post.bylinePrefix`；文末署名区的标题走后台「文末署名标题」`credit_label`（留空则整块不显示标题）。模板里不得写死「文」「作者」等中文 |
| R14 | 眉标只用文字分隔符「·」，不用胶囊、不用边框、不用背景块；栏目名用主题红 |
| R15 | 文末「署名」区左顶格，其左缘与正文左缘像素级重合；标签列（拍摄 / 通讯 / 调研…）右对齐成一列 |

## 三、排版与交互

| 编号 | 规则 |
|---|---|
| R16 | 正文行宽 30–38em，行高 1.8–1.95；图组上下间距 ≤ 1.2em、图注距图 6px（旧模板里另一份 `.prose img` 的 1.5em 外边距属历史包袱，禁止复活） |
| R17 | 图片不加圆角/阴影/悬停上浮，圆角 ≤ 2px；相邻两张横图自动并排（后台可关） |
| R18 | 选中文字用主题色（`color-mix(--primary 20%)`），**禁止浏览器默认蓝色** |
| R19 | 划线免登录、主题色、`underline`/`wash` 两档由后台切换；划线数据只存 localStorage，不上传服务端 |
| R20 | 「划线 / 取消划线 / 分享」浮条跟随选中位置；分享图 2160×2880，含**可扫码**的绝对 URL 二维码（相对 permalink 必须补 `location.origin`） |
| R21 | 上下篇并排两栏、中间竖线，900px 以下叠成上下两行左对齐；箭头用纯 CSS 边框绘制，**禁止用 `←`/`→` 字符**（字体缺字形会渲染成红线） |
| R22 | 断点跟主题口径：767 / 1023；小屏不出现横向滚动，标题不出现单字孤行 |
| R23 | Thymeleaf 里 `th:if`（优先级 300）先于 `th:with`（500）执行：**同元素上先 if 后 with，if 里取不到刚定义的变量**。需要中间变量时把 `th:with` 放到父元素（如 `post-header`），子元素只用 `th:if`/`th:text`（副标题就踩过这个坑，表现为整行消失） |

## 四、搜索引擎可见性（Google / Bing / 百度 / 360 / 搜狗 / 头条 / 微信）

| 编号 | 规则 |
|---|---|
| R24 | 标题要在三处一致：`<title>`（标题 + 站点名）、页面唯一 `<h1>`（纯标题）、结构化数据 `headline`（纯标题，不带站点名）。禁止用 CSS 隐藏 h1、禁止标题做成图片 |
| R25 | **正文必须服务端渲染**：`th:utext="${post.content.content}"` 直出，禁止改成 JS 拉接口再插入。正文文本、图注、`alt` 都要能在 `curl` 拿到的 HTML 里找到 |
| R26 | **署名三处都要有**：页面可见的「文 / 作者」、`<meta name="author">`、结构化数据 `author`（Person）。标签虽在页面隐藏（D1），数据仍要进 `keywords` |
| R27 | 每篇文章输出一份 **Article JSON-LD**（`templates/modules/seo.html :: article`）：headline、description、image、datePublished、dateModified、author、publisher、mainEntityOfPage、articleSection、keywords、inLanguage、url。`layout.html` 的通用 JSON-LD 已排除 article 页，**任何页面只允许出现一份 Article** |
| R28 | 分享卡片用 Open Graph：`og:type=article` + `article:published_time / modified_time / author / section / tag` + `og:locale`。`og:type` 只能由 layout 输出一次 |
| R29 | 所有对外 URL 必须是绝对地址（canonical、og:url、schema 的 `url` / `image` / `@id`）；Halo 给的 permalink 是相对路径，必须拼 `site.url` |
| R30 | 收录通道不归主题管：`/sitemap.xml`、`/robots.txt`、`/rss.xml` 由 Halo 提供，**不要 Disallow 全站**；主题只在 head 里补 RSS alternate 链接。上线后要去各站长平台提交 sitemap |
| R31 | 图片 `alt` 不得为空：封面用标题当 alt，正文图由编辑器的「图注/描述」写入；纯装饰元素用 `aria-hidden`，不占用可索引文本 |
| R32 | 日期格式用 ISO 8601 带冒号时区（`2026-11-03T13:12:57+08:00`）；`#temporals.formatISO` 输出的是 `+0800`（无冒号），改用 `#temporals.format` 分段拼接 |

> 成员公示、友情链接这两个**插件列表页**的 SEO 规则单独放在 `docs/listing-pages-seo.md`（逐条 `Person` / `WebSite` 结构化数据、名字三处可见、`?group=` 收窄），改那两页前读那一份。

## 五、有意偏离（用户已拍板，不要再改回去）

| 编号 | 决定 |
|---|---|
| D1 | **不渲染标签**。`post.tags` 在文章页完全不出现在 DOM（含 `#Halo` 类胶囊），后台「显示文章标签」开关已删。Halo 支持标签颜色/封面，本主题不使用 |
| D2 | **不渲染评论区**。Halo 的 `post.spec.allowComment` 目前无人消费，全站无评论模块（友链页、成员页除外）。恢复需用户明确要求 |
| D3 | 不展示「置顶」`pinned` 标识；置顶只影响列表排序 |
| D4 | 不做「分类即专题」条（曾实现后按用户要求整块删除，含 `series_*` 设置项与样式） |

## 六、自检清单（改完跑一遍）

1. `npm run build` —— 必须输出「主题检查通过：52 个模板」。
2. 断网/清缓存两种摘要都要试：后台把「自动生成摘要」切到「是」，副标题与 `<meta name="description">` 仍要有内容（R2）。
3. 一篇文章挂 2 个分类，眉标两栏都出现且不粘连（R4）。
4. 1440 / 1024 / 390 三档截图：标题块居中、署名不溢出、上下篇不横向滚动（R10、R22）。
5. 选中一段正文：底色是主题淡红不是蓝；浮条三键可见（R18、R20）。
6. 点击已划线文字 → 弹「取消划线 / 分享」；分享图扫码能打开当前文章（R20）。
7. 对照 D1–D4：标签、评论、专题条都不应重新出现。
8. **无 JS 抓取**：`curl -s 文章URL | grep 正文里的一句原话`，正文、图注、「文 / 作者」都要命中（R25、R26）。
9. **结构化数据**：`curl` 出来的 JSON-LD 用 `json.loads` 能解析，`@type=Article`、`headline`、`author.name`、`datePublished` 齐全且日期形如 `+08:00`（R27、R32）；整页 Article 只出现一次（R27）。
10. **收录通道**：`/sitemap.xml` 里有这篇文章的 `<loc>` 和 `<lastmod>`，`/robots.txt` 没有 Disallow 全站（R30）。
