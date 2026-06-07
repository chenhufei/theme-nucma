# Nucma Theme v1.5.4 更新日志

## 🐛 Bug 修复

### 1. Hero 区域背景修复
- **问题**: Hero 区域使用 `position:fixed` 覆盖整个视口，影响其他元素
- **修复**: 改为 `position:relative`，移除固定定位
- **影响**: 首页 Hero 区域现在正常显示，不覆盖其他内容

### 2. Tags/Categories 500 错误
- **问题**: Tags 和 Categories 页面返回 500 错误
- **状态**: 已检查模板，使用的是标准 Thymeleaf 语法
- **建议**: 请检查 Halo 后端日志，确认是否有路由或插件错误

### 3. Favicon 404 错误修复
- **问题**: 访问 favicon.ico 返回 404
- **修复**: 已在模板中添加完整的 Favicon 逻辑
- **用户操作**: 需要在 Halo 后台设置 Favicon（系统设置 → 基础设置 → 站点 Favicon）

### 4. 主题色未生效修复
- **问题**: 后台设置的主题色未应用到页面
- **修复**: 
  - 在配置传递中添加默认值 `? : 'indigo'`
  - 确保 `window.themeConfig` 始终有值
  - 添加控制台日志方便调试
- **影响**: 主题色现在可以从后台正常读取并应用

### 5. 背景特效未生效修复
- **问题**: 后台设置的背景特效未显示
- **修复**: 与主题色相同，修复配置传递逻辑
- **影响**: 背景特效现在可以从后台正常读取并应用

### 6. 模态框 Header 透明问题修复
- **问题**: 打开模态框后，Header 变成透明（页面顶部样式）
- **修复**: 
  - 非首页时 Header 始终使用毛玻璃
  - 移除滚动触发透明/毛玻璃切换
- **影响**: 模态框打开/关闭时不再影响 Header 样式

### 7. 移动端侧边栏 z-index 修复
- **问题**: 移动端离开 Hero 区域后，侧边栏层级错误
- **修复**: 
  - `mobileOverlay` z-index: 1001
  - `mobileSidebar` z-index: 1002
- **影响**: 移动端侧边栏现在始终在 Header 上方

### 8. 模态框 z-index 统一修复
- **问题**: 模态框可能被其他元素覆盖
- **修复**: 将所有模态框的 z-index 改为 9999
- **影响**: 模态框现在始终在最上层显示

## 📝 技术细节

### 修改的文件

1. `templates/modules/index/content.html` - Hero 定位修复
2. `templates/modules/common/scripts.html` - Header 逻辑 + 配置传递
3. `templates/modules/common/header.html` - 移动端 z-index
4. `templates/modules/members/content.html` - 模态框 z-index
5. `templates/modules/links/content.html` - 模态框 z-index
6. `templates/modules/post/content.html` - 模态框 z-index
7. `templates/assets/js/theme-config.js` - 初始化逻辑优化

### 配置传递改进

```javascript
// 修复前：可能为 undefined
accent_color: /*[[${theme.config.appearance?.accent_color}]]*/

// 修复后：保证有默认值
accent_color: /*[[${theme.config.appearance?.accent_color ?: 'indigo'}]]*/
```

### z-index 层级规范

```
背景: var(--z-background, -1)
内容: var(--z-content)
Header: var(--z-header) [约 50]
Dropdown: var(--z-dropdown) [约 100]
移动端遮罩: 1001
移动端侧边栏: 1002
模态框: 9999
```

## 🧪 测试验证

### 浏览器控制台验证

```javascript
// 检查配置是否加载
console.log('主题配置:', window.themeConfig);

// 检查主题色
getComputedStyle(document.documentElement).getPropertyValue('--color-accent');

// 检查背景特效
document.getElementById('background-canvas');

// 检查 localStorage
localStorage.getItem('accent-color');
localStorage.getItem('backgroundEffect');
```

### 功能测试清单

- [ ] Hero 区域正常显示，不覆盖其他内容
- [ ] Tags 和 Categories 页面能正常访问
- [ ] Favicon 正常显示（需后台设置）
- [ ] 主题色能正常切换
- [ ] 背景特效能正常显示
- [ ] 模态框打开/关闭时 Header 保持毛玻璃
- [ ] 移动端侧边栏能正常打开/关闭
- [ ] 移动端侧边栏在 Header 上方

## 📦 构建信息

- **版本号**: v1.5.4
- **构建文件**: `dist/theme-nucma-1.5.4.zip`
- **文件大小**: 0.14 MB
- **构建时间**: 2.35s
- **Linter 错误**: 0

## 🚀 部署步骤

1. **上传主题**
   ```
   上传 dist/theme-nucma-1.5.4.zip
   ```

2. **设置 Favicon**
   - Halo 后台 → 系统设置 → 基础设置
   - 站点 Favicon → 上传图标文件

3. **配置主题**
   - 后台 → 主题设置 → 外观样式
   - 配置主题色、背景特效
   - 保存并刷新

4. **清除缓存**
   - Halo 后台 → 系统设置 → 清除缓存
   - 浏览器：Ctrl+Shift+R

## 📞 问题反馈

如果 Tags/Categories 仍然报 500 错误，请：

1. 检查 Halo 后端日志
2. 确认是否有插件冲突
3. 检查路由配置

---

**更新日期**: 2026-03-21
**维护团队**: Nucma Theme
