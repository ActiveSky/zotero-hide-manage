# Changelog

所有重要变更都记录在此文件。版本号遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

### Changed

- 仓库结构调整：插件源码移入 `src/`，根目录只保留文档、构建脚本和更新清单
- README 改为英文优先，中文版移至 `README.zh-CN.md`，开发说明同步新的目录结构
- README 增加设置页与实际效果截图，按功能成对展示（`docs/images/`）
- CONTRIBUTING 改为英文优先，中文版移至 `CONTRIBUTING.zh-CN.md`

## [0.6.0] - 2026-11-08

首个公开发布版本。

### Added

- **System Manage**：按 File / Edit / View / Tools / Help 五个菜单管理第三方项，默认全部隐藏，勾选后显示
- **Context Menu**：条目 / 分类右键菜单的第三方项统一收进 **Other** 子菜单，按插件分组
- 设置页（设置 → Hide Manage），支持 Show all / Hide all / Refresh 与实时计数
- 原生 / 插件项的精确分类：MenuManager class 标记 + Zotero 10 原生 id 白名单
- 延迟校正机制，避免插件在自身 `popupshowing` 中重置隐藏状态
- 稳定性诊断：可选的菜单清单导出（`menuhider-inventory.json`）

### Notes

- 支持 Zotero 8 – 11
- 与 Ethereal Style 的「菜单可见性管理」互斥，请保持其关闭

## [0.5.2] - 2026-11-08

### Fixed

- 右键菜单中原生项（如 `addFeed`）被误判为插件项
- 设置页把子菜单内部条目全部展开（Linter 的 20+ 条规则项）
- 部分插件在 `popupshowing` 中重置 `hidden`，导致取消勾选的项仍然显示

## [0.5.0] - 2026-11-08

### Added

- Context Menu 设置页正式可用：Item / Collection 双标签、逐项勾选
- `contextHidden` 配置项

## [0.4.0] - 2026-11-08

### Changed

- 插件更名为 **Hide Manage**
- 设置页改为「System Manage / Context Menu」两个大类
- 设置脚本改用 `PreferencePanes.register` 的 `scripts` 参数加载

### Fixed

- 内联脚本不执行导致设置页空白
- 面板标题重复

## [0.3.2] - 2026-11-08

### Fixed

- 设置页 XHTML 中的 `&mdash;` 实体导致 fragment 解析失败

## [0.3.0] - 2026-11-08

### Added

- 菜单栏改为白名单模型：第三方项默认隐藏，勾选后显示
- Help 菜单纳入管理
- System Manage 设置页

## [0.2.0] - 2026-11-08

### Added

- 条目 / 分类右键菜单收纳：第三方项统一移入 **Other**，按插件分组

## [0.1.0] - 2026-11-08

### Added

- 原型：菜单栏项的隐藏规则（`id:` / `l10n:` / `label:` / `plugin:`）
- 分隔符自动清理
