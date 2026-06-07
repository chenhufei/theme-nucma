# theme-nucma v1.6.8 更新日志

## 🎉 重大更新：完整动画系统

基于 Serenity-Grace 主题的优秀特性,打造现代化的交互体验。

---

## ✨ 新增功能

### 1. 滚动动画系统 (Scroll Animations) 🎬
仿 AOS 效果,但更轻量、更可定制。

#### 动画类型
- **向上淡入** (`.reveal-up`) - 最常用,内容从底部向上滑入
- **向下淡入** (`.reveal-down`) - 内容从顶部向下滑入
- **从左淡入** (`.reveal-left`) - 内容从左侧滑入
- **从右淡入** (`.reveal-right`) - 内容从右侧滑入
- **缩放淡入** (`.reveal-scale`) - 内容从小到大缩放
- **翻转淡入** (`.reveal-flip`) - 3D 翻转效果
- **旋转淡入** (`.reveal-rotate`) - 旋转淡入效果

#### 高级特性
- **交错组** - 组内元素依次出现
- **自定义延迟** - `data-aos-delay` 属性
- **自定义持续时间** - `data-aos-duration` 属性
- **时间线动画** - 时间节点左右交替
- **特性卡片** - 卡片网格依次显示
- **只触发一次** - 性能优化,避免重复动画
- **偏好减弱动画** - 自动适配无障碍设置

#### 使用示例
```html
<!-- 基础向上淡入 -->
<div class="reveal-up">内容</div>

<!-- 带延迟 -->
<div class="reveal-up" data-aos-delay="300">延迟 300ms</div>

<!-- 交错组 -->
<div class="stagger-group">
  <div class="stagger-item">第 1 项</div>
  <div class="stagger-item">第 2 项</div>
  <div class="stagger-item">第 3 项</div>
</div>

<!-- 时间线 -->
<div class="timeline-item">2020</div>
<div class="timeline-item">2021</div>
```

---

### 2. 页面切换动画 (Page Transition) 🔄
使用 View Transition API 实现流畅的页面过渡。

#### 支持的动画类型
- **fade** - 淡入淡出 (默认)
- **slide** - 滑动切换
- **zoom** - 缩放切换
- **flip** - 3D 翻转
- **reveal** - 圆形揭示

#### 使用方法
```html
<!-- 淡入淡出 -->
<a href="/page" data-transition="fade">链接</a>

<!-- 滑动切换 -->
<a href="/page" data-transition="slide">链接</a>

<!-- 缩放切换 -->
<a href="/page" data-transition="zoom">链接</a>
```

#### 智能特性
- ✅ 自动拦截内部链接
- ✅ 外链不会被拦截
- ✅ Ctrl/Cmd 点击打开新标签
- ✅ 浏览器前进后退支持
- ✅ 旧浏览器自动降级
- ✅ 预加载优化

---

### 3. 打字机效果 (Typewriter) ⌨️
实现文本逐字显示的动画效果,适合标题、标语等场景。

#### 基础用法
```html
<h1 data-typewriter="Hello, World!"></h1>
```

#### 配置选项
- `data-typewriter` - 要显示的文本
- `data-typewriter-speed` - 打字速度(毫秒/字符)
- `data-typewriter-delay` - 开始延迟(毫秒)
- `data-typewriter-loop="true"` - 循环播放

#### 完整示例
```html
<h1
  data-typewriter="欢迎来到我的博客"
  data-typewriter-speed="80"
  data-typewriter-delay="500"
  data-typewriter-loop="true"
></h1>
```

#### JavaScript API
```javascript
const typewriter = new Typewriter('.my-element', {
  text: 'Hello!',
  speed: 100,
  loop: true
});

typewriter.pause();
typewriter.resume();
typewriter.reset();
```

---

## 🐛 修复

- ✅ 修复 Lenis 文件 404 错误
- ✅ 添加 `lenis-scroll.js` 到构建脚本
- ✅ 确保所有新 JS 文件正确复制到构建目录

---

## 📝 文件变更

### 新增文件
- `src/scroll-animations.js` - 滚动动画系统 (324 行)
- `src/page-transition.js` - 页面切换动画 (320 行)
- `src/typewriter.js` - 打字机效果 (240 行)
- `ANIMATION-GUIDE.md` - 动画效果使用指南

