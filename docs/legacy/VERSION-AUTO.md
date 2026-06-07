# 版本号自动化

主题已配置自动化版本管理，每次修改后可快速更新版本号并构建。

## 使用方法

### 快捷命令（推荐）

#### 1. 仅更新版本号（不构建）
```bash
# 补丁版本：1.2.1 → 1.2.2
pnpm run version:patch

# 次要版本：1.2.1 → 1.3.0
pnpm run version:minor

# 主要版本：1.2.1 → 2.0.0
pnpm run version:major

# 默认补丁版本（可省略 :patch）
pnpm run version
```

#### 2. 更新版本号 + 构建（完整流程）
```bash
# 补丁版本 + 构建：1.2.1 → 1.2.2 → 生成 zip
pnpm run release:patch

# 次要版本 + 构建：1.2.1 → 1.3.0 → 生成 zip
pnpm run release:minor

# 主要版本 + 构建：1.2.1 → 2.0.0 → 生成 zip
pnpm run release:major
```

### 直接使用 Node.js 脚本
```bash
# 仅更新版本
node scripts/update-version.js patch  # 或 minor, major

# 默认补丁版本
node scripts/update-version.js
```

## 版本号规则

- **patch（补丁）**：Bug 修复、小调整（1.2.1 → 1.2.2）
- **minor（次要）**：新功能、重要改进（1.2.1 → 1.3.0）
- **major（主要）**：破坏性变更、重大重构（1.2.1 → 2.0.0）

## 工作流程

1. **修改代码** → 编辑模板或样式文件
2. **更新版本** → 运行 `pnpm run version:patch`
3. **构建主题** → 运行 `pnpm build`
4. **部署** → 上传生成的 `dist/theme-nucma-X.X.X.zip`

或者一步到位：
```bash
pnpm run release:patch
```

## 注意事项

- 脚本会自动更新 `package.json` 和 `theme.yaml` 中的版本号
- 构建后的文件位于 `dist/` 目录
- 版本号格式遵循语义化版本规范（Semantic Versioning）
- 使用 Node.js 编写，跨平台兼容（Windows/Linux/macOS）
