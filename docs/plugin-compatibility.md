# 插件适配矩阵

本表区分“存在主题集成”和“已经在目标 Halo 实例完整验证”。插件可以安装或模板可以渲染，不等于全部业务流程已经兼容。

| 插件 | 主题集成 | 当前契约 | 降级行为 | 运行验证 |
|---|---|---|---|---|
| PluginMembers | 成员分组、成员列表、申请 Widget | `pluginFinder.available`、`memberFinder.listApprovedMembers()`、`MemberApplyWidget` | 未启用时不调用 Finder，并显示统一缺失提示 | 待目标实例复验 |
| PluginLinks（Halo 官方） | 友链分组、列表和官方申请 | `pluginFinder.available`、`simpleGroups`、`groups`、`linkApplicationEnabled` | 未启用时不读取友链并显示统一缺失提示；申请能力关闭时不显示申请入口 | 官方 2.3.0 契约，目标实例需复验 |
| link-submit-next | 友链自助提交增强入口 | `LinkSubmitWidget.open()` | 仅在增强插件可用且官方申请能力开启时显示弹窗入口；否则不显示误导性的申请按钮 | 1.2.6 源码契约，目标实例需复验 |
| PluginSearchWidget | 顶部搜索入口 | `SearchWidget.open()` | 未启用时隐藏搜索按钮 | 待目标实例复验 |
| 评论组件 | 文章、页面、成员、友链评论 | `haloCommentEnabled`、`halo:comment` | 未启用或页面禁用评论时不渲染 | 待目标实例复验 |

## 职责边界

- `PluginLinks` 是正式友链数据的唯一存储和管理方。
- `link-submit-next` 只负责自助提交、审核和辅助能力。
- 主题只负责展示及调用插件公开 Finder、API 或 Widget，不实现成员申请或友链存储业务。
- 友链申请采用单一入口：`link-submit-next` 提供弹窗体验并调用官方 `PluginLinks` 公开 API；主题不再保留旧的 `/links/apply/*` 页面表单。
- 版本敏感字段、权限和 API 必须在升级插件前按 Halo 官方文档及目标版本源码重新核对。
