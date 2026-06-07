# Nucma 主题 v1.5.2 更新日志

## 📝 更新日期
2025-03-21

---

## 🔧 修复内容

### 首页文章数配置优化

**问题**：首页文章数的后台设置和前端数量配比不合理

**修复内容**：

1. **增加文章数选项**（4篇 → 20篇）
   - 之前：3/6/9/12 篇
   - 现在：4/6/8/10/12/16/20 篇
   - 默认值：6 → 8 篇

2. **新增网格列数配置**
   - 自动适配（推荐）：响应式 1→2→3→4 列
   - 固定 2 列
   - 固定 3 列
   - 固定 4 列

3. **新增布局方式配置**
   - 网格布局（推荐）
   - 卡片布局（带摘要）

4. **摘要显示调整**
   - 默认值：true → false（更简洁）

---

## 📦 配置项变更

### settings.yaml

#### 首页 → 首页显示文章数

**修改前**：
```yaml
- $formkit: select
  name: posts_per_page
  label: 首页显示文章数
  value: 6
  options:
    - label: 3 篇
      value: 3
    - label: 6 篇（默认）
      value: 6
    - label: 9 篇
      value: 9
    - label: 12 篇
      value: 12
```

**修改后**：
```yaml
- $formkit: select
  name: posts_per_page
  label: 首页显示文章数
  value: 8
  options:
    - label: 4 篇
      value: 4
    - label: 6 篇
      value: 6
    - label: 8 篇（推荐）
      value: 8
    - label: 10 篇
      value: 10
    - label: 12 篇
      value: 12
    - label: 16 篇
      value: 16
    - label: 20 篇
      value: 20
```

**新增配置项**：
```yaml
- $formkit: select
  name: posts_layout
  label: 文章布局方式
  value: grid
  options:
    - label: 网格布局（4列，推荐）
      value: grid
    - label: 卡片布局（带摘要）
      value: card

- $formkit: select
  name: posts_grid_columns
  label: 网格列数
  value: auto
  options:
    - label: 自动适配（推荐）
      value: auto
    - label: 2 列
      value: 2
    - label: 3 列
      value: 3
    - label: 4 列
      value: 4

- $formkit: checkbox
  name: show_post_excerpt
  label: 显示文章摘要
  value: false
```

### templates/modules/index/content.html

**修改前**：
```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  <a th:each="post,iter : ${posts.items}"
     th:if="${iter.index < (theme.config.home?.posts_per_page ?: 6)}">
```

**修改后**：
```html
<div th:with="columns=${theme.config.home?.posts_grid_columns ?: 'auto'},
            gridClass=${columns == '2' ? 'grid-cols-1 sm:grid-cols-2' :
                       columns == '3' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                       columns == '4' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' :
                       'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}"
     th:classappend="${gridClass} + ' gap-x-5 gap-y-6'}"
     class="grid">
  <a th:each="post,iter : ${posts.items}"
     th:if="${iter.index < (theme.config.home?.posts_per_page ?: 8)}">
```

---

## 📊 构建信息

- **版本号**: v1.5.2
- **构建文件**: `dist/theme-nucma-1.5.2.zip` (0.14 MB)
- **主样式**: `templates/assets/css/main.css` (66.85 kB, gzip: 12.24 kB)
- **构建时间**: 2.19s

---

## 🎯 使用建议

### 推荐配置组合

1. **内容丰富的博客**
   - 文章数：12-16 篇
   - 网格列数：自动适配
   - 摘要：关闭

2. **极简风格博客**
   - 文章数：4-6 篇
   - 网格列数：3 列固定
   - 摘要：关闭

3. **图片为主博客**
   - 文章数：16-20 篇
   - 网格列数：4 列固定
   - 摘要：关闭

---

## 🚀 部署步骤

1. **上传主题**
   ```
   dist/theme-nucma-1.5.2.zip
   ```

2. **配置首页设置**
   - 进入后台 → 主题设置 → 首页
   - 设置文章数量（推荐 8 篇）
   - 选择网格列数（推荐自动适配）

3. **清除缓存**
   - Halo 后台 → 系统设置 → 清除缓存
   - 浏览器：Ctrl/Cmd + Shift + R

---

## 📈 版本对比

| 配置项 | v1.5.1 | v1.5.2 |
|--------|--------|--------|
| 文章数选项 | 4个 (3/6/9/12) | 7个 (4/6/8/10/12/16/20) |
| 默认文章数 | 6篇 | 8篇 |
| 网格列数配置 | ❌ 固定4列 | ✅ 4种选项 |
| 布局方式 | ❌ 无 | ✅ 2种选项 |
| 默认摘要显示 | ✅ 开启 | ❌ 关闭 |

---

## ✅ 总结

v1.5.2 版本主要解决了首页文章数配置不合理的问题：

1. ✅ 提供更多文章数选项（4-20篇）
2. ✅ 新增网格列数控制（2/3/4/自动）
3. ✅ 新增布局方式选择
4. ✅ 优化默认值（8篇文章，关闭摘要）

用户可以根据自己的内容量和设计风格灵活配置首页显示方式！
