# 主题发布验收清单

## 自动检查

- `npm run check`：版本、配置、SEO、H1、图片 alt、设置字段、i18n 键集合与字典同步、插件契约。
- `npm run build`：源码检查、生产构建和生成物检查。
- `npm run package`：完整构建、主题 ZIP 打包及 ZIP 内容二次检查。
- `npm run i18n`：脚本新增或删除 `t('key')` 引用后重生成 `templates/modules/i18n-dict.html`（不跑会被 `npm run check` 拦下）。

## 文案与图片

- 新增界面文案只写进 `i18n/default.properties` 与 `i18n/en.properties`，中文键必须同时有英文（`npm run check` 会比对两包键集合，当前各 692 键）。
- 模板里用 `#{key}` / `#messages.msg('key')`，脚本里用 `t('key')`；两边都不要再写中文字面量。认证页的 SpEL 视图匹配词（退出 / 注册 / 创建 / 登录）属白名单，改动需同步 `tools/verify-theme.mjs` 的 `spelAllow`。
- 内容图（封面、照片、瞬间等，宽 ≥ 160）写 `sizes`，**不要**手写 `srcset`——Halo 的 `ThumbnailImgTagPostProcessor` 会按缩略图补 `?width=` 多档。
- 404、登录注册页的自定义文案走设置项，不写进模板。

## 模板契约

- 所有调用 `~{modules/layout :: html(...)}` 的模板都要传齐参数；带自定义 head 的页面用 `headExtra=~{modules/layout :: noHead}` 或自己的 head fragment，缺参会导致整站 500。
- fragment 参数里的表达式必须写成 `|${...}|` 字面替换，裸 `#messages.msg(...)` 会解析失败。
- `<html lang>` 由 layout 按 `#locale` 输出，页面模板不要硬编码语言。

## 浏览器检查

- 首页、文章、单页、分类、标签和归档可以访问。
- 成员、友链、图库、瞬间、文档及关于页按实际启用能力检查。
- 404、4xx、500、5xx 页面可渲染且带 `noindex`；404 工牌能取到成员、可点击翻面、随机换人生效。
- 登录、注册、找回密码、退出四类页面在浅色与深色下都正常；关闭美化后回落 Halo 默认页。
- 浅色、深色和跟随系统模式显示正确。
- 390px、768px、桌面宽度无横向溢出和内容遮挡。
- 键盘可操作导航、菜单、主题切换和返回顶部。
- 插件启用与停用状态均无模板异常；缺失时显示或隐藏正确。
- 浏览器控制台无错误；开发者诊断模式默认关闭。

## 发布检查

- 已按 [版本号规则](versioning.md) 判定级别（大 / 中 / 小）并据此选号，不是随手递增 `PATCH`。
- `package.json` 与 `theme.yaml` 版本一致。
- `theme.yaml spec.requires` 仍是实际验证过的最低 Halo 版本。
- ZIP 文件名版本正确，包含最新 manifest、设置、模板、i18n 资源与前端资源。
- 在目标 Halo 版本完成安装、启用、配置、主要流程、停用和卸载检查。
- 只推 Gitee：`git push gitee main --follow-tags`，GitHub 由 Push 镜像自动同步；发行版资产不随镜像，需要 GitHub Release 时单独补。
- Gitee 发行版附上 `theme-nucma-<version>.zip`，并按 `-L` 下载一次比对字节数（发行版 `assets[].size` 恒为 0，不能作为校验依据）。
- 发布说明列出功能变化、兼容范围、验证结果和未验证事项。
