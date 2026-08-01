# Theme Nucma

> 一款为 Halo 设计的现代化、极简主义主题，专注提供极致的 UI/UX 体验。

## ✨ 特性

- **现代化 UI/UX 设计**：采用极简主义设计语言，优化视觉层次与阅读体验。
- **平滑黑夜模式 (Dark Mode)**：提供优雅的黑夜模式切换动画（非突兀白屏），保护视力。
- **GSAP 高性能动画**：全站滚动与交互采用 GSAP 动画引擎，丝滑流畅；在无 JS 情况下拥有完美兜底。
- **增强组件**：内置 FAQ 手风琴、返回顶部按钮特效、优雅的导航栏交互等。
- **高度响应式**：针对移动端、平板、桌面端均进行了细致适配，Header 与 Footer 布局更合理。

## 📦 安装与使用

1. 在 Halo 后台的 **外观 -> 主题** 中点击 **安装主题**。
2. 上传本主题的 `.zip` 压缩包。
3. 启用主题，并在主题设置中进行个性化配置（背景、主色调等）。

## 🛠️ 开发指南

本主题使用 Vite、Tailwind CSS 和 esbuild 构建，并通过 Halo 官方主题打包工具生成安装包。

开发环境需要 Node.js 22.12.0 或更高版本。

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行主题契约检查
npm run check

# 构建完整主题安装包并检查 ZIP 内容
npm run package
```

发布前请同时查看[插件适配矩阵](docs/plugin-compatibility.md)和[发布验收清单](docs/release-checklist.md)。
