# 协同开发手册 / CONTRIBUTING

适用仓库：**仅 `theme-nucma`**。兄弟仓库 `plugin-members`、`plugin-link-submit-next` 各有自己的 `CONTRIBUTING.md`，版本文件清单、构建命令与硬约束以各仓手册为准；跨仓的需求归属判定见本文第 4 节。

本文是本仓流程与规则的唯一入口，自身完整、不依赖维护者本机的其他文档。与 README 冲突时以本文为准；与代码里已有的既定契约冲突时，先提 issue 讨论，不要单方面改契约。

---

## 0. 三条底线

1. **改前先同步，改后先自检**——基于过期代码改动是本项目冲突的第一来源。
2. **协作者不碰 `main`**——一律开分支提 PR；`main` 是保护分支。
3. **只改源码，不动生成物**——`templates/assets/**`、`console/**`、`*.iife.js` 由构建任务产出，手改必冲突。

任何一条做不到，宁可不提交，也不要“先推上去再说”。

---

## 1. 角色与权限

| 角色 | `main` 权限 | 要求 |
|---|---|---|
| 维护者 | 可直接 push | 每次发版必须打 annotated tag，并写 CHANGELOG |
| 协作者 | 禁止 push | 开分支 → 推送 → 提 PR → 维护者 review 后合并；无例外 |

协作者不负责打 tag、不建发行版、不改版本号（除非 PR 明确就是要发版，且维护者已指定版本号）。

---

## 2. 环境与仓库布局

### 2.1 版本要求

| 项目 | 要求 | 说明 |
|---|---|---|
| Node.js | **≥ 22.12** | 主题构建；`package.json` 的 `engines` 会拦截低版本 |
| Halo | ≥ 2.27.0 | 主题 `spec.requires` |

（插件仓库需要 JDK 21 与 pnpm 10.22，见各插件仓手册。）

### 2.2 目录布局（必须并列）

```
<任意父目录>/
├── theme-nucma/
├── plugin-members/
└── plugin-link-submit-next/
```

三者不嵌套，但联调时需要并排放置。Windows 下路径不要带空格。

### 2.3 拉取

```bash
git clone https://gitee.com/xiui-cc/theme-nucma.git
```

### 2.4 远程约定（重要）

| 平台 | 地址形态 | 用途 |
|---|---|---|
| **Gitee（主）** | `gitee` → `https://gitee.com/xiui-cc/<repo>.git` | 日常协作、分支、PR、发版，**全部在这里** |
| GitHub（镜像） | `origin` → `https://github.com/chenhufei/<repo>.git` | 只读分发，由 Gitee 的 Push 镜像自动同步（约 5 分钟） |

两条铁律：

- **不要推 GitHub。** GitHub 侧由 Gitee 镜像强制覆盖，直推的提交下次同步就被冲掉。
- **不要在 GitHub 提 PR。** 同上，会被镜像覆盖。

镜像只同步**分支与 tag**，不同步 Release 资产——GitHub 上没有 zip/jar 属正常现象。

### 2.5 关于 `scripts/`

仓库根目录的 `scripts/*.ps1`（`sync-all` / `verify-all` / `package-all` / `push-all` / `release` / `local-halo` / `clone-all`）是**维护者本机工作区**的便捷脚本，随工作区分发、不在任何仓库里。协作者按第 3、6 节的等价 git / npm / gradle 命令执行即可，无需这些脚本。

（若维护者把工作区打包给你，注意 `scripts/env.ps1` 顶部写死了本机 Node 与 JDK 路径，需自行改为本机路径。）

---

## 3. 标准流程（六步）

### 第 1 步：同步

```bash
git pull --rebase gitee main
```

- 有未提交改动时先 `git stash -u`，拉完立刻 `git stash pop` 并处理冲突。
- **拉取失败不得继续改动**，先报告，不要在冲突状态上叠改动。
- 维护者可用 `.\scripts\sync-all.ps1 -Repos theme-nucma`（默认三个仓库；`-Remote gitee|origin|both`，`-NoStash` 表示有脏文件就跳过）。

### 第 2 步：判定归属

按第 4 节判断「该改插件还是主题」。判定结论要写进 PR 描述，别边写边想。

