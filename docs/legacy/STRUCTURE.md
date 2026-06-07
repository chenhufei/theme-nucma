# 项目结构规范

## 目录说明

### `/src` - 源代码目录
存放所有 CSS 源文件，使用 Tailwind CSS 和 PostCSS 处理。

- `input.css` - CSS 入口文件，导入所有模块
- `base.css` - 基础样式、CSS 变量定义、全局重置
- `components.css` - 可复用组件样式（卡片、按钮、导航等）
- `hero.css` - 首页 Hero 区块的特殊效果
- `prose.css` - 文章内容的排版样式
- `reviews.css` - 用户评价区块的滚动动画

### `/templates` - 模板目录
存放所有 Thymeleaf 模板文件。

#### 页面模板（根目录）
- `index.html` - 首页
- `post.html` - 文章详情页
- `page.html` - 独立页面
- `page_about.html` - 关于页（特殊页面）
- `archives.html` - 归档页
- `categories.html` - 分类页
- `tags.html` - 标签页
- `links.html` - 友链页
- `members.html` - 成员页
- `login.html` - 登录页
- `signup.html` - 注册页

#### `/templates/modules` - 模块化组件
采用模块化设计，每个页面类型有独立目录。

**通用模块 `/modules/common/`**
- `header.html` - 顶部导航栏
- `footer.html` - 页脚
- `scripts.html` - 全局 JavaScript
- `components.html` - 可复用的 HTML 组件

**页面模块**
每个页面模块包含：
- `layout.html` - 页面布局框架
- `content.html` - 页面内容实现

模块列表：
- `/modules/index/` - 首页模块
- `/modules/post/` - 文章页模块
- `/modules/page/` - 页面模块
- `/modules/about/` - 关于页模块
- `/modules/archives/` - 归档模块
- `/modules/categories/` - 分类模块
- `/modules/tags/` - 标签模块
- `/modules/links/` - 友链模块
- `/modules/members/` - 成员模块

#### `/templates/assets` - 静态资源
- `/assets/css/main.css` - 编译后的 CSS（由 Vite 生成）
- `/assets/avatar-nucma.svg` - 主题 Logo

### `/dist` - 构建输出
存放打包后的主题 ZIP 文件，由 `theme-package` 工具生成。

### 配置文件

#### 主题配置
- `theme.yaml` - 主题元数据（名称、版本、作者等）
- `settings.yaml` - 主题设置表单定义

#### 构建配置
- `package.json` - NPM 依赖和脚本
- `vite.config.js` - Vite 构建配置
- `tailwind.config.js` - Tailwind CSS 配置
- `postcss.config.js` - PostCSS 插件配置
- `build.gradle` - Gradle 配置（可选）

#### 构建脚本
- `build.ps1` - Windows 构建脚本
- `build.sh` - Linux/Mac 构建脚本

## 命名规范

### 文件命名
- 模板文件：小写字母 + 下划线，如 `page_about.html`
- CSS 文件：小写字母 + 连字符，如 `components.css`
- 配置文件：小写字母 + 点号，如 `vite.config.js`

### CSS 类命名
- 使用 Tailwind CSS 工具类优先
- 自定义类使用 BEM 命名法或语义化命名
- 组件类：`.component-name`
- 状态类：`.is-active`, `.has-error`

### 模块命名
- 目录名：小写字母，如 `index/`, `post/`
- 模块文件：`layout.html`, `content.html`

## 开发流程

### 1. 修改样式
编辑 `/src` 目录下的 CSS 文件 → 运行 `pnpm dev` 或 `pnpm build`

### 2. 修改模板
编辑 `/templates` 目录下的 HTML 文件 → 直接生效（无需编译）

### 3. 添加新页面
1. 在 `/templates` 创建页面文件
2. 在 `/templates/modules` 创建对应模块目录
3. 创建 `layout.html` 和 `content.html`
4. 在页面文件中引用模块

### 4. 构建主题
运行 `pnpm build` 或 `./build.ps1` / `./build.sh`

## 版本管理

版本号遵循语义化版本规范（Semantic Versioning）：

- **主版本号**：不兼容的 API 修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

需要同步更新：
1. `package.json` 中的 `version`
2. `theme.yaml` 中的 `version`

## 注意事项

### 不要提交的文件
- `node_modules/` - 依赖包
- `dist/` - 构建产物
- `build/` - Gradle 构建目录
- `templates/assets/css/` - 编译后的 CSS
- `*.zip` - 打包文件
- 临时文件和日志

### 必须提交的文件
- 所有源代码（`/src`, `/templates`）
- 配置文件（`*.yaml`, `*.json`, `*.js`）
- 构建脚本（`*.ps1`, `*.sh`）
- 文档文件（`*.md`）

## 最佳实践

1. **模块化**：保持模块独立，避免过度耦合
2. **可复用**：将通用组件提取到 `common/components.html`
3. **语义化**：使用有意义的类名和变量名
4. **注释**：为复杂逻辑添加注释
5. **性能**：优化图片、减少 HTTP 请求、使用 CSS 变量
6. **兼容性**：测试不同浏览器和设备
7. **可访问性**：使用语义化 HTML，添加 ARIA 属性
