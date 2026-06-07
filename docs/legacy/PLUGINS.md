# Nucma 主题插件适配文档

> ⚠️ 本文档属于历史插件适配说明，部分内容基于早期实验实现整理，
> 不代表当前仓库版本下所有插件/API 调用方式都是稳定可用的主方案。
>
> 当前项目中，涉及首页 Widget 的展示能力时，应优先区分：
>
> - **稳定入口**：模板渲染与现有页面/组件模板（如 `templates/components/widgets.html`）
> - **实验/后备入口**：前台通过 API 动态拉取数据再拼装 Widget（如 `src/widgets.js`）
>
> 特别注意：
>
> 1. 某些 Halo API 或插件 API 在前台访客环境下可能不可访问；
> 2. 社区版 / Pro 版 / 不同插件版本之间的 API 路径与字段可能不同；
> 3. 文档中出现的 API 示例、自动检测逻辑、动态渲染方案，不应默认视为当前稳定主路径。
>
> 如需确认当前版本的有效文档边界，请优先参考：
>
> - [README.md](../../README.md)
> - [docs/README.md](../README.md)
> - [FIX-TRACKING.md](../../FIX-TRACKING.md)

## 📦 插件适配范围说明

当前仓库中保留了若干插件容器模板与前端适配器实现，但这些内容更适合理解为：

- **已提供接入入口**
- **已做过适配尝试**
- **可作为继续兼容/调试的基础**

而不应直接理解为：

- 所有插件在当前版本下一定稳定可用
- 所有 API 在前台访客环境下一定可访问
- 所有插件在不同 Halo 版本/发行版中都已被完整验证

因此，下文中的插件说明应视为**历史适配说明与接入参考**，而不是当前版本的稳定兼容承诺。

## 📦 支持的插件

当前文档涉及的插件方向包括：

---

## 🎬 B站追番插件

### 功能特性
- 展示追番列表
- 显示评分和进度
- 响应式卡片布局
- 状态标签（已看完/在看/想看/搁置）

### 使用方法

#### 1. 安装插件
在 Halo 后台安装 `bilibili-bangumi` 插件

#### 2. 在页面中使用
```html
<!-- 方式1：直接在模板中使用 -->
<div th:replace="~{components/plugins :: bilibili-bangumi}"></div>

<!-- 方式2：在自定义页面中 -->
<div th:replace="~{components/plugins :: plugin-container(pluginName='bilibili-bangumi')}"></div>
```

#### 3. 自定义配置
在插件设置中配置 B站 Cookie 或访问令牌

### 效果预览
- 网格布局展示追番封面
- 右上角显示评分
- 底部显示集数和状态
- 悬停时卡片放大效果

---

## 🎮 Steam 游戏库插件

### 功能特性
- 展示 Steam 游戏库
- 显示游戏时长
- 卡片式布局
- 悬停预览效果

### 使用方法

#### 1. 安装插件
在 Halo 后台安装 `steam-games` 插件

#### 2. 在页面中使用
```html
<!-- 直接在模板中使用 -->
<div th:replace="~{components/plugins :: steam-games}"></div>

<!-- 在自定义页面中 -->
<div th:replace="~{components/plugins :: plugin-container(pluginName='steam-games')}"></div>
```

#### 3. 配置 Steam ID
在插件设置中输入 Steam 64位 ID

### 效果预览
- 4列网格布局
- 左下角显示游戏时长
- 封面图片悬停放大
- 简洁的卡片设计

---

## 🖼️ 图库插件

### 功能特性
- 两种布局：标准网格 / 瀑布流（Masonry）
- 图片点击放大预览
- 支持图片标题
- 自适应响应式布局

### 使用方法

#### 1. 安装插件
在 Halo 后台安装 `gallery` 插件

#### 2. 在页面中使用
```html
<!-- 标准网格布局 -->
<div th:replace="~{components/plugins :: gallery}"></div>

<!-- 瀑布流布局（需要通过数据配置） -->
<div th:replace="~{components/plugins :: gallery}" data-layout="masonry"></div>
```

