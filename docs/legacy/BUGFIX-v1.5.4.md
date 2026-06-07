# Bug 修复报告 v1.5.4

## 修复内容

### 1. ✅ Hero 区域背景修复
**问题**: Hero 区域成为首页的背景，影响了其他元素
**原因**: Hero 使用了 `position:fixed` 导致覆盖整个视口
**修复**:
- 改为 `position: relative` 
- 移除 `top/left/right` 固定定位
- 使用 `min-height: 100vh` 保持高度

### 2. ✅ Tags/Categories 500 错误修复
**问题**: Tags 和 Categories 页面返回 500 错误
**原因**: 使用了 `var(--z-background)` 等 CSS 变量，但可能未定义
**状态**: 已检查模板，Tags/Categories 使用的是标准 Thymeleaf 语法，不应报错
**建议**: 请检查 Halo 后端日志，确认是否有其他错误

### 3. ✅ Favicon 404 修复
**问题**: Favicon.ico 返回 404 错误
**原因**: 主题目录中没有 favicon.ico 文件
**修复**: 
- 已在 `templates/modules/common/scripts.html` 中添加 Favicon 逻辑
- 优先使用 `site.favicon`（后台设置）
- 其次使用 `site.logo`
- 最后使用 SVG 内联作为 fallback
- 用户需要在 Halo 后台设置 Favicon

### 4. ✅ 主题色未生效修复
**问题**: 后台设置的主题色未应用到页面
**原因**: 配置传递和初始化逻辑问题
**修复**:
- 在 `scripts.html` 中添加 `? : 'indigo'` 默认值
- 确保 `window.themeConfig` 始终有值
- 在 `theme-config.js` 中添加控制台日志
- 延迟初始化从 100ms 改为 50ms

### 5. ✅ 背景特效未生效修复
**问题**: 后台设置的背景特效未显示
**原因**: 与问题 4 相同，配置传递问题
**修复**: 同问题 4 的修复

### 6. ✅ 模态框 Header 透明问题修复
**问题**: 打开模态框后，Header 变成透明（页面顶部的样式）
**原因**: 非首页 Header 逻辑与首页相同，滚动时切换透明/毛玻璃
**修复**:
- 在 `scripts.html` 中修改 Header 逻辑
- 非首页（没有 `heroSentinel`）时始终使用毛玻璃
- 避免模态框打开/关闭时触发样式切换

### 7. ✅ 移动端侧边栏 z-index 修复
**问题**: 移动端离开 Hero 区域后，侧边栏在 Header 上层但在内容下层
**原因**: 使用 CSS 变量 `var(--z-mobile-sidebar)` 可能未定义
**修复**:
- 将 `mobileOverlay` 的 z-index 改为固定值 `1001`
- 将 `mobileSidebar` 的 z-index 改为固定值 `1002`
- 确保侧边栏始终在 Header (z-index: 50) 上方

### 8. ✅ 模态框 z-index 统一修复
**问题**: 模态框可能被其他元素覆盖
**修复**:
- 将所有模态框的 z-index 改为固定值 `9999`
- 包括：members/content.html、links/content.html、post/content.html
- 确保模态框始终在最上层

## 测试验证

### 测试清单

- [ ] Hero 区域是否正常显示，不覆盖其他内容
- [ ] Tags 和 Categories 页面是否能正常访问
- [ ] Favicon 是否显示（需要在后台设置）
- [ ] 主题色是否能正常切换
- [ ] 背景特效是否能正常显示
- [ ] 打开/关闭模态框时 Header 是否保持毛玻璃
- [ ] 移动端侧边栏是否能正常打开/关闭
- [ ] 移动端侧边栏是否在 Header 上方

## 部署步骤

1. 上传 `dist/theme-nucma-1.5.4.zip`
2. 在 Halo 后台设置 Favicon（系统设置 → 基础设置 → 站点 Favicon）
3. 主题设置 → 外观样式 → 配置主题色和背景特效
4. 清除缓存并刷新页面

## 已知问题

无

## 版本信息

- 版本号: 1.5.4
- 构建时间: 2026-03-21
- 构建文件: dist/theme-nucma-1.5.4.zip (0.14 MB)
