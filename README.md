# NUCMA 主题

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Halo Version](https://img.shields.io/badge/Halo-%3E%3D2.0-blue)](https://halo.run)
[![Theme Version](https://img.shields.io/badge/version-1.0.35-green)](https://github.com/chenhufei/theme-nucma/releases)

面向全国高校自媒体联盟（NUCMA）官网的 [Halo 2.0](https://halo.run) 主题。定位为校园媒体组织的公告档案与协作门户，聚焦公告公示、成员展示、友情链接和校园内容沉淀。

🔗 线上演示：[nucma.cn](https://nucma.cn)

---

## ✨ 特性一览

### 视觉与交互

| 特性 | 说明 |
|------|------|
| 深色 / 浅色模式 | 跟随系统自动切换，支持手动切换 |
| Campus Desk 首页 | 服务台风格 Hero，替代传统大横幅 |
| 毛玻璃卡片 | 全局卡片磨砂质感，支持调节强度和密度 |
| 多种背景模式 | 柔和渐变、极光流彩、校园网格、纸张纹理、棱镜折射、夜间模式等 |
| 滚动动画系统 | 基于 IntersectionObserver 的轻量级 AOS 替代方案 |
| 打字机效果 | 首页标题逐字显示，支持循环和减弱动效 |
| 平滑滚动 | 内置 Lenis 平滑滚动，桌面端默认关闭惯性 |

### 首页模块

首页由多个可独立开关的区块组成，在后台「主题设置 → 首页」中配置顺序和可见性：

| 区块 | 功能 |
|------|------|
| Hero | 服务台风格主视觉，展示组织名称、宗旨和服务入口 |
| 组织介绍 | 联盟简介、组织原则（公开/响应/沉淀/连接） |
| 服务方向 | 四个核心场景入口（公开发布、组织说明、校园影像、成员公示） |
| 功能入口 | Halo 生态扩展底座（搜索、友链、图库、瞬间） |
| 文章列表 | 最新公告卡片，支持网格/瀑布流视图切换 |
| 成员公示 | 按地区分组展示成员单位 |
| 友情链接 | 校园伙伴链接卡片 |
| 校园反馈 | 横向自动滚动的评价轮播 |
| 常见问题 | 手风琴式 FAQ 折叠面板 |

### 内容页面

| 页面 | 模板文件 | 说明 |
|------|----------|------|
| 文章详情 | `post.html` | 目录导航、阅读进度、代码高亮、图片灯箱 |
| 归档 | `archives.html` | 按年月分组的时间线 |
| 分类 | `categories.html` | 分类卡片网格 |
| 标签 | `tags.html` | 标签云 |
| 关于 | `page_about.html` | 组织介绍、服务方向、发展脉络、联系方式 |
| 成员列表 | `members.html` | 按地区分组的成员目录，支持申请加入 |
| 友情链接 | `links.html` | 分组展示链接卡片 |
| 登录 / 注册 | `gateway_fragments/` | 分栏式登录页美化 |

### 技术特性

- **XSS 防护** — 所有 API 数据和 shortcode 属性值均经过 HTML 转义
- **localStorage 容错** — 隐私模式 / 存储满时自动降级，不阻塞初始化
- **请求缓存 TTL** — 插件 API 请求缓存 5 分钟自动过期
- **减弱动效支持** — `prefers-reduced-motion` 下禁用所有动画
- **插件可用性保护** — 搜索、友链、图库、瞬间入口仅在对应插件启用时渲染
- **移动端优化** — 独立的移动端模块，长按分享、触控手势、侧边栏菜单

---

## 📦 安装

### 方法一：Halo 后台安装（推荐）

1. 登录 Halo 管理后台
2. 进入「主题」→「安装主题」
3. 搜索「NUCMA」或上传 zip 包
4. 启用主题

### 方法二：手动安装

1. 从 [Releases](https://github.com/chenhufei/theme-nucma/releases) 下载最新 zip
2. 解压到 Halo 的 `themes/theme-nucma` 目录
3. 在后台启用主题

---

## ⚙️ 配置

在 Halo 后台「主题设置」中可自定义以下选项：

<details>
<summary><strong>外观样式</strong></summary>

- 默认配色模式（跟随系统 / 浅色 / 深色）
- 卡片圆角（小 / 中 / 大 / 超大）
- 正文字体（系统默认 / 霞鹜文楷 / MiSans / 自定义）
- 全局背景模式（柔和渐变 / 极光流彩 / 校园网格 / 纸张 / 棱镜 / 夜间 / 纯色 / 图片 / 无）
- 背景图片、透明度、位置
- 毛玻璃强度、折射效果、密度
- 滚动动效 / 平滑滚动 / 返回顶部开关
- 登录页 / 用户中心 / 后台美化开关

</details>

<details>
<summary><strong>首页设置</strong></summary>

- Hero 区块显示 / 隐藏
- 副标题和宗旨文案
- 文章显示数量与封面比例
- 区块顺序和可见性（组织介绍、服务方向、文章、成员、友链、评价、FAQ）

</details>

<details>
<summary><strong>文章页设置</strong></summary>

- 目录导航显示
- 阅读时长 / 字数统计
- 作者信息卡片
- 字号和首行缩进

</details>

<details>
<summary><strong>功能增强</strong></summary>

- 代码块一键复制
- 图片灯箱
- 外链图标
- 阅读进度条
- 首行缩进

</details>

完整配置项详见 [`settings.yaml`](./settings.yaml)。

---

## 🔌 推荐插件

以下插件安装后会自动在首页显示对应入口，未安装时不渲染，不会出现死链：

| 插件 | 说明 | 入口 |
|------|------|------|
| [搜索组件](https://www.halo.run/store/apps/app-DlacW) | 全站搜索 | 首页功能入口 + Header |
| [链接管理](https://www.halo.run/store/apps/app-hfbQg) | 友情链接 | 首页友链区块 + 独立页面 |
| [图库管理](https://www.halo.run/store/apps/app-BmQJW) | 校园图库 | 首页功能入口 |
| [瞬间](https://www.halo.run/store/apps/app-SnwWD) | 校园瞬间 | 首页功能入口 |
| [评论组件](https://www.halo.run/store/apps/app-mXfKp) | 文章评论 | 文章页底部 |

---

## 🛠️ 开发

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/chenhufei/theme-nucma.git
cd theme-nucma

# 安装依赖
pnpm install

# 开发模式（文件变更自动构建）
pnpm dev

# 构建生产版本
pnpm build
```

### 版本发布

```bash
pnpm release:patch   # 1.0.58 → 1.0.59
pnpm release:minor   # 1.0.58 → 1.1.0
pnpm release:major   # 1.0.58 → 2.0.0
```

### 目录结构

```
theme-nucma/
├── src/                          # 源码
│   ├── input.css                 # CSS 入口（Vite 处理）
│   ├── base.css                  # 基础样式 + CSS 变量
│   ├── components.css            # 组件样式（Header/Footer/卡片等）
│   ├── home.css                  # 首页各区块样式
│   ├── prose.css                 # 文章排版样式
│   ├── auth-split.css            # 登录页分栏样式
│   ├── home.js                   # 首页逻辑（区块初始化、API 加载、动画编排）
│   ├── scroll-animations.js      # IntersectionObserver 滚动动画系统
│   ├── theme-shell.js            # Header/Footer/侧边栏/全局壳层
│   ├── plugin-adapter.js         # Halo 插件适配器（友链/成员/瞬间/图库）
│   ├── theme-enhancements.js     # 代码复制、图片灯箱、外链图标等增强
│   ├── theme-config.js           # 合并后台配置与前端默认值
│   ├── theme-init.js             # 主题模式初始化（最先执行）
│   ├── mobile.js                 # 移动端专用优化
│   ├── utils.js                  # 工具函数（debounce、评论、动画辅助）
│   ├── typewriter.js             # 打字机效果类
│   ├── shortcodes.js             # Shortcode 解析器（折叠/标签页/时间线/按钮等）
│   ├── post-page.js              # 文章页专用逻辑
│   ├── archive-timeline.js       # 归档时间线交互
│   ├── lenis-scroll.js           # Lenis 平滑滚动封装
│   └── auth-characters.js        # 登录页装饰动画
├── templates/                    # Thymeleaf 模板
│   ├── modules/
│   │   ├── layout/layout.html    # 全局 HTML 骨架
│   │   ├── common/               # Header、Footer、Scripts 公共片段
│   │   ├── index/                # 首页模块
│   │   ├── post/                 # 文章页模块
│   │   ├── about/                # 关于页模块
│   │   ├── members/              # 成员页模块
│   │   ├── links/                # 友链页模块
│   │   └── ...                   # 其他页面模块
│   ├── gateway_fragments/        # 登录/注册页模板
│   ├── assets/                   # 构建产物（JS/CSS/SVG）
│   ├── index.html                # 首页入口
│   ├── post.html                 # 文章页入口
│   └── ...                       # 其他页面入口
├── assets/                       # 静态资源源文件
├── i18n/                         # 国际化语言包（en / zh_CN）
├── docs/                         # 文档
├── scripts/                      # 构建脚本
├── theme.yaml                    # 主题元数据
├── settings.yaml                 # 主题设置表单定义
├── vite.config.js                # Vite 构建配置
└── tailwind.config.js            # Tailwind CSS 配置
```

### 构建流程

```
src/*.css  ──→  Vite (PostCSS + Tailwind)  ──→  templates/assets/css/main.css
src/*.js   ──→  scripts/build.js (原样复制)  ──→  templates/assets/js/*.js
```

JS 文件不做打包压缩，保持可读性，由 Halo 直接提供给浏览器。CSS 由 Vite 处理（Tailwind JIT + 压缩）。

---

## 🎯 动画系统

主题内置两个动画层，自动协调工作：

### 1. 滚动动画（scroll-animations.js）

基于 `IntersectionObserver`，元素进入视口时触发：

```html
<!-- 基础淡入 -->
<div class="reveal">内容</div>

<!-- 方向变体 -->
<div class="reveal-up">向上淡入</div>
<div class="reveal-left">从左滑入</div>
<div class="reveal-scale">缩放淡入</div>

<!-- 延迟控制 -->
<div class="reveal" data-aos-delay="200">延迟 200ms</div>

<!-- 交错组 -->
<div class="stagger-group">
  <div class="stagger-item">第 1 项</div>
  <div class="stagger-item">第 2 项</div>
  <div class="stagger-item">第 3 项</div>
</div>
```

### 2. 首页编排动画（home.js）

首页使用独立的动画编排系统，自动为各区块元素分配入场方向和延迟：

- Hero 区域：左侧滑入（文案）、右侧滑入（面板）
- 卡片类：统一缩放入场
- 文本类：柔和上浮
- 支持 `MutationObserver` 动态内容

### 3. 打字机效果（typewriter.js）

```html
<h1 data-typewriter="欢迎来到 NUCMA"></h1>

<!-- 完整配置 -->
<h1
  data-typewriter="Hello, World!"
  data-typewriter-speed="80"
  data-typewriter-delay="500"
  data-typewriter-loop="true"
></h1>
```

---

## 🌐 国际化

语言包位于 `i18n/` 目录：

- `zh_CN.yaml` — 简体中文（默认）
- `en.yaml` — 英文

在 Halo 后台切换站点语言即可生效。

---

## 🤝 贡献

欢迎贡献代码、报告 Bug 或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

### 代码规范

- CSS 使用 Tailwind 工具类 + BEM 命名的自定义类
- JS 使用 ES6+ 模块风格，IIFE 封装避免全局污染
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)

---

## 📝 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解版本更新记录。

---

## 📄 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。

## 🙏 致谢

- [Serenity-Grace](https://github.com/atangccc/Serenity-Grace) — 主题设计灵感
- [theme-earth](https://github.com/halo-sigs/theme-earth) — Halo 官方主题最佳实践
- [Tailwind CSS](https://tailwindcss.com/) — CSS 框架
- [Lenis](https://github.com/darkroomengineering/lenis) — 平滑滚动

---

**Made with ❤️ by NUCMA**