#### 3. 上传图片
在插件管理中上传图片并添加标题

### 效果预览
- 响应式网格布局
- 图片悬停缩放效果
- 点击打开全屏预览
- 支持键盘 ESC 关闭

---

## 📱 瞬间插件

### 功能特性
- 展示动态瞬间
- 支持多图展示
- 用户头像和昵称
- 标签系统
- 时间戳显示

### 使用方法

#### 1. 安装插件
在 Halo 后台安装 `moments` 插件

#### 2. 在页面中使用
```html
<!-- 在模板中使用 -->
<div th:replace="~{components/plugins :: moments}"></div>

<!-- 在首页 Widget 中 -->
<!-- 通过后台配置启用 -->
```

#### 3. 发布瞬间
在前端或后台发布动态瞬间

### 效果预览
- 卡片式动态展示
- 头像 + 昵称 + 时间
- 富文本内容支持
- 多图网格展示
- 标签云

---

## 🔧 插件适配原理

### 自动检测
主题会自动检测已安装的插件：
```javascript
// 自动检测并初始化插件
const plugins = ['bilibili-bangumi', 'steam-games', 'gallery', 'moments'];

for (const plugin of plugins) {
  const container = document.querySelector(`[data-plugin="${plugin}"]`);
  if (container) {
    // 自动加载插件数据并渲染
  }
}
```

### 手动调用
如果需要手动调用插件适配器：
```javascript
// 获取插件数据
const response = await fetch('/apis/api.halo.run/v1alpha1/plugins/bilibili-bangumi');
const data = await response.json();

// 渲染到容器
const container = document.querySelector('[data-plugin="bilibili-bangumi"]');
window.pluginAdapter.render('bilibili-bangumi', data, container);
```

---

## 🎨 自定义适配器

### 创建自定义适配器

如果需要适配其他插件，可以创建自定义适配器：

```javascript
class CustomPluginAdapter {
  render(data, container) {
    // 1. 获取数据
    const items = data.items || [];

    // 2. 生成 HTML
    const html = items.map(item => `
      <div class="custom-item">
        <!-- 自定义内容 -->
      </div>
    `).join('');

    // 3. 渲染到容器
    container.innerHTML = html;

    // 4. 添加交互（可选）
    this.setupInteractions(container);
  }

  setupInteractions(container) {
    // 添加交互逻辑
  }
}

// 注册适配器
window.pluginAdapter.register('custom-plugin', new CustomPluginAdapter());
```

---

## 📝 最佳实践

### 1. 性能优化
- 使用图片懒加载 (`loading="lazy"`)
- 限制一次性显示的数量
- 使用分页或无限滚动

### 2. 用户体验
- 添加加载状态提示
- 空状态友好提示
- 错误处理和重试

### 3. 响应式设计
- 移动端单列布局
- 平板双列布局
- 桌面三/四列布局

### 4. 可访问性
- 图片添加 alt 属性
- 键盘导航支持
- ARIA 标签

---

## 🔍 常见问题

### Q: 插件数据没有显示？
A: 请确保：
1. 插件已正确安装并启用
2. 插件配置正确（如 B站 Cookie、Steam ID）
3. 网络连接正常

### Q: 如何自定义插件样式？
A: 在主题设置中添加自定义 CSS，或修改主题源码

### Q: 支持哪些其他插件？
A: 可以通过创建自定义适配器支持更多插件

### Q: 插件数据格式是什么？
A: 查看 Halo API 文档或插件官方文档

---

## 📚 相关文档

- [Halo 官方文档](https://docs.halo.run/)
- [插件开发指南](https://docs.halo.run/developer-guide/plugin)
- [主题开发指南](https://docs.halo.run/developer-guide/theme)
- [API 文档](https://api.halo.run/)

---

## 🤝 贡献

如果您适配了新的插件，欢迎提交 PR 或分享您的适配器代码！

---

**Nucma 主题** - 强大的插件适配系统