### 修改文件
- `theme.yaml` - 版本号更新至 1.6.8
- `scripts/build.js` - 添加新 JS 文件到构建列表
- `src/components.css` - 扩展动画样式
- `templates/modules/common/scripts.html` - 集成新动画系统

---

## 🎨 CSS 增强

### 新增动画类
```css
.reveal-up          /* 向上淡入 */
.reveal-down        /* 向下淡入 */
.reveal-left        /* 从左淡入 */
.reveal-right       /* 从右淡入 */
.reveal-scale       /* 缩放淡入 */
.reveal-flip        /* 翻转淡入 */
.reveal-rotate      /* 旋转淡入 */

.stagger-group      /* 交错组容器 */
.stagger-item       /* 交错项 */
.timeline-item      /* 时间线项 */
.feature-card       /* 特性卡片 */

.typewriter-cursor  /* 打字机光标 */
```

### 动画属性
- `data-aos-delay` - 自定义延迟
- `data-aos-duration` - 自定义持续时间
- `data-typewriter` - 打字机文本
- `data-typewriter-speed` - 打字速度
- `data-typewriter-delay` - 开始延迟
- `data-typewriter-loop` - 循环播放
- `data-transition` - 页面切换类型

---

## ⚡ 性能优化

- 使用 `IntersectionObserver` 实现滚动动画,性能优秀
- 支持只触发一次,避免重复计算
- 自动检测偏好减弱动画,降级处理
- 使用 `will-change` 优化动画性能
- 移动端自动禁用平滑滚动
- 动画使用 GPU 加速

---

## 🔧 兼容性

### 浏览器支持
- ✅ Chrome 111+ (View Transition API)
- ✅ Firefox 113+ (View Transition API)
- ✅ Safari 16.4+ (View Transition API)
- ✅ 旧浏览器自动降级

### 无障碍
- ✅ 支持 `prefers-reduced-motion`
- ✅ 自动为无障碍用户禁用动画
- ✅ 不影响屏幕阅读器

---

## 📚 使用示例

### Hero 区域
```html
<div class="hero">
  <h1 class="reveal-up" data-typewriter="Hello, World!"></h1>
  <p class="reveal-up" data-aos-delay="300">副标题</p>
  <div class="reveal-scale" data-aos-delay="500">卡片</div>
</div>
```

### 博客列表
```html
<div class="post-grid">
  <article class="card reveal-up" data-aos-delay="100">文章 1</article>
  <article class="card reveal-up" data-aos-delay="200">文章 2</article>
  <article class="card reveal-up" data-aos-delay="300">文章 3</article>
</div>
```

### 时间线
```html
<div class="timeline">
  <div class="timeline-item">2020 - 开始</div>
  <div class="timeline-item">2021 - 成长</div>
  <div class="timeline-item">2022 - 突破</div>
</div>
```

---

## 🎯 最佳实践

### 动画使用建议
1. **不要过度使用** - 合理的动画增强体验,过度的动画影响性能
2. **保持简短** - 动画时长建议 300-600ms
3. **使用缓动** - `cubic-bezier(0.4, 0, 0.2, 1)` 效果自然
4. **优先上滑** - 向上滑动的动画符合用户习惯
5. **尊重用户** - 尊重 `prefers-reduced-motion` 设置

### 性能建议
1. 使用 `once: true` 避免重复动画
2. 合理使用 `will-change` 提升性能
3. 避免过多同时触发的动画
4. 移动端适当减少动画

---

## 🔄 从 v1.6.7 升级

无需特殊操作,直接替换主题文件即可。所有新功能自动启用。

---

## 📖 相关文档

- [动画效果使用指南](./ANIMATION-GUIDE.md)
- [v1.6.7 更新日志](./CHANGELOG-1.6.7.md)

---

## 🙏 致谢

动画系统灵感来自:
- [Serenity-Grace](https://github.com/atangccc/Serenity-Grace) - 优雅的 Halo 主题
- [AOS](https://github.com/michalsnik/aos) - Animate On Scroll
- [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)

---

**更新日期**: 2026-03-22
**版本**: 1.6.8
**构建**: ✅ 成功
**文件大小**: 0.15 MB
