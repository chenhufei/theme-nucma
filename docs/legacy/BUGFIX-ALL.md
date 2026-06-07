# Nucma 主题问题修复指南 v1.5.3

## 📋 问题清单

### 1. ✅ Hero 背景未覆盖到页面最顶端
**原因**：`padding-top` 导致背景从 header 下方开始
**修复**：调整 hero-section 的定位

### 2. ✅ 模态框导致 header 透明 + 页面跳转
**原因**：backdrop-filter 影响其他元素，模态框关闭时恢复滚动位置
**修复**：移除 backdrop-filter，优化滚动恢复逻辑

### 3. ℹ️ Tags/Categories 页面 500 错误
**原因**：Halo 后端路由问题，需要检查插件或路由配置

### 4. ❌ 主题色切换未生效
**原因**：配置未从后端传递到前端
**修复**：添加配置初始化脚本

### 5. ❌ 背景特效未生效
**原因**：配置未从后端读取
**修复**：添加后台配置读取

### 6. ℹ️ 短代码测试位置
**说明**：在文章内容中使用短代码

### 7. ℹ️ 移动端优化测试
**说明**：在移动设备上测试或使用开发者工具

### 8. ❌ 1.5.2 后台设置未生效
**原因**：配置项名称或默认值问题
**修复**：验证并修复配置项

---

## 🔧 修复方案

### 问题 1: Hero 背景覆盖

```html
<!-- 修改 templates/modules/index/content.html -->
<section id="hero" class="hero-section"
         style="position:fixed;inset:0;z-index:var(--z-background);height:100vh;">
```

### 问题 2: 模态框优化

```html
<!-- 修改 templates/modules/members/content.html -->
<div id="member-submit-modal" 
     class="hidden fixed inset-0 flex items-center justify-center p-4"
     style="position:fixed;z-index:var(--z-modal);background:rgba(0,0,0,0.5);"
     role="dialog" aria-modal="true">
```

```javascript
// 修改模态框关闭逻辑
function closeModal() {
  const modal = document.getElementById('member-submit-modal');
  const body = document.body;
  
  modal.classList.add('hidden');
  body.classList.remove('modal-open');
  body.style.overflow = '';
  body.style.paddingRight = '';
}
```

### 问题 4: 主题色初始化

```javascript
// 在页面加载时读取后台配置
<script th:inline="javascript">
(function() {
  'use strict';
  
  // 从后台读取默认主题色
  const defaultColor = /*[[${theme.config.appearance?.accent_color}]]*/ 'indigo';
  const savedColor = localStorage.getItem('accent-color') || defaultColor;
  
  // 应用主题色
  const colorMap = {
    indigo: '99 102 241',
    purple: '168 85 247',
    // ... 其他颜色
  };
  
  const rgb = colorMap[savedColor] || colorMap.indigo;
  document.documentElement.style.setProperty('--color-accent', rgb);
})();
</script>
```

### 问题 5: 背景特效初始化

```javascript
// 在页面加载时读取后台配置
<script th:inline="javascript">
(function() {
  'use strict';
  
  // 从后台读取背景特效配置
  const defaultEffect = /*[[${theme.config.appearance?.background_effect}]]*/ 'none';
  const savedEffect = localStorage.getItem('backgroundEffect') || defaultEffect;
  
  // 初始化背景特效
  if (window.BackgroundEffects) {
    const backgroundEffects = new BackgroundEffects();
    backgroundEffects.init(savedEffect);
  }
})();
</script>
```

### 问题 8: 后台配置项验证

```yaml
# 检查 settings.yaml 中的配置项名称
home:
  posts_per_page: 8  # 确认名称正确
  posts_grid_columns: auto
  posts_layout: grid
  show_post_excerpt: false
```

```html
<!-- 检查模板中使用的配置名称 -->
th:if="${iter.index < (theme.config.home?.posts_per_page ?: 8)}"
th:with="columns=${theme.config.home?.posts_grid_columns ?: 'auto'}"
```

---

## 🧪 测试方法

### 短代码测试位置

1. **在文章内容中使用**：
   - 创建新文章或编辑现有文章
   - 在内容编辑器中插入短代码
   - 示例：
     ```html
     [alert type="success"]欢迎使用 Nucma！[/alert]
     
     [collapse title="点击展开"]折叠内容[/collapse]
     
     [tabs][tab title="标签1"]内容1[/tab][/tabs]
     ```

2. **测试步骤**：
   - 发布文章
   - 访问文章页面
   - 检查短代码是否正确渲染

