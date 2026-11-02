# 版本号规则

`theme-nucma`、`plugin-members`、`plugin-link-submit-next` 三个仓库各自独立计数，互不联动，当前版本均为 **0.0.1**。

## 一、编号格式

`0.MINOR.PATCH`，例如 `0.0.1`、`0.1.0`、`0.1.3`。tag 名直接等于版本号，**不加 `v` 前缀**，必须是 annotated tag。

## 二、三档级别

| 级别 | 判定 | 典型改动 | 选号 |
| --- | --- | --- | --- |
| **大** | 体系级变化，影响已有站点的呈现或模板契约 | 模板契约变动（fragment 签名、layout 结构）、新增整块页面体系（404、登录注册页）、视图体系替换、全站多语言体系、视觉体系重构、合并大分支、删设置项、抬高 Halo 最低版本、公开接口不兼容 | 升 `MINOR`，`PATCH` 归零（0.0.3 → **0.1.0**） |
| **中** | 新增能力或成批修复，不破坏既有契约 | 新设置组、新交互模块、新页面模板、同一批修 3 个以上问题、单点但影响全站的紧急修复 | 升 `PATCH`（0.1.0 → **0.1.1**） |
| **小** | 单点修复与打磨 | 单条样式 / 文案 / 交互、构建与配置修正、依赖小版本跟进 | 升 `PATCH`（0.1.1 → **0.1.2**） |

判定顺序：**是否破坏既有契约或改页面体系**（→ 大）→ **是否新增能力或成批修复**（→ 中）→ 否则（→ 小）。

补充约定：

- 0.x 阶段 `MINOR` 承担「体系级变化」，`PATCH` 承担能力新增与修复；中与小共用 `PATCH` 位，**级别写在 CHANGELOG 首行与 tag 说明里**。
- `1.0.0` 表示模板契约与公开接口进入稳定期，此后大级改用 `MAJOR`。
- 只有会进入安装包的内容变化才升版本；README、规则文档、测试代码改动不升版本。
- 三个仓库各自独立计数，互不联动；同一批改动涉及多个仓库时，各自动自己的版本。

## 三、发版操作

1. 汇总本次改动，按上表判定级别。
2. 依级别选号，同步该仓库的全部版本文件：

   | 仓库 | 版本文件 |
   | --- | --- |
   | `theme-nucma` | `package.json`、`theme.yaml`（`spec.version`） |
   | `plugin-members` | `build.gradle`、`src/main/resources/plugin.yaml`、`ui/package.json` |
   | `plugin-link-submit-next` | `build.gradle`、`gradle.properties`、`src/main/resources/plugin.yaml`、`packages/link-submit-widget/package.json` |

3. 自检并出包：主题 `npm run check` → `npm run build` → `npm run package`；插件 `./gradlew cleanTest test` → `./gradlew.bat build -x test`。
4. 提交、打 annotated tag、只推 Gitee：`git push gitee main --follow-tags`。
5. 在 Gitee 建发行版并挂 zip / jar，说明按「级别 + 影响面 + 验证结果」写。

铁律：

- **已发布 tag 不删除、不重打**；发现问题只能按级别发新版本。
- **不跳号、不攒批**：一次发版一个 tag。
- **回退用 `git revert`**，禁止 `reset --hard` 后强推。
- 版本号一旦发出即为对外契约，只增不改。

## 四、安装与覆盖升级

- 主题：后台「主题 → 安装主题」上传 `theme-nucma-x.y.z.zip`；重复上传即为覆盖安装，主题设置与站点内容保留。
- 插件：后台「插件 → 安装」上传对应 jar 覆盖，插件数据、分组与设置保留。
- 版本比较以安装包内 `theme.yaml` / `plugin.yaml` 的 `version` 为准。上传的包版本低于当前已装版本时，后台不会提示「检查更新」，需要手动再覆盖一次；同编号区间内（如 `0.0.1` → `0.0.2`）比较正常。
