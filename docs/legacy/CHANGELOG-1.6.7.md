# theme-nucma v1.6.7 更新日志

## 从 Serenity-Grace 借鉴的新功能

### 1. Lenis 平滑滚动 ✨
- **新增**: `src/lenis-scroll.js` - 平滑滚动模块
- **特性**:
  - 全局惯性缓动滚动,提升阅读体验
  - 自动检测移动端和偏好减弱动画,自动降级
  - 动态加载 Lenis 库,减少初始加载体积
  - 表单输入时自动暂停,避免干扰输入
  - 页面不可见时自动暂停,节省资源

**使用方式**:
```javascript
// 平滑滚动到顶部
window.smoothScrollInstance?.scrollTo(0);

// 滚动到指定元素
window.smoothScrollInstance?.scrollTo('#section-id');
```

**配置**:
- 默认启用,可在后台 `appearance.enable_smooth_scroll` 关闭
- 自动检测低端设备,性能优先

---

### 2. 主题色相动态调节 🎨
- **优化**: 主题切换器增强
- **特性**:
  - 360° 色相滑块,自由调节主题色
  - HSL 到 RGB 自动转换
  - 实时预览色相变化
  - 保留预设配色(12 种)
  - 支持暗色模式独立颜色

**技术实现**:
```javascript
// 自动计算 RGB 值
function hslToRgb(h, s, l) {
  // HSL 转换为 RGB
  // 同时计算亮色和暗色模式颜色
}
```

**样式更新**:
- 色相滑块使用彩虹渐变背景
- 颜色预览条实时反映当前色相
- 预设配色网格,快速切换常用色

---

### 3. 圆形扩散主题切换动画 🎭
- **优化**: 主题切换动画增强
- **特性**:
  - 点击位置为起点的圆形扩散动画
  - 结合 View Transition API,性能优秀
  - 暗色/亮色模式切换时视觉流畅
  - 自动计算最大扩散半径

**技术实现**:
```javascript
// 点击位置动画
window.setThemeMode('dark', event);

// 使用 CSS @property 实现平滑过渡
@property --ripple-x { syntax: '<length>'; }
@property --ripple-y { syntax: '<length>'; }
@property --ripple-radius { syntax: '<length>'; }
```

**CSS 效果**:
```css
/* 圆形扩散层 */
html::after {
  content: '';
  position: fixed;
  border-radius: 50%;
  transform: translate(var(--ripple-x), var(--ripple-y));
  width: calc(var(--ripple-radius) * 2);
  height: calc(var(--ripple-radius) * 2);
}
```

---

## 文件变更

### 新增文件
- `src/lenis-scroll.js` - Lenis 平滑滚动模块

### 修改文件
- `theme.yaml` - 版本号更新至 1.6.7
- `src/base.css` - 添加 Lenis 支持 CSS
- `src/components.css` - 添加主题切换器完整样式
- `templates/components/theme-switcher.html` - 增强主题切换器
  - 添加色相滑块
  - 更新主题色映射和计算逻辑
  - 优化主题切换动画
- `templates/modules/common/scripts.html` - 集成平滑滚动

---

## 兼容性

- ✅ 现代浏览器 (Chrome 111+, Firefox 113+, Safari 16.4+)
- ✅ 支持回退到原生滚动(旧浏览器)
- ✅ 移动端自动禁用平滑滚动(性能优化)
- ✅ 偏好减弱动画时自动降级

---

## 性能优化

- Lenis 动态加载,不影响首屏渲染
- 动画使用 `requestAnimationFrame`,GPU 加速
- 不可见页面暂停动画,节省资源
- 移动端自动检测,性能优先

---

## 已知问题

- CSS linter 警告: `@property` 语法在某些编辑器中显示为未知规则(功能正常)
- 移动端浏览器可能不支持 View Transition API(自动降级到传统动画)

---

## 使用建议

1. **平滑滚动**: 桌面端推荐启用,移动端建议关闭(已在代码中自动处理)
2. **色相调节**: 配合预设配色使用效果最佳
3. **主题切换**: 建议在桌面端体验圆形扩散动画

---

## 下一步计划

- [ ] AOS 滚动触发动画集成
- [ ] 页面切换动画优化
- [ ] 更多预设配色方案
- [ ] 背景特效性能优化

---

**更新日期**: 2026-03-22
**版本**: 1.6.7
**参考项目**: [Serenity-Grace](https://github.com/atangccc/Serenity-Grace)
