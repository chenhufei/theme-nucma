# 更新日志 v1.7.0

## 🐛 修复

- **修复安装错误**：修复 settings.yaml API 版本不正确导致的服务器内部错误
  - 将 `apiVersion: v1alpha1` 更正为 `apiVersion: ui.halo.run/v1alpha1`
  - 统一 settings.yaml 和 settings-i18n-example.yaml 的 API 版本格式

## ✨ 改进

- 提升主题安装的稳定性和兼容性
- 确保与 Halo 2.0+ 版本的完全兼容

## 📦 文件变更

### 修改
- `settings.yaml` - 修复 API 版本
- `settings-i18n-example.yaml` - 修复 API 版本
- `theme.yaml` - 版本号更新至 1.7.0

### 依赖版本
- Halo: >= 2.0.0

## 🔍 详细说明

本次更新修复了主题安装时的服务器内部错误问题。错误原因是 `settings.yaml` 文件的 API 版本格式不正确。

### 问题原因
- 原版本使用 `apiVersion: v1alpha1`（缺少 group 前缀）
- Halo 2.0+ 要求完整的 API 版本格式 `apiVersion: ui.halo.run/v1alpha1`

### 解决方案
- 更新所有 Setting 资源的 API 版本为完整格式
- 确保与官方主题保持一致

---

**发布日期**: 2026-03-22
