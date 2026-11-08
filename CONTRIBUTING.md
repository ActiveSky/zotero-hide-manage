# Contributing

感谢你愿意参与改进 Hide Manage。

## 提交 Issue

请尽量附上：

- Zotero 版本（帮助 → 关于 Zotero）
- Hide Manage 版本
- 涉及的插件及其版本
- 复现步骤，以及出问题的菜单（File / Tools / 条目右键 / 分类右键）
- 若涉及分类错误，附上 `<Zotero 数据目录>/menuhider-inventory.json` 中相关菜单的片段

## 提交 Pull Request

1. Fork 并创建分支，分支名建议 `fix/xxx` 或 `feat/xxx`
2. 改动保持小而聚焦，一个 PR 只做一件事
3. 在 PR 描述中写清楚：改了什么、为什么改、如何验证
4. 若新增或修改菜单项识别逻辑，请在 PR 中说明测试过的 Zotero 版本与插件组合

## 开发与打包

无构建依赖：

```powershell
pwsh ./build.ps1
```

生成的 `hide-manage.xpi` 可直接拖入 Zotero 插件窗口测试。

调试入口：

- Zotero → 工具 → 开发者 → 运行 JavaScript：可访问 `Zotero.MenuHider`
- 帮助 → 调试输出日志：查看 `[MenuHider]` 前缀的日志

## 代码约定

- 纯 JavaScript（ES2020），不引入运行时依赖
- 原生项判定逻辑集中在 `bootstrap.js` 的 `NATIVE_MENUBAR_IDS` / `NATIVE_CONTEXT_IDS`，新增判定请同步更新设置页的调用
- 任何隐藏/移动操作必须可逆：只改 `hidden` 属性或移动节点，不删除节点

## 许可证

提交代码即表示同意以 [MIT](LICENSE) 许可证发布。
