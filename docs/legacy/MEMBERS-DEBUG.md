# 成员块调试指南

如果成员块不显示，请按以下步骤排查：

## 快速解决方案

### 方案 A：使用静态成员配置（推荐）⭐

**适用场景：**
- 成员插件 API 需要登录权限（前台访客无法访问）
- 不想安装成员插件
- 希望完全控制成员数据

**配置步骤：**

1. 进入 Halo 后台 > 主题 > Nucma > 设置
2. 找到「首页」分组
3. 找到「静态成员列表（备用方案）」配置项
4. 点击「添加」按钮，手动添加成员信息：
   - **姓名**：成员的显示名称（必填）
   - **头像链接**：成员头像的 URL（可选）
   - **简介**：成员的简短介绍（可选）
   - **学校/机构**：成员所属的学校或机构（可选，用于背景图）
5. 保存设置并刷新前台页面

**示例配置：**

```yaml
static_members:
  - displayName: 张三
    avatar: https://example.com/avatar1.jpg
    bio: 前端工程师
    school: 清华大学
  - displayName: 李四
    avatar: https://example.com/avatar2.jpg
    bio: 后端开发
    school: 北京大学
  - displayName: 王五
    avatar: https://example.com/avatar3.jpg
    bio: UI 设计师
    school: 复旦大学
```

**优点：**
- ✅ 不依赖成员插件 API
- ✅ 不需要登录权限
- ✅ 配置简单，直接在主题设置中管理
- ✅ 支持所有翻牌效果和动画
- ✅ 数据完全可控

### 方案 B：使用成员插件

**适用场景：**
- 希望使用插件的动态数据管理
- API 可以公开访问（不需要登录）

**配置步骤：**

1. 安装成员插件：https://www.halo.run/store/apps/app-hfbQg
2. 在插件设置中配置公开访问权限
3. 添加成员数据
4. （可选）在主题设置中配置「首页展示的成员 ID」

**注意：** 如果成员插件的 API 需要登录权限，前台访客将无法访问，此时应使用方案 A 的静态配置。

---

## 工作原理

主题会按以下优先级获取成员数据：

1. **静态成员配置**（优先级最高）
   - 如果在主题设置中配置了静态成员，直接使用
   - 不会尝试调用 API

2. **成员插件 API**（备用方案）
   - 如果没有静态配置，尝试从多个可能的 API 端点获取
   - 自动尝试以下端点（按优先级）：
     - `/apis/anonymous.member.plugin.halo.run/v1alpha1/members` ⭐ **公开 API，不需要登录**
     - `/apis/member.plugin.halo.run/v1alpha1/members`
     - `/apis/api.member.plugin.halo.run/v1alpha1/members`
     - `/apis/core.halo.run/v1alpha1/members`
     - `/apis/plugin.halo.run/v1alpha1/plugins/plugin-members/members`
     - `/api/plugin/members`
     - `/api/members`

3. **自定义 API 端点**（高级选项）
   - 如果自动检测失败，可以在主题设置中手动指定 API 端点
   - 配置项：「成员 API 端点（高级）」

### 为什么 Members 页面不需要登录就能看？

Members 页面和首页成员块使用不同的数据获取方式：

- **Members 页面**：使用 **Thymeleaf 服务端渲染**，数据由后端直接传递（`${groups}`），不需要前端 API 调用
- **首页成员块**：使用 **前端 JavaScript** 通过 `fetch()` 调用 API 获取数据

Members 页面中的 API 调用（如加载分组、提交申请）使用的是 **`anonymous` 公开 API**，不需要登录权限。

现在首页成员块也会优先尝试 `anonymous` API，如果成员插件提供了公开 API，应该可以正常获取数据。

---

## 1. 检查插件是否正确安装

在 Halo 后台：
1. 进入「插件」页面
2. 确认「成员插件」已安装且状态为「已启用」
3. 确认插件版本兼容当前 Halo 版本

## 2. 检查是否有成员数据

1. 进入「成员」管理页面
2. 确认至少添加了一个成员
3. 确认成员状态为「已发布」或「公开」

## 3. 查找正确的 API 端点

