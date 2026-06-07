# 版本历史

## v1.7.0 (2026-03-22)

### 🐛 修复
- 修复 `settings.yaml` API 版本格式不正确导致安装失败
- 将 `apiVersion: v1alpha1` 修正为 `apiVersion: ui.halo.run/v1alpha1`
- 修复升级时出现的服务器内部错误

### 📝 文件变更
- `settings.yaml` - API 版本修正
- `settings-i18n-example.yaml` - API 版本修正
- `theme.yaml` - 版本号更新

---

## v1.6.9 (2026-03-22)

### ✨ 新增
- 完善 `theme.yaml` 配置：
  - 添加 `issues` 字段（GitHub Issues 链接）
  - 添加 `annotations.store.halo.run/app-id`
  - 添加 `license` 字段（MIT 许可证）
  - 优化 `description` 描述

### 📝 文档
- 创建完整的 `README.md`（200+ 行）
- 添加国际化语言包：
  - `i18n/zh_CN.yaml` - 中文语言包
  - `i18n/en.yaml` - 英文语言包
- 创建 `LICENSE` 文件（MIT 许可证）
- 添加 `settings-i18n-example.yaml` 示例

---

## v1.6.8 (2026-03-22)

### ✨ 新增功能
- **滚动动画系统** - 7 种动画类型
  - 向上淡入 / 向下淡入
  - 从左淡入 / 从右淡入
  - 缩放淡入 / 翻转淡入 / 旋转淡入
  - 交错组自动计算延迟

- **页面切换动画** - 5 种过渡效果
  - fade（淡入淡出）
  - slide（滑动）
  - zoom（缩放）
  - flip（翻转）
  - reveal（揭示）

- **打字机效果**
  - 逐字显示
  - 自定义速度 / 延迟 / 循环
  - 支持多个实例

### 📁 新增文件
- `src/scroll-animations.js` - 滚动动画系统
- `src/page-transition.js` - 页面切换动画
- `src/typewriter.js` - 打字机效果
- `ANIMATION-GUIDE.md` - 完整动画指南
- `QUICKSTART-ANIMATIONS.md` - 快速开始指南

### 🔧 修改
- `src/components.css` - 扩展动画样式
- `templates/modules/common/scripts.html` - 集成新模块
- `scripts/build.js` - 添加新 JS 文件

---

## v1.6.7 (2026-03-22)

### ✨ 新增功能
- **Lenis 平滑滚动**
  - 全局惯性缓动滚动
  - 自动检测移动端/低端设备
  - 表单输入时智能暂停

- **主题色相动态调节**
  - 360° 色相滑块自由调节
  - HSL 转 RGB 自动计算
  - 保留 12 种预设配色

- **圆形扩散主题切换**
  - 从点击位置扩散
  - 结合 View Transition API
  - 流畅的过渡效果

### 📁 新增文件
- `src/lenis-scroll.js` - 平滑滚动模块
- `CHANGELOG-1.6.7.md` - v1.6.7 更新日志

### 🔧 修改
- `src/base.css` - Lenis 支持
- `src/components.css` - 主题切换器样式
- `templates/components/theme-switcher.html` - 色相滑块
- `templates/modules/common/scripts.html` - 集成 Lenis

---

## v1.6.4 - v1.6.6

### 优化与修复
- 性能优化
- 样式调整
- Bug 修复

---

## v1.5.x 系列

### 功能完善
- 成员插件集成
- 用户评价区块
- FAQ 区块
- 静态成员配置
- 时间线动画

---

## v1.4.0

### 新增
- 背景特效系统
  - 网格 / 渐变 / 粒子 / 流光
- 深色模式优化
- 搜索功能

---

## v1.3.0

### 新增
- 文章归档页面
- 时间线布局
- 标签云
- 分类页面

---

## v1.2.0 - v1.2.2

### 优化
- 响应式布局优化
- 移动端适配
- 性能提升

---

## v1.1.0 - v1.1.9

### 持续迭代
- 组件优化
- 样式调整
- Bug 修复
- 用户体验改进

---

## v1.0.0 - v1.0.9

### 初始版本
- 基础博客功能
- 深色/浅色模式
- 云母玻璃设计
- Hero 区块
- 文章列表
- 评论系统
- 关于页面
