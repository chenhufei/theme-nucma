# Z-Index 层级规范

本文档定义了主题中所有元素的 z-index 层级规范，确保元素正确堆叠显示。

## 层级体系

### 层级 0-9: 背景和装饰
```css
--z-background: 0
```
- 背景装饰元素（色块、渐变）
- Hero 区域的流动色块
- body::before 和 body::after 装饰元素

**使用场景：**
- `.hero-bg-blob` - Hero 背景色块
- `body::before`, `body::after` - 全局背景装饰

---

### 层级 10-49: 内容层
```css
--z-content: 10
--z-hero-elements: 20
```

#### --z-content (10)
普通页面内容，包括文章、卡片、区块等。

**使用场景：**
- `main` - 主内容区
- `section` - 各个内容区块
- `.hero-bg-overlay` - Hero 遮罩层
- `body > *` - 所有直接子元素默认层级

#### --z-hero-elements (20)
Hero 区域的前景元素，需要显示在背景之上。

**使用场景：**
- `.hero-content-area` - Hero 文字内容区
- `.hero-card-wrapper` - Hero 预览卡片

---

### 层级 50-99: 浮动元素
```css
--z-toc: 50
--z-scroll-hint: 60
```

#### --z-toc (50)
文章页面的目录导航，固定在侧边。

**使用场景：**
- `#tocPanel` - 文章目录面板

#### --z-scroll-hint (60)
滚动提示按钮，需要显示在内容之上但不遮挡导航。

**使用场景：**
- `#heroScrollHint` - 首页滚动提示

---

### 层级 100-199: 导航和固定元素
```css
--z-header: 100
```

#### --z-header (100)
顶部导航栏，固定在页面顶部，需要覆盖所有内容。

**使用场景：**
- `#mainHeader` - 主导航栏
- `nav` - 导航组件

---

### 层级 200-999: 覆盖层
```css
--z-dropdown: 200
--z-page-transition: 300
```

#### --z-dropdown (200)
下拉菜单和弹出层，需要覆盖导航栏。

**使用场景：**
- 用户菜单下拉
- 搜索建议框
- 工具提示

#### --z-page-transition (300)
页面切换过渡动画，需要覆盖整个页面。

**使用场景：**
- `#pto` - 页面过渡动画容器
- View Transition API

---

### 层级 1000-9999: 移动端和模态框
```css
--z-mobile-overlay: 998
--z-mobile-sidebar: 999
--z-modal: 9999
```

#### --z-mobile-overlay (998)
移动端菜单的遮罩层。

**使用场景：**
- 移动端菜单打开时的半透明遮罩

#### --z-mobile-sidebar (999)
移动端侧边栏菜单。

**使用场景：**
- 移动端导航菜单
- 移动端侧边栏

#### --z-modal (9999)
模态框和对话框，需要覆盖所有其他元素。

**使用场景：**
- `#member-submit-modal` - 成员申请表单
- `#link-submit-modal` - 友链申请表单
- 图片预览灯箱
- 确认对话框

---

### 层级 10000+: 最高优先级
```css
--z-toast: 10000
```

#### --z-toast (10000)
Toast 提示消息，需要显示在所有元素之上。

**使用场景：**
- 成功/错误提示
- 通知消息
- 加载提示

---

## 使用规范

### 1. 使用 CSS 变量
始终使用 CSS 变量而不是硬编码数值：

✅ **正确：**
```html
<div style="z-index: var(--z-modal);">
```

❌ **错误：**
```html
<div style="z-index: 9999;">
```

### 2. 不要随意添加新层级
如果需要新的层级，应该：
1. 评估是否可以使用现有层级
2. 如果必须添加，更新本文档和 `base.css`
3. 确保新层级符合整体层级体系

### 3. 层级冲突处理
如果遇到层级冲突：
1. 检查元素应该属于哪个层级分类
2. 使用对应的 CSS 变量
3. 如果确实需要微调，使用 `calc()` 函数：
   ```css
   z-index: calc(var(--z-content) + 1);
   ```

### 4. 调试技巧
使用浏览器开发工具查看层级：
1. 打开 DevTools
2. 选择 Elements 标签
3. 查看 Computed 样式中的 z-index 值
4. 使用 3D View 查看层级关系（Chrome/Edge）

---

## 常见问题

### Q: 为什么滚动提示不显示？
A: 检查 z-index 是否正确设置为 `var(--z-scroll-hint)`，确保高于内容层。

### Q: 模态框被其他元素遮挡？
A: 确保模态框使用 `var(--z-modal)`，这是最高的非 Toast 层级。

### Q: 移动端菜单显示异常？
A: 检查遮罩层和侧边栏的层级，确保遮罩层 (998) 低于侧边栏 (999)。

### Q: 页面过渡动画不流畅？
A: 确保过渡容器使用 `var(--z-page-transition)`，并且没有其他元素使用更高层级。

---

## 更新记录

### v1.0.0 (2025-01-XX)
- 初始版本
- 定义完整的层级体系
- 规范化所有元素的 z-index 使用
- 将硬编码数值替换为 CSS 变量

---

## 参考资料

- [MDN: z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index)
- [CSS Tricks: z-index](https://css-tricks.com/almanac/properties/z/z-index/)
- [Stacking Context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context)
