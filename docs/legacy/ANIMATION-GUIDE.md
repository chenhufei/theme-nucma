# Nucma 主题 - 动画效果使用指南

## 📚 目录
- [滚动动画](#滚动动画)
- [页面切换动画](#页面切换动画)
- [打字机效果](#打字机效果)
- [主题切换动画](#主题切换动画)
- [平滑滚动](#平滑滚动)
- [动画配置](#动画配置)

---

## 🎬 滚动动画

### 基础用法

滚动动画会在元素进入视口时自动触发动画效果。

#### 向上淡入 (最常用)
```html
<div class="reveal-up">
  内容会向上淡入
</div>
```

#### 向下淡入
```html
<div class="reveal-down">
  内容会向下淡入
</div>
```

#### 从左淡入
```html
<div class="reveal-left">
  内容会从左侧淡入
</div>
```

#### 从右淡入
```html
<div class="reveal-right">
  内容会从右侧淡入
</div>
```

#### 缩放淡入
```html
<div class="reveal-scale">
  内容会从小到大缩放淡入
</div>
```

#### 翻转淡入
```html
<div class="reveal-flip">
  内容会以 3D 翻转方式淡入
</div>
```

#### 旋转淡入
```html
<div class="reveal-rotate">
  内容会旋转淡入
</div>
```

### 延迟动画

使用内置的延迟类让元素依次出现:
```html
<div class="reveal reveal-d1">第 1 个元素</div>
<div class="reveal reveal-d2">第 2 个元素</div>
<div class="reveal reveal-d3">第 3 个元素</div>
<div class="reveal reveal-d4">第 4 个元素</div>
<div class="reveal reveal-d5">第 5 个元素</div>
<div class="reveal reveal-d6">第 6 个元素</div>
```

### 自定义延迟

使用 `data-aos-delay` 属性自定义延迟时间(毫秒):
```html
<div class="reveal-up" data-aos-delay="300">
  延迟 300ms 后出现
</div>
```

### 自定义持续时间

使用 `data-aos-duration` 属性自定义动画持续时间(毫秒):
```html
<div class="reveal-up" data-aos-duration="1000">
  1 秒的动画时间
</div>
```

### 交错组

让组内元素依次出现(自动计算延迟):
```html
<div class="stagger-group">
  <div class="stagger-item">第 1 项</div>
  <div class="stagger-item">第 2 项</div>
  <div class="stagger-item">第 3 项</div>
  <div class="stagger-item">第 4 项</div>
</div>
```

### 时间线动画
```html
<div class="timeline-item">时间节点 1</div>
<div class="timeline-item">时间节点 2</div>
<div class="timeline-item">时间节点 3</div>
```

### 特性卡片动画
```html
<div class="feature-card">特性 1</div>
<div class="feature-card">特性 2</div>
<div class="feature-card">特性 3</div>
```

---

## 🔄 页面切换动画

### 使用方法

页面切换动画会自动拦截内部链接并应用过渡效果。

#### 指定动画类型

在链接上添加 `data-transition` 属性:
```html
<!-- 淡入淡出 (默认) -->
<a href="/page" data-transition="fade">链接</a>

<!-- 滑动切换 -->
<a href="/page" data-transition="slide">链接</a>

<!-- 缩放切换 -->
<a href="/page" data-transition="zoom">链接</a>

<!-- 翻转切换 -->
<a href="/page" data-transition="flip">链接</a>

<!-- 圆形揭示 -->
<a href="/page" data-transition="reveal">链接</a>
```

### 兼容性

- ✅ 现代浏览器使用 View Transition API
- ✅ 旧浏览器自动降级到传统动画
- ✅ 外链、锚点链接不会被拦截
- ✅ Ctrl/Cmd 点击打开新标签不会被拦截

---

## ⌨️ 打字机效果

### 基础用法

使用 `data-typewriter` 属性启用打字机效果:
```html
<h1 data-typewriter="Hello, World!"></h1>
```

### 配置选项

#### 设置打字速度(毫秒)
```html
<h1 data-typewriter="Hello" data-typewriter-speed="50"></h1>
```

#### 设置开始延迟(毫秒)
```html
<h1 data-typewriter="Hello" data-typewriter-delay="1000"></h1>
```

#### 循环播放
```html
<h1 data-typewriter="Hello" data-typewriter-loop="true"></h1>
```

### 完整示例
```html
<!-- 完整配置 -->
<h1
  data-typewriter="欢迎来到我的博客"
  data-typewriter-speed="80"
  data-typewriter-delay="500"
  data-typewriter-loop="true"
></h1>
```

### JavaScript API

```javascript
// 创建打字机实例
const typewriter = new Typewriter('.my-element', {
  text: 'Hello, World!',
  speed: 100,           // 打字速度
  delay: 0,             // 开始延迟
  pause: 1000,          // 完成后暂停
  cursor: true,         // 显示光标
  cursorChar: '|',      // 光标字符
  loop: false,         // 循环播放
  deleteSpeed: 50,     // 删除速度
  deleteDelay: 500     // 删除前延迟
});

// 暂停
typewriter.pause();

// 恢复
typewriter.resume();

// 重置
typewriter.reset();

// 销毁
typewriter.destroy();
```

---

## 🎭 主题切换动画

主题切换自动使用圆形扩散动画,点击位置为起点。

### 触发方式

通过主题切换器或编程方式触发:
```javascript
// 切换到深色模式
setThemeMode('dark', event); // event 是点击事件,用于获取起点

// 切换到浅色模式
setThemeMode('light', event);

// 跟随系统
setThemeMode('system');
```

---

## 🎠 平滑滚动

### 使用方法

平滑滚动在桌面端默认启用,移动端自动禁用。

### API

```javascript
// 滚动到顶部
window.smoothScrollInstance?.scrollTo(0);

// 滚动到指定元素
window.smoothScrollInstance?.scrollTo('#section-id');

// 滚动到指定像素
window.smoothScrollInstance?.scrollTo(500);

// 带选项的滚动
window.smoothScrollInstance?.scrollTo('#section', {
  offset: 100  // 偏移量
});
```

### 禁用平滑滚动

在后台配置中关闭 `appearance.enable_smooth_scroll`

---

## ⚙️ 动画配置

### 全局配置

在 JavaScript 中配置滚动动画:
```javascript
const scrollAnimations = new ScrollAnimations({
  rootMargin: '0px 0px -50px 0px',  // 触发边界
  threshold: 0.1,                     // 可见度阈值
  delay: 0,                           // 默认延迟
  duration: 600,                      // 默认持续时间
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',  // 缓动函数
  once: true                          // 只触发一次
});
```

### 偏好减弱动画

支持系统级无障碍设置,自动为偏好减弱动画的用户禁用所有动画:
```css
@media (prefers-reduced-motion: reduce) {
  /* 所有动画自动禁用 */
}
```

---

## 🎨 最佳实践

### 1. 性能优化

- 使用 `once: true` 让动画只触发一次
- 移动端自动禁用平滑滚动
- 使用 `will-change` 属性提升性能

### 2. 用户体验

- 不要过度使用动画
- 保持动画时长在 300-600ms 之间
- 使用缓动函数让动画更自然
- 优先使用淡入和向上滑动的动画

### 3. 可访问性

- 尊重用户的 `prefers-reduced-motion` 设置
- 提供跳过动画的选项
- 确保动画不干扰屏幕阅读器

---

## 📝 实际应用示例

### 文章页标题
```html
<h1 class="reveal-up" data-aos-delay="200">
  文章标题
</h1>
```

### 博客卡片网格
```html
<div class="grid grid-cols-3">
  <div class="card reveal-up" data-aos-delay="100">
    卡片 1
  </div>
  <div class="card reveal-up" data-aos-delay="200">
    卡片 2
  </div>
  <div class="card reveal-up" data-aos-delay="300">
    卡片 3
  </div>
</div>
```

### Hero 区域
```html
<div class="hero">
  <h1 class="reveal-up" data-typewriter="Hello, World!" data-typewriter-speed="100"></h1>
  <p class="reveal-up" data-aos-delay="300">副标题</p>
  <div class="reveal-scale" data-aos-delay="500">主要内容</div>
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

## 🔧 技术细节

### 滚动动画实现
- 基于 IntersectionObserver API
- 自动性能优化
- 支持 CSS 自定义属性
- 兼容现代浏览器

### 页面切换实现
- View Transition API (现代浏览器)
- 传统动画降级 (旧浏览器)
- 自动预加载优化

### 打字机实现
- 原生 JavaScript,无依赖
- 支持光标动画
- 支持循环播放

---

## 📄 版本

- v1.6.8 - 添加完整动画系统

---

## 🤝 参考项目

动画系统灵感来自:
- [Serenity-Grace](https://github.com/atangccc/Serenity-Grace)
- [AOS](https://github.com/michalsnik/aos)
- View Transition API
