# Nucma Theme 贡献指南

感谢你对 Nucma Theme 项目的关注！我们欢迎任何形式的贡献。

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境设置](#开发环境设置)
- [代码规范](#代码规范)
- [提交 Pull Request](#提交-pull-request)

## 行为准则

- 尊重所有贡献者
- 建设性地讨论问题
- 遵循项目代码规范
- 编写清晰的提交信息

## 如何贡献

### 报告 Bug

1. 在 Issues 中搜索现有问题
2. 如果没有找到，创建新的 Issue
3. 提供详细的错误信息和复现步骤
4. 附上截图（如果适用）

### 提交功能请求

1. 创建新 Issue
2. 详细描述功能需求和用例
3. 说明预期的行为
4. 提供设计思路或截图（如果适用）

### 提交代码

1. Fork 项目仓库
2. 创建功能分支
3. 进行开发
4. 提交 Pull Request

## 开发环境设置

### 环境要求

- Node.js >= 16
- pnpm >= 8（推荐）
- Halo >= 2.22.9

### 克隆仓库

```bash
git clone https://github.com/chenhufei/theme-nucma.git
cd theme-nucma
```

### 安装依赖

```bash
pnpm install
```

### 运行开发模式

```bash
pnpm dev
```

### 构建主题

```bash
pnpm build
```

或使用构建脚本：

**Windows:**
```bash
.\build.ps1
```

**Linux/Mac:**
```bash
./build.sh
```

## 代码规范

### HTML/Thymeleaf 规范

- 使用 2 空格缩进
- 使用语义化标签
- Thymeleaf 属性保持一致的顺序
- 自定义组件使用 `modules/` 目录

### CSS 规范

- 使用 Tailwind CSS 工具类优先
- 自定义样式放在 `src/` 目录
- 保持 CSS 模块化
- 使用 CSS 变量实现主题色

### JavaScript 规范

- 使用现代 ES6+ 语法
- 避免全局变量污染
- 使用 IIFE 或模块封装代码
- 保持代码简洁易读

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例：**
```
feat(post): add lazy loading for images

Implement IntersectionObserver-based lazy loading
for images to improve page load performance.

Closes #123
```

## 项目结构

```
theme-nucma/
├── templates/
│   ├── modules/          # 模块化组件
│   │   ├── common/      # 公共组件
│   │   ├── index/       # 首页模块
│   │   ├── post/        # 文章页模块
│   │   └── ...
│   └── assets/          # 静态资源
├── src/                  # CSS 源码
│   ├── base.css         # 基础样式
│   ├── components.css   # 组件样式
│   ├── lazyload.css     # 懒加载样式
│   └── ...
├── dist/                 # 构建输出
├── theme.yaml           # 主题元数据
├── settings.yaml        # 主题设置
└── package.json         # NPM 配置
```

## 提交 Pull Request

### PR 流程

1. 更新到最新主分支：
   ```bash
   git checkout master
   git pull upstream master
   ```

2. 创建功能分支：
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. 进行开发并提交

4. 构建测试：
   ```bash
   pnpm build
   ```

5. 推送到你的 Fork：
   ```bash
   git push origin feature/your-feature-name
   ```

6. 在 GitHub 上创建 Pull Request

### PR 检查清单

- [ ] 代码构建成功
- [ ] 样式符合设计规范
- [ ] 响应式布局正常
- [ ] 深色模式正常工作
- [ ] 提交信息符合规范
- [ ] PR 描述清晰完整
- [ ] 关联了相关 Issue

## 测试

### 本地测试

1. 构建主题：
   ```bash
   pnpm build
   ```

2. 上传到 Halo 后台测试

3. 检查各页面功能

### 浏览器兼容性

测试以下浏览器：
- Chrome/Edge (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- 移动端浏览器

## 常见任务

### 添加新页面

1. 在 `templates/` 创建页面文件
2. 在 `templates/modules/` 创建对应模块
3. 在 `settings.yaml` 添加配置（如需要）

### 添加新样式

1. 在 `src/` 目录创建 CSS 文件
2. 在 `src/input.css` 导入
3. 重新构建主题

### 修改主题配置

1. 编辑 `settings.yaml`
2. 在模板中使用 `theme.config.xxx` 访问

## 许可证

提交代码即表示你同意将代码以 GPL-3.0 许可证发布。

---

感谢你的贡献！🎉
