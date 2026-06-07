# Nucma 主题 - 动画效果快速开始

## 🚀 5 分钟快速上手

### 1. 滚动动画 (最常用)

添加 `.reveal-up` 类让元素向上淡入:

```html
<!-- 简单淡入 -->
<div class="reveal-up">
  内容会在滚动到时向上淡入
</div>
```

让多个元素依次出现:

```html
<div class="reveal-up" data-aos-delay="100">第 1 个</div>
<div class="reveal-up" data-aos-delay="200">第 2 个</div>
<div class="reveal-up" data-aos-delay="300">第 3 个</div>
```

### 2. 打字机效果

添加 `data-typewriter` 属性:

```html
<h1 data-typewriter="Hello, World!"></h1>
```

配置速度和延迟:

```html
<h1
  data-typewriter="欢迎来到我的博客"
  data-typewriter-speed="80"
  data-typewriter-delay="500"
></h1>
```

### 3. 页面切换动画

在链接上添加 `data-transition`:

```html
<a href="/about" data-transition="slide">关于我们</a>
```

支持的动画类型:
- `fade` - 淡入淡出 (默认)
- `slide` - 滑动切换
- `zoom` - 缩放切换
- `flip` - 3D 翻转
- `reveal` - 圆形揭示

---

## 📚 所有动画类

### 滚动动画

| 类名 | 效果 |
|------|------|
| `.reveal-up` | 向上淡入 |
| `.reveal-down` | 向下淡入 |
| `.reveal-left` | 从左淡入 |
| `.reveal-right` | 从右淡入 |
| `.reveal-scale` | 缩放淡入 |
| `.reveal-flip` | 翻转淡入 |
| `.reveal-rotate` | 旋转淡入 |

### 特殊动画

| 类名 | 用途 |
|------|------|
| `.stagger-group` | 交错组容器 |
| `.stagger-item` | 交错组项(自动延迟) |
| `.timeline-item` | 时间线项(左右交替) |
| `.feature-card` | 特性卡片 |

---

## 🎨 实用示例

### 博客文章页
```html
<article>
  <h1 class="reveal-up">文章标题</h1>
  <p class="reveal-up" data-aos-delay="200">文章摘要</p>
  <div class="reveal-up" data-aos-delay="400">
    文章内容...
  </div>
</article>
```

### 首页 Hero 区域
```html
<div class="hero">
  <h1
    class="reveal-up"
    data-typewriter="欢迎来到我的博客"
    data-typewriter-speed="100"
  ></h1>
  <p class="reveal-up" data-aos-delay="500">副标题或标语</p>
  <a href="/posts" class="btn reveal-scale" data-aos-delay="700">
    浏览文章
  </a>
</div>
```

### 卡片网格
```html
<div class="grid grid-cols-3">
  <div class="card reveal-up" data-aos-delay="100">
    <h3>卡片 1</h3>
    <p>内容...</p>
  </div>
  <div class="card reveal-up" data-aos-delay="200">
    <h3>卡片 2</h3>
    <p>内容...</p>
  </div>
  <div class="card reveal-up" data-aos-delay="300">
    <h3>卡片 3</h3>
    <p>内容...</p>
  </div>
</div>
```

### 时间线
```html
<div class="timeline">
  <div class="timeline-item">
    <div class="date">2020</div>
    <div class="content">开始项目</div>
  </div>
  <div class="timeline-item">
    <div class="date">2021</div>
    <div class="content">首次发布</div>
  </div>
  <div class="timeline-item">
    <div class="date">2022</div>
    <div class="content">重大更新</div>
  </div>
</div>
```

---

## ⚙️ 自定义配置

### 延迟时间
```html
<!-- 300ms 后出现 -->
<div class="reveal-up" data-aos-delay="300">
  延迟 300 毫秒
</div>
```

### 动画时长
```html
<!-- 1 秒动画 -->
<div class="reveal-up" data-aos-duration="1000">
  慢速动画
</div>
```

### 打字机循环
```html
<!-- 循环播放 -->
<h1 data-typewriter="Hello" data-typewriter-loop="true"></h1>
```

---

## 💡 最佳实践

### ✅ 推荐
- 使用 `.reveal-up` 作为默认动画
- 适当的延迟让元素依次出现
- Hero 区域使用打字机效果
- 卡片网格使用不同的延迟

### ❌ 避免
- 过度使用翻转、旋转等复杂动画
- 延迟时间过长(超过 1 秒)
- 同时触发过多动画
- 在长列表中对每个项都使用动画

---

## 📱 响应式考虑

- 移动端自动禁用平滑滚动
- 偏好减弱动画的用户自动降级
- 动画不影响内容的可访问性

---

## 🔍 调试技巧

### 查看动画状态
打开浏览器开发者工具,检查元素是否有 `.visible` 类。

### 强制显示动画
```css
/* 在开发者工具中临时添加 */
.reveal-up {
  opacity: 1 !important;
  transform: translateY(0) !important;
}
```

---

## 📖 更多资源

- [完整动画指南](./ANIMATION-GUIDE.md)
- [更新日志](./CHANGELOG-1.6.8.md)
- [主题文档](./README.md)

---

## ❓ 常见问题

**Q: 动画不工作?**

A: 检查:
1. 是否正确添加了类名
2. 是否有 JavaScript 错误(打开控制台)
3. 是否设置了 `prefers-reduced-motion: reduce`

**Q: 如何禁用所有动画?**

A: 在后台配置中关闭 `appearance.enable_animations`

**Q: 打字机效果不显示?**

A: 确保:
1. 使用了 `data-typewriter` 属性
2. 设置了要显示的文本
3. JavaScript 文件正确加载

---

**版本**: v1.6.8
**更新**: 2026-03-22
