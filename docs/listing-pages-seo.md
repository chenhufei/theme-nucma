# 列表型页面 SEO 规则（成员公示 / 友情链接）

> 依据：Halo 插件路由注入的模型变量（PluginMembers / PluginLinks）、schema.org 结构化数据规范，
> 叠加 2026-11 用户要求「两个板块的所有字段都要能被搜索引擎搜到，主要展示成员名称」。
> 适用文件：`templates/members.html`、`templates/links.html`、`templates/modules/seo.html`、`src/css/main.css`、`i18n/*.properties`。
> 文章页的规则另见 `docs/article-page-rules.md`。

## 一、模板能拿到的数据

| 页面 | 路由 | 变量 | 结构 |
|---|---|---|---|
| 成员公示 | `/members`（PluginMembers） | `groups`、`allGroups`、`currentGroup`、`pluginName` | `groups[]` 每组含 `spec.displayName` 与 `members[]`；成员字段在 `member.spec`：`displayName` / `school` / `description` / `qq` / `qqFriendLink` / `avatar` / `joinedAt` |
| 友情链接 | `/links`（PluginLinks） | `groups`、`links`、`simpleGroups`、`group` | `groups[]` 每组含 `spec.displayName` 与 `links[]`；链接字段在 `link.spec`：`displayName` / `url` / `description` / `logo`。**带 `?group=` 时插件改为给拍平的 `links`** |

两个页面都是**插件路由**，主题只负责渲染，不负责取数。

## 二、硬规则

| 编号 | 规则 |
|---|---|
| L1 | **列表必须服务端渲染**：成员 / 友链一律 `th:each` 直出，禁止改成 JS 拉接口再插入。`curl` 到的 HTML 里必须能搜到每个名字 |
| L2 | **一个字段一条结构化数据**。成员 → `Person`，友链 → `WebSite`；一条一个 `<script type="application/ld+json">`，不要用 `ItemList` 手拼数组（嵌套 `th:each` 下逗号最容易拼错成非法 JSON） |
| L3 | 成员的 `Person` 必带：`name`、`description`、`image`、`url`、`identifier`（QQ，`PropertyValue`）、`affiliation`（学校，`EducationalOrganization`）、`memberOf`（`Organization` = 站点名，`department` = 分组名） |
| L4 | 友链的 `WebSite` 必带：`name`、`url`、`description`、`image`（Logo）、`isPartOf`（`Organization`，`department` = 分组名） |
| L5 | **`<meta name="description">` 由页面自己算**（走 layout 的 `description` 参数），格式固定为「…共 N 位成员，分组为 X，成员包括 A、B、C」。名字串超过 110 字用 `#strings.abbreviate` 截断，避免整页成员上百时描述失控 |
| L6 | `<meta name="keywords">` **只在 Halo 未填站点关键词时才补**（layout 已有站点关键词时再输出会变成两个同名标签）。内容顺序：成员公示 / 友情链接 → 站点名 → 全部分组 → 全部名字 → 全部学校（或网址） |
| L7 | 名字至少出现在**三处**：卡片可见文本、`meta description`、结构化数据 `name`。缺任何一处都算没做到「可被搜到」 |
| L8 | 标题层级固定 `h1` 页面名 → `h2` 分组名 → `h3` 成员名 / 站点名。**改成 `h3` 后必须用 CSS 拉回正文字体**（全局 `h1–h6` 会套 `--font-display` 与 `700`，改了会变粗变大、截断位置跟着变） |
| L9 | 头像 `alt` = 成员名，Logo `alt` = 站点名；纯装饰（背景图、条码、吊带）继续 `aria-hidden` |
| L10 | 所有 `image` / `url` 用**绝对地址**：Halo 的附件是 `/upload/...`，必须拼 `site.url`；QQ 头像本身是绝对地址，别再拼 |
| L11 | 空字段输出 `null` 而不是 `""`。`spec.qqFriendLink` 这类字段后台可能是空字符串，判断要 `!= null and !#strings.isEmpty()` 两道 |
| L12 | 列表页**不输出 Article**，只保留 layout 的 `WebPage` + 逐条实体。整页只允许一份 `WebPage` |
| L13 | 结构化数据必须和可见内容一致：带 `?group=` 时只输出该分组的成员 / 链接；描述与关键词同步跟着收窄 |
| L14 | **禁止用隐藏文本堆字段**（`display:none` 塞一串关键词）。字段要么可见，要么进结构化数据，二者取其一 |