### 移动端优化测试

1. **使用 Chrome 开发者工具**：
   - 按 `F12` 打开开发者工具
   - 按 `Ctrl+Shift+M` (Windows) 或 `Cmd+Shift+M` (Mac) 切换设备模式
   - 选择不同设备尺寸测试

2. **测试项目**：
   - ✅ 底部导航栏显示
   - ✅ 头部滚动隐藏
   - ✅ 双击图片放大
   - ✅ 滑动关闭模态框
   - ✅ 触摸手势响应

3. **真实设备测试**：
   - 使用手机访问网站
   - 测试 Safari、Chrome、Edge 等不同浏览器

---

## 📊 配置传递检查清单

### 后端配置传递到前端

**检查点 1：settings.yaml**
```yaml
# 确认配置项存在且名称正确
- group: appearance
  formSchema:
    - $formkit: select
      name: accent_color  # ✅ 名称正确
      value: indigo
    
    - $formkit: select
      name: background_effect  # ✅ 名称正确
      value: none

- group: home
  formSchema:
    - $formkit: select
      name: posts_per_page  # ✅ 名称正确
      value: 8
    
    - $formkit: select
      name: posts_grid_columns  # ✅ 名称正确
      value: auto
```

**检查点 2：模板中的使用**
```html
<!-- 确认 Thymeleaf 语法正确 -->
${theme.config.appearance?.accent_color}
${theme.config.appearance?.background_effect}
${theme.config.home?.posts_per_page}
${theme.config.home?.posts_grid_columns}
```

**检查点 3：前端初始化**
```javascript
// 确保在页面加载时读取配置
<script th:inline="javascript">
const defaultColor = /*[[${theme.config.appearance?.accent_color}]]*/ 'indigo';
const defaultEffect = /*[[${theme.config.appearance?.background_effect}]]*/ 'none';
const postsPerPage = /*[[${theme.config.home?.posts_per_page}]]*/ 8;

// 应用配置
localStorage.setItem('accent-color', defaultColor);
localStorage.setItem('backgroundEffect', defaultEffect);
</script>
```

---

## 🚀 部署步骤

1. **应用所有修复**
2. **构建主题**
   ```bash
   pnpm build
   ```

3. **上传并安装**
   ```
   dist/theme-nucma-1.5.3.zip
   ```

4. **清除缓存**
   - Halo 后台 → 系统设置 → 清除缓存
   - 浏览器：`Ctrl+Shift+R`

5. **测试验证**
   - 按照"配置传递检查清单"逐项验证

---

## 💡 调试技巧

### 1. 检查后台配置是否传递

在浏览器控制台执行：
```javascript
console.log('配置对象:', window.themeConfig);
console.log('主题色:', localStorage.getItem('accent-color'));
console.log('背景特效:', localStorage.getItem('backgroundEffect'));
```

### 2. 检查主题色是否应用

在浏览器控制台执行：
```javascript
const accentColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--color-accent');
console.log('当前主题色:', accentColor);
```

### 3. 检查背景特效是否初始化

在浏览器控制台执行：
```javascript
const canvas = document.getElementById('background-canvas');
console.log('背景画布:', canvas);
console.log('背景特效实例:', window.backgroundEffects);
```

### 4. 检查短代码是否解析

查看页面源代码，确认短代码已被替换为实际 HTML。

---

## 📞 问题排查流程

### 主题色不生效

1. 检查 `settings.yaml` 中配置项名称
2. 检查模板中 `${theme.config.appearance?.accent_color}`
3. 在控制台检查 `localStorage.getItem('accent-color')`
4. 检查 CSS 变量 `--color-accent` 是否设置

### 背景特效不生效

1. 检查 `settings.yaml` 中配置项名称
2. 检查模板中 `${theme.config.appearance?.background_effect}`
3. 在控制台检查 `localStorage.getItem('backgroundEffect')`
4. 检查是否有 `#background-canvas` 元素

### 首页文章数不生效

1. 检查 `settings.yaml` 中 `posts_per_page` 配置
2. 检查模板中 `theme.config.home?.posts_per_page` 语法
3. 清除 Halo 缓存
4. 在控制台检查实际渲染的文章数量

---

## ✅ 下一步行动

1. 修复 Hero 背景覆盖问题
2. 修复模态框 backdrop-filter 问题
3. 添加主题色和背景特效的配置初始化
4. 验证后台配置项传递
5. 创建测试页面
6. 更新版本号到 v1.5.3
7. 构建并部署
