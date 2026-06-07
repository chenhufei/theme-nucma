# 短代码使用说明

Nucma 主题支持多种短代码，帮助您在文章中快速创建格式化内容。

## 提示块

### 语法
```
[alert type="info|success|warning|error" title="标题"]内容[/alert]
```

### 类型
- `info` - 信息提示（蓝色）
- `success` - 成功提示（绿色）
- `warning` - 警告提示（橙色）
- `error` - 错误提示（红色）

### 示例
```
[alert type="info" title="提示"]这是一个信息提示框。[/alert]

[alert type="success" title="成功"]操作成功完成！[/alert]

[alert type="warning" title="警告"]请注意检查配置。[/alert]

[alert type="error" title="错误"]操作失败，请重试。[/alert]
```

## 折叠面板

### 语法
```
[collapse title="标题" open="true|false"]内容[/collapse]
```

### 示例
```
[collapse title="点击展开内容"]
这里是要折叠的内容...
[/collapse]

[collapse title="默认展开" open="true"]
默认展开的内容...
[/collapse]
```

## 标签页

### 语法
```
[tabs]
  [tab title="标签1"]内容1[/tab]
  [tab title="标签2"]内容2[/tab]
  [tab title="标签3"]内容3[/tab]
[/tabs]
```

### 示例
```
[tabs]
  [tab title="HTML"]
    <div>HTML 内容</div>
  [/tab]
  [tab title="CSS"]
    <style>CSS 内容</style>
  [/tab]
  [tab title="JavaScript"]
    <script>JS 内容</script>
  [/tab]
[/tabs]
```

## 时间轴

### 语法
```
[timeline]
  [item date="2024-01" title="标题" desc="描述"]
  [item date="2023-12" title="标题" desc="描述"]
[/timeline]
```

### 示例
```
[timeline]
  [item date="2024-01" title="开始新项目" desc="启动了一个全新的项目..."]
  [item date="2023-12" title="完成学习" desc="完成了前端框架的学习..."]
  [item date="2023-11" title="发布文章" desc="发布了第一篇技术文章..."]
[/timeline]
```

## 注意事项

1. 短代码需要完整的开始和结束标签
2. 参数值可以使用单引号或双引号包裹
3. 短代码支持嵌套使用
4. 在 Markdown 中使用时，确保空格正确
5. 某些短代码可能需要 Halo 插件支持

## 扩展说明

这些短代码通过 JavaScript 实现，确保主题的 JavaScript 文件正常加载。如需自定义样式，可以通过主题设置中的"自定义 CSS"进行调整。