### 方法 1：查看控制台日志

1. 打开浏览器开发者工具（F12）
2. 切换到「Console」标签
3. 刷新页面，查看 `[Members]` 开头的日志
4. 找到所有尝试的 API 端点列表

### 方法 2：手动测试 API

在浏览器地址栏依次访问以下 URL（替换 `your-domain.com` 为你的域名）：

```
https://your-domain.com/apis/member.plugin.halo.run/v1alpha1/members
https://your-domain.com/apis/api.member.plugin.halo.run/v1alpha1/members
https://your-domain.com/apis/core.halo.run/v1alpha1/members
https://your-domain.com/apis/plugin.halo.run/v1alpha1/plugins/plugin-members/members
https://your-domain.com/api/plugin/members
https://your-domain.com/api/members
```

**找到返回 JSON 数据的 URL**，例如：
```json
{
  "items": [
    {
      "spec": {
        "displayName": "张三",
        "avatar": "https://...",
        ...
      }
    }
  ]
}
```

### 方法 3：查看插件文档

1. 访问成员插件的 GitHub 仓库或文档
2. 查找 API 端点说明
3. 确认正确的 API 路径

## 4. 配置自定义 API 端点

如果找到了正确的 API 端点：

1. 进入 Halo 后台「主题」→「主题设置」
2. 找到「首页」分组
3. 找到「成员 API 端点（高级）」配置项
4. 填入正确的 API 路径，例如：
   ```
   /apis/member.plugin.halo.run/v1alpha1/members
   ```
5. 保存设置并刷新前台页面

## 5. 检查成员 ID 配置

如果配置了「首页展示的成员 ID」：

1. 确认填写的 ID 格式正确：`1,2,3`（用英文逗号分隔）
2. 确认这些 ID 对应的成员确实存在
3. 尝试留空该配置，显示所有成员

## 6. 查看详细错误信息

打开浏览器控制台，查看完整的错误信息：

```javascript
// 查看响应状态
[Members] 响应状态: 404 Not Found

// 查看响应类型
[Members] 响应类型: text/html

// 查看错误消息
[Members] API 请求失败: /apis/... SyntaxError: ...
```

### 常见错误及解决方案

#### 错误 1：404 Not Found
**原因**：API 端点不存在
**解决**：尝试其他 API 端点或查看插件文档

#### 错误 2：SyntaxError: Unexpected token '<'
**原因**：返回的是 HTML 而不是 JSON（通常是 404 页面）
**解决**：API 端点错误，需要找到正确的端点

#### 错误 3：403 Forbidden
**原因**：没有权限访问 API
**解决**：检查插件权限设置或 Halo 安全配置

#### 错误 4：CORS 错误
**原因**：跨域请求被阻止
**解决**：检查 Halo 的 CORS 配置

## 7. 联系支持

如果以上方法都无法解决，请提供以下信息：

1. Halo 版本号
2. 成员插件版本号
3. 浏览器控制台的完整日志（`[Members]` 开头的所有行）
4. 手动访问 API 端点的返回内容
5. 主题版本号

## 8. 临时禁用成员块

如果暂时不需要成员功能：

1. 进入「主题设置」→「首页」
2. 取消勾选「显示团队成员区块」
3. 保存设置

---

## 成功案例参考

### 案例 1：标准成员插件
- **插件名称**：Halo Members Plugin
- **API 端点**：`/apis/member.plugin.halo.run/v1alpha1/members`
- **配置**：无需额外配置，自动检测成功

### 案例 2：自定义成员插件
- **插件名称**：Custom Members
- **API 端点**：`/apis/custom.plugin.halo.run/v1alpha1/members`
- **配置**：需要在主题设置中手动指定 API 端点

---

## 开发者调试

如果你是开发者，可以在控制台运行以下代码测试：

```javascript
// 测试 API 端点
fetch('/apis/member.plugin.halo.run/v1alpha1/members')
  .then(res => res.json())
  .then(data => console.log('成员数据:', data))
  .catch(err => console.error('错误:', err));

// 查看所有可用的 API
fetch('/apis')
  .then(res => res.json())
  .then(data => console.log('所有 API:', data));
```
