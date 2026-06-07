# 主题安装修复指南

## 🐛 遇到的错误

```
Failed to load resource: the server responded with a status of 400 (Bad Request)
主题已存在: 主题 theme-nucma 已存在。
Failed to execute onConfirm: upgrade
```

## ✅ 解决方案

### 方法 1：删除旧版本后重新安装（推荐）

1. **进入 Halo 后台**
   - 登录您的 Halo 控制台
   - 访问地址：`http://your-domain/console/themes`

2. **卸载旧版本**
   - 找到 `Nucma` 主题
   - 点击卸载按钮
   - 确认删除

3. **重新安装新版本**
   - 点击 "安装主题"
   - 上传 `dist/theme-nucma-1.7.0.zip` 文件
   - 等待安装完成

4. **激活主题**
   - 安装成功后，点击激活按钮
   - 开始使用主题

---

### 方法 2：升级现有版本

如果您已安装 v1.6.9 或更早版本，可以直接升级：

1. **进入主题详情页**
   - 在主题列表中找到 `Nucma`
   - 点击进入主题详情

2. **上传升级包**
   - 找到 "升级" 按钮
   - 上传 `dist/theme-nucma-1.7.0.zip`
   - 确认升级

3. **刷新页面**
   - 升级完成后刷新浏览器
   - 新功能自动生效

---

### 方法 3：通过 CLI 卸载（高级用户）

如果无法通过后台卸载，可以使用 Halo CLI：

```bash
# 进入 Halo 目录
cd /path/to/halo

# 停止主题
halo theme uninstall theme-nucma

# 或者重置主题数据库
halo db reset
```

---

## 🔍 常见问题

### Q1: 为什么会提示"主题已存在"？

**原因**: 之前已经安装过同名主题，Halo 不允许重复安装。

**解决**: 必须先卸载旧版本才能安装新版本。

---

### Q2: 升级失败怎么办？

**原因**: 可能是版本号未更新或文件损坏。

**解决**:
1. 检查 `theme.yaml` 中的 `version` 是否正确
2. 重新构建主题：`npm run build`
3. 确认新版本号大于旧版本号

---

### Q3: 安装后出现 500 错误？

**原因**: 配置文件格式错误或缺少必需文件。

**解决**:
1. 检查 `settings.yaml` 格式是否正确
2. 确认 API 版本为 `ui.halo.run/v1alpha1`
3. 查看后台日志获取详细错误信息

---

## 📝 v1.7.0 更新内容

### 修复
- ✅ 修复 `settings.yaml` API 版本格式错误
- ✅ 修复安装时服务器内部错误

### 文件变更
- `settings.yaml` - API 版本修正
- `settings-i18n-example.yaml` - API 版本修正
- `theme.yaml` - 版本号更新至 1.7.0

---

## 🚀 安装后检查清单

安装成功后，请检查以下项目：

- [ ] 主题在主题列表中显示正常
- [ ] 可以成功激活主题
- [ ] 前台页面访问正常
- [ ] 主题设置面板可以打开
- [ ] 深色模式切换正常
- [ ] 首页布局显示正常

---

## 📞 需要帮助？

如果遇到其他问题，请：

1. **查看详细日志**
   - Halo 后台 → 设置 → 日志
   - 查找 `theme-nucma` 相关错误

2. **提供以下信息**
   - Halo 版本
   - 主题版本
   - 完整错误日志
   - 浏览器控制台错误

3. **提交 Issue**
   - GitHub: https://github.com/chenhufei/theme-nucma/issues