### 第 3 步：开分支

```bash
git switch -c feat/members-batch-load
```

命名：`feat/xxx`、`fix/xxx`、`docs/xxx`、`refactor/xxx`。一个 PR 一件事，不混装无关改动。

### 第 4 步：改源码

遵守第 5 节的硬约束。涉及版本敏感 API（Finder、模板变量、扩展点、权限、`spec.requires`）时，**先查官方文档与目标 Halo 版本源码**，不凭记忆猜字段。

### 第 5 步：自检与打包

按第 6 节跑完整检查。**会进入安装包的内容改动，必须出完整包（zip / jar）**，只编前端资源不算完成。

### 第 6 步：提交与 PR

提交格式见第 8 节，然后：

```bash
git push gitee HEAD
```

到 Gitee 提 PR 到 `main`，按第 8.2 节模板填描述。**不要**自行合并，也不要 `--force` 推别人的分支。

---

## 4. 需求归属判定：插件还是主题？

一条总原则：**插件拥有业务逻辑、权限控制和默认行为；主题只负责选择性展示或覆盖样式。**

拿到需求按顺序问：

| # | 问题 | 结论 |
|---|---|---|
| 1 | 是否改变数据（增删改、审核、状态流转）？ | 是 → **插件**，主题只展示结果 |
| 2 | 是否需要权限、限流、验证码、邮件？ | 是 → **插件**，主题不得自行实现 |
| 3 | 关掉主题后这功能还要能用吗？ | 要 → **插件** |
| 4 | 只是换位置 / 颜色 / 排版 / 交互反馈？ | 是 → **主题** |
| 5 | 涉及官方插件（PluginLinks 等）的数据？ | 只用官方公开接口，**不自建存储** |
| 6 | 两边都要改？ | 先定契约（变量名、字段、路由）→ 插件先实现并保证默认可用 → 主题再增强 → 联合验证 |

**真实踩过的反例（别再犯）：**

- ❌ 主题用 `pluginFinder.available('PluginCommentWidget')` 判断评论 → 绕过 Halo 组合条件，站点关评论仍会渲染。正确做法是用 `haloCommentEnabled`。
- ❌ 主题把 `linkApplicationEnabled` 当插件注入变量 → 插件从未注入，入口永远不显示。
- ❌ 主题自己拼 `POST /links/apply/submit` → 该路由不存在，真实契约是 `api.link.halo.run` 的 REST。
- ❌ 成员筛选条遍历已过滤的 `groups` → 进入分组后其余标签消失，必须用 `allGroups`。

---

## 5. 改动中的硬约束

### 5.1 只改源码

以下**只能由构建任务生成**，禁止手改、禁止手工合并：

| 生成物 | 来源 |
|---|---|
| `templates/assets/**` | `src/css`、`src/js` 经 vite 构建 |

### 5.2 主题模板（Thymeleaf 3.1）

- 没有 `#request`；`th:with` 晚于 `th:if`，变量定义提到父级；`param.x` 是数组。
- **`layout :: html(...)` 必须传齐参数**，带自定义 head 的页面传 `headExtra=~{modules/layout :: noHead}` 或自己的 head fragment。**缺参会导致整站 500**（本项目真实事故）。
- fragment 参数里的表达式必须写成 `|${...}|` 字面替换；裸 `#messages.msg('k')` 会解析失败。
- `<html lang>` 由 layout 按 `#locale` 输出，页面模板不要硬编码语言。
- 公共布局保留 `<halo:footer />`；favicon、`noindex`、内容页 description 由 Halo 注入，主题不重复输出。
- 插件缺失时必须降级：`pluginFinder` 守卫后读数据，缺 `allGroups` 回退 `groups`、缺 `currentGroup` 回退 `param.group`。

### 5.3 文案与多语言（i18n）

- 界面文案**只写** `i18n/default.properties` 与 `i18n/en.properties`，中文键必须有对应英文键。
- 模板用 `#{key}` / `#messages.msg('key')`，脚本用 `t('key')`；两边都不再写中文字面量。
- 改动 `t('key')` 引用后必须跑 `npm run i18n` 重生成 `templates/modules/i18n-dict.html`，属性文件与字典一起提交（不跑会被 `npm run check` 拦下）。
- 认证页的 SpEL 视图匹配词（退出 / 注册 / 创建 / 登录）属白名单，调整需同步 `tools/verify-theme.mjs` 的 `spelAllow`。
- 404 页、登录注册页的文案走**设置项**，不写死在模板里。

