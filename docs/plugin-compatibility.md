# 插件适配矩阵

本表区分“存在主题集成”和“已经在目标 Halo 实例完整验证”。插件可以安装或模板可以渲染，不等于全部业务流程已经兼容。

| 插件 | 主题集成 | 当前契约 | 降级行为 | 运行验证 |
|---|---|---|---|---|
| PluginMembers | 成员分组、成员列表、申请 Widget | `pluginFinder.available`、`memberFinder.listApprovedMembers()`、`MemberApplyWidget` | 未启用时不调用 Finder，并显示统一缺失提示 | 待目标实例复验 |
| PluginLinks（Halo 官方） | 友链分组、列表和官方申请 | `pluginFinder.available`、`simpleGroups`、`groups`、`linkApplicationEnabled`、`csrfToken` | 未启用时不读取友链并显示统一缺失提示；申请能力关闭时不显示表单 | 官方 2.3.0 契约，待目标实例复验 |
| link-submit-next | 友链自助提交增强入口 | `LinkSubmitWidget.open()` | 与官方 PluginLinks 共存时优先使用增强弹窗；未启用时回退到官方原生申请表单 | 1.2.3 源码契约，待目标实例复验 |
| PluginSearchWidget | 顶部搜索入口 | `SearchWidget.open()` | 未启用时隐藏搜索按钮 | 待目标实例复验 |
| 评论组件 | 文章、页面、成员、友链评论 | `haloCommentEnabled`、`halo:comment` | 未启用或页面禁用评论时不渲染 | 待目标实例复验 |

## 职责边界

- `PluginLinks` 是正式友链数据的唯一存储和管理方。
- `link-submit-next` 只负责自助提交、审核和辅助能力。
- 主题只负责展示及调用插件公开 Finder、API 或 Widget，不实现成员申请或友链存储业务。
- 友链申请采用能力降级：`link-submit-next` 提供增强体验，官方 `PluginLinks` 提供原生同源表单；两者均未启用时不显示误导性的申请入口。
- 版本敏感字段、权限和 API 必须在升级插件前按 Halo 官方文档及目标版本源码重新核对。
