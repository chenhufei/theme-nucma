# Nucma 主题 - Halo 插件适配方案

## 一、Nucma 主题定位分析

Nucma 是全国高校自媒体联盟官网主题，核心功能：
- 首页 Hero + 组织介绍 + 服务卡片 + 文章列表 + 成员公示 + 反馈 + FAQ
- 文章详情页（带目录、阅读进度、点赞、社交分享）
- 关于页、归档页、成员页、友链页、瞬间页
- 深色模式、多种背景模式、玻璃态卡片
- 社交链接、页脚备案、弹窗通知
- 登录/注册页美化、用户中心美化

settings.yaml 已有 181 个配置项，预留了 PluginPhotos、PluginGallery、PluginSearchWidget、PluginLinks、PluginMoments 等插件的 key。

---

## 二、20 个上架插件适配评估

### ✅ P0 核心适配（必须做）

| # | 插件 | 类型 | 适配方式 | 理由 |
|---|------|------|----------|------|
| 1 | 文章组件 | 插件 | 主题集成样式容器 | 联盟公告/文章需要富文本排版（提示框、标签页、折叠面板、聊天气泡、时间线、步骤等 20+ 组件） |
| 2 | 自定义社交分享卡片 | 插件 | 主题 header 注入 | 微信/QQ 分享是联盟内容传播核心渠道，复用 Nucma logo 和品牌色 |

### ✅ P1 重要适配（推荐做）

| # | 插件 | 类型 | 适配方式 | 理由 |
|---|------|------|----------|------|
| 3 | 文章加密 | 插件 | 模板条件渲染 + Nucma glass 样式 | 联盟内部公告/文件需加密访问 |
| 4 | 全局私密 | 插件 | 自动兼容 | 纯后端插件，配合 Nucma enable_login_style 即可 |
| 5 | 图库 (PluginPhotos/PluginGallery) | 插件/主题 | 主题模板已预留 | settings.yaml 服务卡片已有 PluginPhotos/PluginGallery 配置项，/photos 页面适配 |
| 6 | 友链 (PluginLinks) | 插件 | 主题模板已预留 | settings.yaml 有 PluginLinks 配置项，友链页 + footer social_links 适配 |
| 7 | 瞬间 (PluginMoments) | 插件 | 主题模板已预留 | settings.yaml 有 PluginMoments 配置项，/moments 页面适配 |
| 8 | 搜索组件 (PluginSearchWidget) | 插件 | 主题模板已预留 | settings.yaml 有 search_expand_mode，header 搜索框适配 |

### ✅ P2 增值适配（可选）

| # | 插件 | 类型 | 适配方式 | 理由 |
|---|------|------|----------|------|
| 9 | Bark 推送 | 插件 | 自动兼容 | 评论/注册通知推送到 iOS，纯后端 |
| 10 | 在线显示 | 插件 | 页脚集成 | 在 footer 添加在线人数统计卡片 |
| 11 | 轻言 | 插件 | 首页集成 | 可替代/增强现有 motto 功能 |
| 12 | RSS 订阅 | 功能 | 主题集成 | footer 已有 RSS 链接配置，添加 RSS 图标样式 |

### ❌ 不兼容/不相关

| # | 插件 | 原因 |
|---|------|------|
| 1 | Floating Particles | Nucma 已有 7 种背景模式，追求专业简洁风格 |
| 2 | Huohuo Weather Glass | 另一个主题，与 Nucma 冲突 |
| 3 | Vahlok | 另一个主题 |
| 4 | 业余无线电 QSL 卡片管理 | 垂直领域，不匹配高校联盟定位 |
| 5 | 微信读书 | 个人化，不适合联盟官网 |
| 6 | Halorum | 论坛风格，定位不同 |
| 7 | KMath | 学术公式，联盟公告不需要 |
| 8 | Navidrome 播放器 | 音乐播放器不适合 |
| 9 | 家庭私厨 | 完全不相关 |
| 10 | 归 | 另一个主题 |
| 11 | Sky Blog 3(macOS) | 另一个主题 |

---

## 三、settings.yaml 已预留的插件适配点

| 插件 | settings.yaml 中的预留项 | 说明 |
|------|--------------------------|------|
| PluginPhotos / PluginGallery | service_cards 中的 PluginPhotos/PluginGallery | 服务卡片"校园影像"指向 /photos |
| PluginSearchWidget | search_expand_mode + show_search | 顶部导航搜索框 |
| PluginLinks | footer social_links 配置 | 友链页 + footer 社交图标 |
| PluginMoments | footer footer_columns 中的 PluginMoments | 瞬间页链接 |
| RSS | footer social_links 中的 RSS | /rss.xml 链接 |

---

## 四、适配实施方案

### Phase 1: 文章组件适配（P0，预计 1-2 天）
- [ ] settings.yaml 添加 enable_content_widgets 配置项
- [ ] post/content.html 添加文章组件样式容器
- [ ] base.css/components.css 适配 20+ 组件样式
- [ ] 深色模式颜色适配
- [ ] 测试各组件在 Nucma 卡片风格下渲染

### Phase 2: 社交分享卡片适配（P0，预计 1 天）
- [ ] header.html 添加 og/twitter/meta 标签注入点
- [ ] 复用 logo_image 配置作为分享封面
- [ ] 使用 brand-red 作为分享卡片主色
- [ ] footer social_links 复用为社交图

### Phase 3: 文章加密适配（P1，预计半天）
- [ ] post/content.html 添加加密内容提示样式
- [ ] 适配 Nucma glass 卡片风格
- [ ] 加密输入框使用 Nucma 表单样式

### Phase 4: 已预留插件页面兼容性验证（P1，预计 2 天）
- [ ] 验证 /photos 页面（图库）模板渲染
- [ ] 验证 /moments 页面（瞬间）模板渲染
- [ ] 验证 /links 页面（友链）模板渲染
- [ ] 验证 header 搜索框与 PluginSearchWidget 兼容性
- [ ] 更新 theme.yaml features 声明

### Phase 5: 在线显示集成（P2，预计半天）
- [ ] footer.html 添加在线人数显示区块
- [ ] 使用 Nucma 统计卡片样式
- [ ] 深色模式适配

### Phase 6: RSS 图标集成（P2，预计 1 小时）
- [ ] footer.html RSS 链接添加 RSS 图标
- [ ] 适配 Nucma 图标系统

---

## 五、优先级建议

**用户说"你决定"，建议按此顺序执行：**

1. **文章组件** (P0) — 文章排版刚需
2. **社交分享卡片** (P0) — 微信/QQ 传播刚需
3. **文章加密** (P1) — 内部内容保护
4. **已预留插件页面验证** (P1) — 确保现有预留正确
5. **在线显示** (P2) — 运营数据
6. **RSS 集成** (P2) — 内容分发

开始执行？