### 5.4 图片

内容图（封面、照片、瞬间等，宽 ≥ 160）写 `sizes`，**不要**手写 `srcset`——Halo 的 `ThumbnailImgTagPostProcessor` 会按缩略图补 `?width=` 多档。

### 5.5 行尾

`.gitattributes` 已统一 `* text=auto eol=lf`（`*.bat` / `*.cmd` 为 CRLF）。不要把编辑器产生的整文件 CRLF 转换提交进去；误转用 `sed -i 's/\r$//'` 还原，再 `git diff --stat` 确认没有整文件 diff。

（插件侧的 WebFlux / 端点安全约束见各插件仓手册第 4 节。）

---

## 6. 验证与打包

### 6.1 命令

| 自检 | 打包 | 产物 |
|---|---|---|
| `npm run check` | `npm run package` | `dist/theme-nucma-<ver>.zip` |

- 仅 `npm run build` 不够，**安装包内容变化必须 `npm run package`**。
- 维护者一键：`.\scripts\verify-all.ps1`（三仓全检）、`-Package` 追加打包。

**打包链多了一层指纹注入**：`npm run package` = `build` → `tools/pack-theme.mjs` → `tools/verify-package.mjs`。打包脚本先在暂存区按 `templates/assets/**` 的字节算出 8 位指纹，把模板里的 `(v=${theme.spec.version})` 换成 `(v=<版本>-<指纹>)`（形如 `?v=0.0.3-3c07f907`），再交给本地固定版本的 `theme-package` 出 zip。

- 源码模板永远写 `(v=${theme.spec.version})`，**不要硬编码版本号、不要省掉该参数**——`npm run check` 会拦（这是缓存失效的唯一开关）。
- 为什么必须指纹：Halo 把 `/assets/**` 当不可变资源，浏览器按完整 URL 缓存。只带版本号时，同一版本号重复安装（换测试包、打同版补丁）URL 完全不变，浏览器继续用旧 CSS/JS，表现为「改了没生效」「样式错乱」。
- 指纹只存在于安装包里，工作区模板不被改写；资源内容不变则指纹不变，缓存正常复用。
- `verify-package.mjs` 会重算包内资源指纹，与模板里的 `?v=` 不一致直接失败。

**暂存区是「清单 + 增量覆盖」，不是整目录重拷**：宿主对单轮删除超过 50 个文件有批量删除保护，`rm -rf .pack-stage` 会让正常打包失败。脚本用 `.pack-stage-manifest.json` 记录上一版文件清单，只删「上版有、这版没有」的文件（常态 0 个），其余覆盖写入，所以重复打包稳定可复现。

**校验用内容摘要，不用 zip 的 md5**：打包工具按 glob 展开顺序追加条目，同一份内容两次打包字节不同。`npm run package` 结束会打印 `内容摘要：<sha256>（N 个文件）`，发版后下载线上资产用同一脚本比对：

```bash
node tools/zip-digest.mjs dist/theme-nucma-0.0.4.zip   # 本地
node tools/zip-digest.mjs /tmp/dl-theme.zip             # 线上
```


### 6.2 自动检查覆盖了什么

`npm run check`（`tools/verify-theme.mjs`）会核对：版本一致（`package.json` / `theme.yaml` / `package-lock.json` 三处）、模板契约、插件契约标记、`haloCommentEnabled`、`layout.html` 契约、`<halo:footer />`、i18n 键集合与字典同步、图片 alt、SEO 与 H1、CSS 禁用 `transition: all`。

### 6.3 集成验证矩阵（至少覆盖）

1. 未安装可选插件 → 页面正常，无失效入口。
2. 插件已安装但停用 → 不调其 Finder / API / Widget。
3. 插件版本不满足 → 走基础功能或隐藏增强。
4. 插件启用 → 入口、暗色、移动端、键盘操作正常。
5. 站点关闭评论 → 评论区整体不渲染。
6. 匿名 / 登录 / 管理员 → 只能访问各自授权范围。

