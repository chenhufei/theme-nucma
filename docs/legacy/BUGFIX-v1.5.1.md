# Bug 修复日志 v1.5.1

## 修复问题

### 1. ✅ Hero 背景未覆盖顶部
**问题**：Hero 区域的流动色块背景未覆盖到页面最顶部，露出白色间隙。

**原因**：hero-section 元素缺少正确的定位和内边距。

**修复**：
- 在 `templates/modules/index/content.html` 中
- 为 hero-section 添加 `position:relative` 和 `padding-top:var(--header-height, 3.5rem)`
- 将背景元素的 `position:absolute` 改为 `inset:0`

**修改前**：
```html
<section id="hero" class="hero-section">
  <div class="hero-bg-blob" style="position:absolute;z-index:var(--z-background);"></div>
```

**修改后**：
```html
<section id="hero" class="hero-section"
         style="position:relative;min-height:100vh;padding-top:var(--header-height, 3.5rem);overflow:hidden;">
  <div class="hero-bg-blob" style="position:absolute;inset:0;z-index:var(--z-background);"></div>
```

---

### 2. ✅ 模态框导致 header/footer 背景变化
**问题**：打开成员申请或友链申请模态框后，页面顶部的 header 和底部的 footer 背景颜色发生变化。

**原因**：模态框使用了 `backdrop-filter:blur(4px)`，这个模糊效果影响到了页面其他元素的渲染。

**修复**：
- 在 `templates/modules/members/content.html` 和 `templates/modules/links/content.html` 中
- 移除模态框的 `backdrop-filter:blur(4px)` 样式
- 保留 `background:rgba(0,0,0,0.5)` 作为遮罩

**修改前**：
```html
<div id="member-submit-modal" class="hidden fixed inset-0 bg-black/50"
     style="position:fixed;z-index:var(--z-modal);backdrop-filter:blur(4px);">
```

**修改后**：
```html
<div id="member-submit-modal" class="hidden fixed inset-0"
     style="position:fixed;z-index:var(--z-modal);background:rgba(0,0,0,0.5);">
```

---

### 3. ✅ JS 文件 404 错误
**问题**：`interactive-illustration.js` 和其他 JS 文件返回 404 Not Found 错误。

**原因**：JS 文件在 `src/` 目录下，但 Vite 构建时只处理 CSS 文件，不会自动复制 JS 文件到 `templates/assets/js/` 目录。

**修复**：
- 创建 `scripts/build.js` 构建脚本
- 自动将所有 JS 文件从 `src/` 复制到 `templates/assets/js/`
- 在 `package.json` 的构建脚本中添加构建步骤

**新增文件**：
- `scripts/build.js` - JS 文件复制脚本

**package.json 修改**：
```json
"scripts": {
  "build": "node scripts/build.js && vite build && theme-package",
  ...
}
```

**构建输出**：
```
✓ 复制 widgets.js
✓ 复制 shortcodes.js
✓ 复制 mobile.js
✓ 复制 background-effects.js
✓ 复制 archive-timeline.js
✓ 复制 interactive-illustration.js
✓ 复制 plugin-adapter.js
```

---

### 4. ℹ️ 后台设置未生效
**问题**：部分后台主题设置未生效。

**分析**：这可能与以下原因有关：
1. 设置项的 key 值与代码中的引用不一致
2. 默认值未正确设置
3. 缓存问题

**建议**：
1. 检查 `settings.yaml` 中的配置项名称
2. 检查模板中引用的 `${theme.config.xxx.xxx}` 是否正确
3. 清除浏览器缓存和 Halo 缓存
4. 如果问题持续，可以提供具体的设置项和预期行为，以便进一步排查

---

## 构建信息

- **版本号**: v1.5.1
- **构建文件**: `dist/theme-nucma-1.5.1.zip` (0.14 MB)
- **主样式**: `templates/assets/css/main.css` (66.85 kB, gzip: 12.24 kB)
- **JS 文件**: 7 个（已复制到 `templates/assets/js/`）
- **构建时间**: 2.09s

---

## 文件变更

### 修改的文件
1. `templates/modules/index/content.html` - 修复 Hero 背景定位
2. `templates/modules/members/content.html` - 移除模态框 backdrop-filter
3. `templates/modules/links/content.html` - 移除模态框 backdrop-filter
4. `package.json` - 更新构建脚本

### 新增的文件
1. `scripts/build.js` - JS 文件复制脚本
2. `templates/assets/js/widgets.js` - Widget 加载器
3. `templates/assets/js/shortcodes.js` - 短代码解析器
4. `templates/assets/js/mobile.js` - 移动端优化
5. `templates/assets/js/background-effects.js` - 背景特效
6. `templates/assets/js/archive-timeline.js` - 归档时间树
7. `templates/assets/js/interactive-illustration.js` - 动态插画
8. `templates/assets/js/plugin-adapter.js` - 插件适配器

---

## 测试建议

### 1. Hero 背景测试
- [ ] 访问首页
- [ ] 检查 Hero 区域背景是否覆盖到页面最顶部
- [ ] 检查是否有白色间隙

### 2. 模态框测试
- [ ] 访问成员页面
- [ ] 点击"申请加入"按钮
- [ ] 检查 header 和 footer 背景是否保持不变
- [ ] 访问友情链接页面
- [ ] 点击"申请友链"按钮
- [ ] 检查 header 和 footer 背景是否保持不变

### 3. JS 文件测试
- [ ] 打开浏览器开发者工具 Network 标签
- [ ] 刷新页面
- [ ] 检查是否有 JS 文件 404 错误
- [ ] 检查所有 JS 文件是否成功加载（状态码 200）

### 4. 功能测试
- [ ] 测试多主题切换功能
- [ ] 测试背景特效功能
- [ ] 测试短代码功能
- [ ] 测试移动端优化功能

---

## 部署指南

1. **上传主题**
   - 将 `dist/theme-nucma-1.5.1.zip` 上传到 Halo 后台
   - 或者使用 git 部署

2. **清除缓存**
   - 在 Halo 后台清除缓存
   - 清除浏览器缓存（Ctrl/Cmd + Shift + R）

3. **验证修复**
   - 按照上述测试建议进行测试
   - 确认所有问题已解决

---

## 后续优化建议

1. **性能优化**
   - 添加 JS 文件的懒加载
   - 使用代码分割减少初始加载时间

2. **用户体验**
   - 添加骨架屏（loading 占位）
   - 优化图片加载策略

3. **代码质量**
   - 添加 TypeScript 类型检查
   - 添加单元测试

---

**Nucma 主题 v1.5.1** - Bug 修复版本