## 三、实现要点（踩过的坑）

1. **`th:with` 对 `th:replace` 不可见**。Thymeleaf 处理顺序是 `th:replace`(100) → `th:if`(300) → `th:with`(600)，写在 `<html>` 上的 `th:with` 到 `th:replace` 求参数时还是 null。要传计算好的 `description`，必须用外层 `<th:block th:with="…">` 把 `<html>` 整个包住（已实测可行，输出无多余节点）。
2. **SpEL 没有 flatten**。`groups` 是「组 → 成员」的嵌套列表，要拼成一句只能用嵌套投影：
   `#strings.listJoin(groups.![members].![#this.![spec.displayName]].![#strings.listJoin(#this, '、')], '、')`
   —— 内层按组拼串，外层把各组的串再拼起来。
3. 总人数用 `#aggregates.sum(groups.![members].![#this.size()])`；直接 `#lists.size` 拿到的是分组数。
4. `.{{...}}` 这种写法要留空格：`${ { … } }`。`${{{` 会被解析器吃掉，整段静默不输出（排查过一次）。
5. `tools/verify-theme.mjs` 会拦「单引号里出现中文」——模板里的 SpEL 字面量只能用 ASCII，中文标点（`、`、`，`）不在拦截范围。
6. 本地实例**没装 PluginLinks**，`/links` 直接 404，改友链模板只能静态校验。验证办法：把 `seo.html :: linksPage` 用 **Map 形态的假数据**挂到成员页 head 里跑，两个分支（分组视图 / 单分组视图）都能过一遍（假数据里不能写中文，见上一条）。验完必须删干净。
7. `#strings.abbreviate` 截断会带 `...`，落在名字中间是可接受的，因为只影响 `meta description`，不影响卡片与结构化数据。

## 四、收录通道（不归主题管，但要盯住）

- `/sitemap.xml` 由 PluginSitemap 生成，**只包含文章、独立页面、分类、标签**，插件路由（`/members`、`/links`）不在里面。
- 所以这两个页面必须靠**站内链接**被爬到：导航或页脚要有指向 `/members`、`/links` 的普通 `<a>`，不能只放在 JS 菜单里。
- 上线后建议到百度搜索资源平台 / Google Search Console / Bing 站长工具，把这两个 URL 单独「提交 URL」，别等自然发现。

## 五、自检清单（改完跑一遍）

1. `npm run build` —— 必须输出「主题检查通过：53 个模板」。
2. `curl -s /members | grep 某位成员的名字` —— 卡片文本、`meta description`、JSON-LD 三处都要命中（L1、L7）。
3. `curl -s /members` 抓 JSON-LD 用 `json.loads` 逐块解析，`Person` 的 `name` / `affiliation.name` / `memberOf.department.name` 齐全，`image` 是 `http` 开头（L3、L10）。
4. `/members?group=xxx` 再跑一遍：只出现该分组成员，描述里也只剩这一组（L13）。
5. 整页 `<meta name="description">`、`<meta name="keywords">` 各只有一条（L6）。
6. 打开成员页 `/links` 页面，`h1` 只有一个，分组是 `h2`，名字是 `h3`，且字号字重与改动前一致（L8）。
7. 友链页在装了 PluginLinks 的环境里检查：默认视图与 `?group=` 视图都能出 `WebSite` 块，`url` 与 `image` 可解析（L4）。
