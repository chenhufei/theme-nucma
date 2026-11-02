# 插件适配矩阵

本表区分“存在主题集成”和“已经在目标 Halo 实例完整验证”。插件可以安装或模板可以渲染，不等于全部业务流程已经兼容。

最近更新：2026-11-02（theme 0.0.2 / plugin-members 0.0.2 / plugin-link-submit-next 0.0.1）

| 插件 | 主题集成 | 当前契约 | 降级行为 | 运行验证 |
|---|---|---|---|---|
| PluginMembers `0.0.x` | 成员页、首页成员公示、申请 Widget、认领页、404 工牌取人、关系网 | `pluginFinder.available`、`memberFinder.listApprovedMembers()`、`memberFinder.listAllGroups()`、`MemberApplyWidget`、认领 token 接口 | 未启用时不调用 Finder，显示统一缺失提示；404 工牌回落到主题内置示例数据 | Halo 2.27.1 QA 实例：成员页与 404 工牌均正常渲染（成员卡 105 张、工牌候选 35 名） |
| PluginLinks（Halo 官方） | 友链分组、列表和官方申请 | `pluginFinder.available`、`simpleGroups`、`groups`、`linkApplicationEnabled`；提交 `POST /links/apply/submit` + `/links/apply/captcha` | 未启用时不读取友链并显示统一缺失提示；申请能力关闭时不显示申请入口 | 官方 2.5 契约（2.3 起兼容），目标实例需按实际版本复验 |
| link-submit-next `0.0.x` | 官方申请表单的网站信息自动填充 | 注入 `.link-enhance-tools`、`data-link-enhance-fetch`、`data-link-enhanced`、`data-status`；按 `url` + `displayName` + `logo` 字段特征识别表单，不依赖固定 `action` | 插件未启用或后台关闭时，表单仍可完全手动填写，主题不显示增强按钮 | 0.0.1 与 PluginLinks 2.5 契约，目标实例需复验 |
| PluginSearchWidget | 顶部搜索入口 | `SearchWidget.open()` | 未启用时隐藏搜索按钮 | 待目标实例复验 |
| 评论组件 | 文章、页面、成员、友链评论 | `haloCommentEnabled`、`halo:comment` | 未启用或页面禁用评论时不渲染 | 待目标实例复验 |

## 职责边界

- `PluginLinks` 是正式友链数据的唯一存储和管理方。
- `link-submit-next` 只做前台增强：在官方申请表单的网址字段旁注入“获取信息”按钮，通过服务端代理返回网站标题、描述和 Logo；不渲染表单、不提交申请、不参与审核。
- 成员业务（分组、申请、审核、认领、撤回）全部由 `PluginMembers` 承担；主题只消费 Finder、Widget 与公开接口，404 工牌同样只读成员数据。
- 关系网展示的学校关联结论来自成员插件的分析结果，主题不做二次计算，也不缓存结论。
- 友链申请表单由主题按官方 `PluginLinks` 同源契约渲染，与 `link-submit-next` 是否安装无关；正式数据始终由 `PluginLinks` 保存。
- 版本敏感字段、权限和 API 必须在升级插件前按 Halo 官方文档及目标版本源码重新核对。

## 版本守卫

- 主题在模板中按插件版本回退取值（如页脚菜单的 `status` → `spec`），插件字段缺失时走兜底而不是抛异常。
- 认领页依赖 `PluginMembers` 的 token 认领能力；插件不提供该能力时只展示说明，不渲染认领表单。
- 友链增强依赖 `PluginLinks >= 2.3.0`；未达到时不注入「获取信息」按钮。
