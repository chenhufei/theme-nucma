# theme-nucma v1.7.0 完整安装指南

## ✅ 重要提示

**已手动重新打包主题包**，请使用新的 `dist/theme-nucma-1.7.0.zip`

文件大小：157,573 字节（154 KB）  
打包时间：2026-03-22 09:42

---

## 🚀 方法 1：通过 Halo 后台安装（推荐）

### 步骤 1：下载主题包

```bash
# 从服务器下载
scp user@server:/path/to/Halo/theme-nucma/dist/theme-nucma-1.7.0.zip .

# 或直接从本机复制
# e:/Halo/theme-nucma/dist/theme-nucma-1.7.0.zip
```

### 步骤 2：上传到 Halo

1. 登录 Halo 后台：`http://your-domain/console`
2. 进入 **主题** → **安装主题**
3. 点击上传按钮
4. 选择 `theme-nucma-1.7.0.zip`
5. 等待上传和安装完成

### 步骤 3：激活主题

1. 在主题列表中找到 **Nucma**
2. 点击"激活"按钮
3. 进入主题设置进行配置

---

## 🚀 方法 2：手动复制到主题目录

如果上传失败，可以直接复制文件：

### Docker 部署

```bash
# 1. 解压主题包
cd e:/Halo/theme-nucma
mkdir -p temp-extract
powershell -Command "Expand-Archive -Path dist/theme-nucma-1.7.0.zip -DestinationPath temp-extract -Force"

# 2. 复制到 Docker 容器
docker cp temp-extract/. halo:/var/lib/halo/themes/theme-nucma/

# 3. 修复权限
docker exec halo chown -R halo:halo /var/lib/halo/themes/theme-nucma

# 4. 重启 Halo
docker restart halo
```

### 本地部署

```bash
# 1. 解压
cd e:/Halo/theme-nucma
mkdir -p temp-extract
powershell -Command "Expand-Archive -Path dist/theme-nucma-1.7.0.zip -DestinationPath temp-extract -Force"

# 2. 复制到主题目录
cp -r temp-extract/* /path/to/halo/themes/theme-nucma/

# 3. 修复权限
chmod -R 644 /path/to/halo/themes/theme-nucma/*
find /path/to/halo/themes/theme-nucma -type d -exec chmod 755 {} \;

# 4. 重启 Halo
systemctl restart halo
```

---

## 🚀 方法 3：使用 CLI 工具

### 使用 theme-package CLI

```bash
cd e:/Halo/theme-nucma

# 构建并打包（使用 CLI）
npm run build

# 或使用手动打包（推荐）
npm run build:manual
```

---

## 🔍 验证安装

### 1. 检查主题列表

访问 Halo 后台主题页面，确认：
- ✓ "Nucma" 主题出现在列表中
- ✓ 版本显示为 1.7.0
- ✓ 主题截图正常显示

### 2. 激活主题

点击激活后，访问前台：
- ✓ 页面正常显示
- ✓ 深色模式切换正常
- ✓ 所有功能可用

### 3. 检查主题设置

进入主题设置：
- ✓ 设置面板可以打开
- ✓ 所有配置选项正常
- ✓ 保存配置无错误

---

## 🐛 故障排除

### 问题 1：上传时 500 错误

**原因**：Halo 后端解析 ZIP 包失败

**解决方案**：

1. **清理 Halo 缓存**
   ```bash
   docker restart halo
   ```

2. **查看 Halo 日志**
   ```bash
   docker logs --tail 200 halo | grep -i error
   ```

3. **使用手动复制方式**（见方法 2）

---

### 问题 2：主题已存在

**错误信息**：
```
主题已存在: 主题 theme-nucma 已存在
```

**解决方案**：

1. **卸载旧版本**
   - 进入 Halo 后台 → 主题
   - 找到 Nucma 主题
   - 点击卸载

2. **升级现有版本**
   - 进入主题详情页
   - 点击"升级"
   - 上传新 ZIP

3. **手动删除**
   ```bash
   # Docker
   docker exec halo rm -rf /var/lib/halo/themes/theme-nucma

   # 本地
   rm -rf /path/to/halo/themes/theme-nucma
   ```

---

### 问题 3：激活后页面空白

**原因**：模板文件缺失或权限错误

**解决方案**：

1. **检查文件完整性**
   ```bash
   # 确认必需文件存在
   ls /var/lib/halo/themes/theme-nucma/theme.yaml
   ls /var/lib/halo/themes/theme-nucma/templates/index.html
   ```

2. **检查文件权限**
   ```bash
   chmod 644 /var/lib/halo/themes/theme-nucma/*.yaml
   chmod 755 /var/lib/halo/themes/theme-nucma/templates/
   ```

3. **查看浏览器控制台错误**
   - 打开浏览器开发者工具（F12）
   - 查看 Console 和 Network 标签

---

### 问题 4：主题设置面板打不开

**原因**：`settings.yaml` 格式错误或 API 版本不匹配

**解决方案**：

1. **检查 settings.yaml**
   ```yaml
   apiVersion: ui.halo.run/v1alpha1  # ← 必须是这个版本
   kind: Setting
   metadata:
     name: theme-nucma-setting
   spec:
     forms: [...]
   ```

2. **查看 Halo 日志**
   ```bash
   docker logs halo | grep "Setting\|settings.yaml"
   ```

---

## 📋 主题包验证

### 检查 ZIP 内容

运行验证脚本：

```powershell
cd e:/Halo/theme-nucma
powershell -ExecutionPolicy Bypass -File verify-zip.ps1
```

**预期输出**：
```
=== 检查必需文件 ===
✓ theme.yaml
✓ settings.yaml

=== templates 目录 ===
共 53 个文件

=== i18n 目录 ===
共 2 个文件
```

---

## 🎯 推荐安装流程

1. ✅ **下载新的 ZIP**（手动打包，154 KB）
2. ✅ **清理 Halo 缓存**（`docker restart halo`）
3. ✅ **上传主题包**（Halo 后台）
4. ✅ **激活主题**
5. ✅ **配置主题设置**

---

## 📞 需要帮助？

### 收集诊断信息

```bash
# 1. Halo 版本
docker exec halo java -jar /app/halo.jar --version

# 2. Halo 日志
docker logs --tail 500 halo > halo-debug.log

# 3. 主题目录结构
ls -la /var/lib/halo/themes/theme-nucma/

# 4. 主题配置
cat /var/lib/halo/themes/theme-nucma/theme.yaml
```

### 提交 Issue

将上述信息提交到：
- **主题仓库**: https://github.com/chenhufei/theme-nucma/issues
- **Halo 官方**: https://github.com/halo-dev/halo/issues

---

## ✅ 安装成功后的检查清单

- [ ] 主题在主题列表中显示
- [ ] 版本号正确（1.7.0）
- [ ] 可以上传并激活主题
- [ ] 前台页面正常访问
- [ ] 深色模式切换正常
- [ ] 主题设置面板可以打开
- [ ] 配置可以保存
- [ ] 所有动画效果正常
- [ ] 移动端显示正常

---

## 📚 相关文档

- [500 错误修复指南](./500-ERROR-FIX.md)
- [手动打包说明](./MANUAL-PACKAGE.md)
- [动画使用指南](./ANIMATION-GUIDE.md)
- [快速开始](./QUICKSTART-ANIMATIONS.md)
- [版本历史](./VERSION-HISTORY.md)

---

**最后更新**: 2026-03-22  
**主题版本**: 1.7.0  
**打包方式**: 手动 PowerShell 脚本