### 6.4 浏览器验收（主题相关改动）

- 首页、文章、单页、分类、标签、归档可访问。
- 成员、友链、图库、瞬间、文档、关于页按实际启用能力检查。
- 404 / 4xx / 500 / 5xx 可渲染且带 `noindex`；404 工牌能取到成员、可翻面、随机换人生效。
- 登录、注册、找回密码、退出四页在浅色与深色下正常；关闭美化后回落 Halo 默认页。
- 390px / 768px / 桌面无横向溢出；键盘可操作导航、菜单、主题切换。
- 控制台无错误；开发者诊断模式默认关闭。

> 错误页模板需带 `Accept: text/html` 才会触发，`curl` 默认头只会拿到 JSON 错误。

---

## 7. 版本与发版

### 7.1 三档级别（先判级，再选号）

| 级别 | 判定 | 典型改动 | 选号 |
|---|---|---|---|
| **大** | 体系级变化，影响已有站点呈现或模板契约 | fragment 签名 / layout 结构变动、新增整块页面体系（404、登录注册页）、视图体系替换、全站多语言体系、视觉体系重构、合并大分支、删设置项、抬高 Halo 最低版本 | 升 `MINOR`，`PATCH` 归零（0.0.3 → **0.1.0**） |
| **中** | 新增能力或成批修复，不破坏契约 | 新设置组、新交互模块、新页面模板、同批修 3 个以上问题、单点但影响全站的紧急修复 | 升 `PATCH`（0.1.0 → **0.1.1**） |
| **小** | 单点修复与打磨 | 单条样式 / 文案 / 交互、构建与配置修正、依赖小版本跟进 | 升 `PATCH`（0.1.1 → **0.1.2**） |

判定顺序：**是否破坏既有契约或改页面体系**（→ 大）→ **是否新增能力或成批修复**（→ 中）→ 否则（→ 小）。

版本号规则：与兄弟插件仓各自独立计数，互不联动。0.x 阶段 `MINOR` 承担体系级变化，`PATCH` 承担其余，**中与小共用 `PATCH` 位，级别写在 CHANGELOG 首行与 tag 说明里**；`1.0.0` 表示模板契约与公开接口进入稳定期。

只有会进入安装包的内容变化才升版本；README、规则文档、测试代码改动不强制升版本。

### 7.2 版本文件清单（任一处不一致不得发版）

> **版本号只在发版提交里动（硬规则）**：本仓版本文件（`package.json`、`theme.yaml`）在**日常功能 / 修复提交中一律不改**。版本号由维护者在发版时统一升（见 7.3 第 1 步）；协作者发现改动需要升号，在 PR 描述或 issue 里提即可，**不要动手改版本文件**——包含版本号改动的 PR 会被要求先摘掉再合。日常对齐以 tag 为锚点：开工先 `git pull --ff-only`，发版后两边对齐同一个 tag 即版本一致。

| 需同步的文件 | 校验方 |
|---|---|
| `package.json`、`theme.yaml`（`spec.version`）、`package-lock.json` | `npm run check`（不一致直接失败） |

`plugin.yaml` 的 `spec.requires` 必须是**实际验证过**的最低兼容版本，不能按编译 SDK 推断。构建任务会校验这些文件版本一致，不一致直接失败。

### 7.3 发版七步（维护者）

1. 汇总改动 → 按 7.1 判级选号 → 同步 7.2 全部版本文件。
2. `npm run check` → `npm run build` → `npm run package`。
3. 本地 Halo 实例安装验证（安装、启用、配置、主要流程、停用、卸载）。
4. 追加 `CHANGELOG.md` 一条（版本号与 tag 一致，写清功能变化、修复、影响面）。
5. 提交并打 **annotated** tag：

   ```bash
   git add -A
   git commit -m "feat(scope): 改动要点；x.y.z"
   git tag -a x.y.z -m "x.y.z"
   git push gitee main --follow-tags
   ```

6. Gitee 建发行版，挂原始 zip / jar，发布说明按「级别 + 影响面 + 验证结果 + 未验证项」写。
7. 校验资产：`curl -L` 下载一次比对字节数。**发行版 `assets[].size` 恒为 0，不能作为校验依据。**

