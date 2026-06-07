# Halo 主题安装 500 错误修复指南

## 🐛 错误现象

```
GET /apis/api.console.halo.run/v1alpha1/themes?page=1&size=1000&uninstalled=true
500 (Internal Server Error)
```

## 🔍 问题原因

这是 **Halo 后端服务器的内部错误**，通常由以下原因引起：

1. ✅ 主题包格式不正确
2. ✅ theme.yaml 或 settings.yaml 语法错误
3. ✅ 文件权限问题
4. ✅ 磁盘空间不足
5. ✅ Halo 缓存损坏

---

## 🚀 解决方案（按优先级）

### 方案 1：清理 Halo 缓存并重启（最常用）

```bash
# Docker 部署
docker exec -it halo bash
rm -rf /var/lib/halo/themes/.cache
exit
docker restart halo

# 本地部署
rm -rf /path/to/halo/themes/.cache
systemctl restart halo
```

---

### 方案 2：手动安装主题文件

如果 ZIP 上传失败，尝试手动复制：

```bash
# 1. 解压主题包
cd e:/Halo/theme-nucma
unzip -q dist/theme-nucma-1.7.0.zip -d halo-themes

# 2. 复制到 Halo 主题目录
cp -r halo-themes/* /path/to/halo/themes/theme-nucma/

# 3. 重启 Halo
systemctl restart halo
# 或
docker restart halo
```

---

### 方案 3：检查 Halo 日志获取详细错误

```bash
# Docker 部署
docker logs --tail 100 halo | grep -i "theme-nucma\|error\|exception"

# 本地部署
tail -n 100 /path/to/halo/logs/application.log | grep -i "theme-nucma\|error"
```

**常见错误类型**：

| 错误信息 | 解决方案 |
|---------|---------|
| `Invalid YAML` | 检查 theme.yaml/settings.yaml 语法 |
| `Permission denied` | 修改文件权限：`chmod 644 *.yaml` |
| `Out of memory` | 增加 Halo 内存配置 |
| `File not found` | 确认 ZIP 包包含所有必需文件 |

---

### 方案 4：验证主题包完整性

```bash
# Windows PowerShell
Add-Type -Assembly System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead("theme-nucma-1.7.0.zip")
$zip.Entries | Select-Object FullName, Length | Format-Table -AutoSize

# 检查必需文件是否在 ZIP 中
$zip.Entries | Where-Object { $_.FullName -match '^(theme.yaml|settings.yaml|templates/)'}
$zip.Dispose()
```

**必需文件清单**：
- ✓ `theme.yaml`
- ✓ `settings.yaml`
- ✓ `templates/index.html`
- ✓ `templates/layouts/base.html`

---

### 方案 5：使用官方主题测试

先安装官方主题验证 Halo 是否正常：

1. 下载官方主题：
   ```bash
   wget https://github.com/halo-sigs/theme-earth/releases/latest/download/theme-earth.zip
   ```

2. 尝试安装官方主题

3. 如果官方主题也无法安装 → **Halo 服务器问题**，需要检查 Halo 配置

---

### 方案 6：降级 Halo 版本

如果使用的是 Halo 最新版本，可能存在 bug：

```bash
# 查看当前版本
docker exec halo java -jar /app/halo.jar --version

# 尝试使用稳定版
docker run -d --name halo-stable \
  -p 8090:8090 \
  -v halo-data:/root/.halo2 \
  halohub/halo:2.10.0
```

---

### 方案 7：清理旧的 ZIP 包（推荐）

dist 目录下有太多旧版本文件可能影响 Halo 扫描：

```bash
# Windows PowerShell
cd e:/Halo/theme-nucma/dist
Get-ChildItem *.zip | Where-Object { $_.Name -ne 'theme-nucma-1.7.0.zip' } | Remove-Item

# 只保留最新版本
ls *.zip
```

---

## 📋 当前主题包信息

**版本**: v1.7.0  
**文件**: `theme-nucma-1.7.0.zip` (0.16 MB)  
**API 版本**: `theme.halo.run/v1alpha1` / `ui.halo.run/v1alpha1`  
**Halo 要求**: `>= 2.0.0`

### 配置文件状态

| 文件 | 状态 |
|-----|------|
| `theme.yaml` | ✓ OK |
| `settings.yaml` | ✓ OK |
| API 版本 | ✓ 修正为 `ui.halo.run/v1alpha1` |

---

## 🔧 快速修复脚本

创建 Windows PowerShell 脚本自动清理并安装：

```powershell
# fix-halo-theme.ps1
Write-Host "🔧 开始修复 Halo 主题安装问题..."

# 1. 清理旧版本
Write-Host "📦 清理旧版本 ZIP 包..."
cd e:/Halo/theme-nucma/dist
Get-ChildItem *.zip | Where-Object { $_.Name -ne 'theme-nucma-1.7.0.zip' } | Remove-Item

# 2. 解压到临时目录
Write-Host "📂 解压主题包..."
Expand-Archive -Path theme-nucma-1.7.0.zip -DestinationPath ../temp-theme -Force

# 3. 检查必需文件
Write-Host "✅ 检查必需文件..."
$required = @('theme.yaml', 'settings.yaml', 'templates/index.html')
foreach ($file in $required) {
    if (Test-Path "../temp-theme/$file") {
        Write-Host "  ✓ $file"
    } else {
        Write-Host "  ✗ 缺少 $file"
        exit 1
    }
}

Write-Host "✅ 检查完成！请手动将 temp-theme 目录复制到 Halo 主题目录"
Write-Host "   路径: $(Resolve-Path ../temp-theme)"
```

运行脚本：
```powershell
cd e:/Halo/theme-nucma
powershell -ExecutionPolicy Bypass -File fix-halo-theme.ps1
```

---

## 📞 需要进一步帮助？

### 提供以下信息以便诊断：

1. **Halo 版本**
   ```bash
   docker exec halo java -jar /app/halo.jar --version
   ```

2. **完整错误日志**
   ```bash
   docker logs halo > halo-error.log
   ```

3. **主题包信息**
   - 文件大小
   - 文件列表
   - SHA256 哈希值

4. **系统信息**
   - 操作系统版本
   - Docker 版本（如果使用）
   - 可用磁盘空间

### 提交 Issue

将上述信息提交到：
- **Halo 官方**: https://github.com/halo-dev/halo/issues
- **主题仓库**: https://github.com/chenhufei/theme-nucma/issues

---

## ✅ 成功安装后的检查

安装成功后，请确认：

- [ ] 主题在主题列表中显示
- [ ] 点击安装按钮无错误
- [ ] 激活主题成功
- [ ] 前台页面正常访问
- [ ] 主题设置面板可以打开

---

## 🎯 推荐流程

1. **优先**: 清理 Halo 缓存 + 重启
2. **其次**: 手动复制主题文件
3. **备选**: 查看 Halo 日志 → 定位具体错误
4. **终极**: 降级 Halo 或联系 Halo 社区