维护者可简化：`.\scripts\release.ps1 -Repo theme-nucma -Version x.y.z`（校验版本一致 / 工作区干净 / tag 不重名 / SemVer 后打 tag 并推 Gitee），再 `.\scripts\push-all.ps1 -Tags`。

### 7.4 铁律

- **tag 名直接用版本号，不加 `v` 前缀。**
- **必须 `-a`**：`--follow-tags` 只推 annotated tag，轻量 tag 不会被带走。
- **不跳号、不攒批**：一次发版一个 tag，中间版本缺失会让回退定位失效。
- **不覆盖已发布 tag**：已推送的 tag 不删不重打，修复只能发新版本。
- **回退用 `git revert`**，禁止 `reset --hard` 后强推。
- 版本号一旦发出即为对外契约，只增不改；有问题按级别发新版本。

### 7.5 当前版本

| 版本 | 下一版 |
|---|---|
| **0.0.2** | 中/小级 → 0.0.3，大级 → 0.1.0 |

覆盖安装：主题在「主题 → 安装主题」上传 zip，重复上传即为覆盖，设置与内容保留。版本比较细节见 [docs/versioning.md](docs/versioning.md) 第四节。

---

## 8. 提交与 PR 规范

### 8.1 提交信息

格式：`type(scope): 简述；版本号`

```
fix(theme): 修复分组筛选失效；0.0.2
docs(theme): 补版本分级说明
```

`type`：`feat` / `fix` / `docs` / `refactor` / `chore` / `test`。
`scope`：`theme` / `i18n` / `docs` 等。
纯文档改动不必带版本号。

### 8.2 PR 描述模板

```markdown
## 改了什么
（一两句，指向具体页面 / 模块 / 文件）

## 为什么
（对应 issue 或现象；复现步骤）

## 归属判定
插件 / 主题 / 两者；影响哪些契约（Finder、模板变量、路由、字段）

## 验证
- [ ] npm run check / gradlew test 通过
- [ ] 已出完整包（zip / jar）
- [ ] 受影响页面在 Halo <ver> 上验证（列出页面）
- [ ] 插件缺失 / 停用 / 版本不满足三种状态正常
- [ ] 浅色、深色、390px 正常

## 文档
README / CHANGELOG / docs 是否需要同批更新（需要则已在本 PR 内）
```

### 8.3 review 关注点（双方都看）

- 业务有没有落到主题里（校验、限流、存储一律在插件）。
- 生成物有没有被手改。
- 模板 fragment 参数是否传齐、表达式是否 `|${...}|`。
- 新增文案是否进了 properties 且中英双语齐全。
- 版本文件是否一致、`spec.requires` 是否诚实。
- 是否顺手改了无关文件（尤其是整文件 CRLF）。

### 8.4 合并后

删除远程分支；不要在共享分支上 `--force` 推送；不要 `rebase` 已推送的公共分支。

---

## 9. 文档同步（不做“下次一起改”）

| 文件 | 何时必须更新 |
|---|---|
| `README.md` | 新增页面能力、设置分组、插件依赖、环境要求、仓库地址变化 |
| `CHANGELOG.md` | 每次发版追加一条，版本号与 tag 一致 |
| `docs/versioning.md` | 版本分级规则变化、发版操作调整 |
| `docs/release-checklist.md` | 验收手段变化（新增契约检查、浏览器项、发布步骤） |
| `docs/plugin-compatibility.md` | 插件版本升级、契约字段变化、验证状态变化 |
| `COLLABORATION.md` | 分支模型、发版流程、远端与权限变化 |
| `CONTRIBUTING.md`（本文） | 流程或硬约束变化 |
| `i18n/*.properties` + `i18n-dict.html` | 文案键增删，同批提交 |

---

## 10. 常见坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 整站 500 | `layout :: html(...)` 少传参数 | 补齐所有参数，带自定义 head 的传 `headExtra` |
| 页面 500、日志报 parse error | fragment 参数写了裸 `#messages.msg(...)` | 改 `|${#messages.msg('k')}|` |
| 三个标签只剩一个 | 筛选条遍历了已过滤的 `groups` | 用 `allGroups` |
| 评论关了还在渲染 | 用 `pluginFinder.available('PluginCommentWidget')` | 用 `haloCommentEnabled` |
| 改完样式没生效 | 改了 `templates/assets/**` 生成物 | 改 `src/`，跑 `npm run build` |
| `npm run check` 报 i18n 键不一致 | 改了 `t()` 没跑生成 | `npm run i18n` 后连同 properties 一起提交 |
| PR 里出现上千行 diff | 编辑器把整文件转成 CRLF | `sed -i 's/\r$//'` 还原后重提 |
| 推完 GitHub 又被改回去 | 推了镜像端 | 只推 `gitee` |
| 发行版资产显示 0 字节 | Gitee 接口 `assets[].size` 恒为 0 | 用 `curl -L` 下载比字节 |
| 插件停用后页面报错 | 主题没做 Finder 守卫 | `pluginFinder.available(...)` 后再读，并给降级路径 |

---

## 11. 命令速查

**协作者（无脚本时）**

```bash
git pull --rebase gitee main        # 改前同步
git switch -c fix/xxx               # 开分支
npm run check && npm run package    # 自检 + 出包
git push gitee HEAD                 # 推分支，然后提 PR
```

**维护者脚本（工作区 `scripts/`）**

| 脚本 | 用途 | 常用参数 |
|---|---|---|
| `env.ps1` | 校验 Node ≥ 22 / JDK 21 并注入 PATH | — |
| `clone-all.ps1` | 一次拉齐三仓并装依赖 | `-Owner xiui-cc` `-TargetDir D:\work\halo` `-Source gitee\|github` `-SkipInstall` |
| `sync-all.ps1` | 改前同步（stash → fetch → rebase → pop） | `-Repos <名>` `-Remote gitee\|origin\|both` `-NoStash` |
| `verify-all.ps1` | 三仓全量检查 | `-Package` 追加打包 |
| `package-all.ps1` | 三仓测试 + 打包，并校验产物存在 | — |
| `push-all.ps1` | 推送（默认只推 gitee） | `-Only gitee\|both\|github` `-Tags` `-GiteeOwner` |
| `release.ps1` | 单仓发版（校验 → 打 tag → 推 gitee） | `-Repo` `-Version` `-DryRun` `-Force` `-AlsoGitHub` |
| `local-halo.ps1` | 本地 Halo 实例管理 | `start\|stop\|status\|deploy\|logs`，`-Port 18091` |

---

## 12. 完成定义（DoD）

一个改动只有全部满足才算“做完”：

- [ ] 归属正确（业务在插件、展示在主题，官方数据只用官方接口）
- [ ] 只改源码，生成物由构建产出
- [ ] 自检通过（`npm run check` / `gradlew test`），失败即未完成
- [ ] 安装包内容有变化时：版本号按 7.1 判级、7.2 全部文件同步、出了完整 zip/jar
- [ ] 受影响页面在目标 Halo 上验证过，插件的启用 / 停用 / 缺失三态正常
- [ ] `CHANGELOG.md` 已追加，相关 `README` / `docs` 同批更新
- [ ] 提交信息合规，PR 描述含验证结果
- [ ] 发版后：annotated tag 已推 Gitee、发行版已挂资产并做过字节校验

---

## 13. 文档地图

| 文件 | 权威内容 |
|---|---|
| **CONTRIBUTING.md（本文）** | 协同流程、硬约束、发版规则——**对外唯一入口** |
| `COLLABORATION.md` | 仓库边界、分支模型、协作者接入细节 |
| `CHANGELOG.md` | 逐版本变更（0.0.1 起） |
| `docs/versioning.md` | 版本分级规则与发版操作 |
| `docs/release-checklist.md` | 发布前逐项验收 |
| `docs/plugin-compatibility.md` | 插件版本适配矩阵与降级行为 |
| `README.md` | 安装、配置、能力概览 |

维护者主工作区另有 `AGENTS.md`（硬性规则）与 `ARCHITECTURE.md`（职责矩阵与契约清单），**不随仓库分发**；其有效条款已并入本文第 4、5 节。
