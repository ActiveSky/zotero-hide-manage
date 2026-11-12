# Contributing

Thanks for helping improve Hide Manage.

English | [简体中文](CONTRIBUTING.zh-CN.md)

## Reporting issues

Please include:

- Zotero version (Help → About Zotero)
- Hide Manage version
- The plugins involved and their versions
- Steps to reproduce, and which menu is affected (File / Tools / item context menu / collection context menu)
- If an item is classified wrongly, the relevant section of `<Zotero data directory>/menuhider-inventory.json`

## Pull requests

1. Fork the repository and create a branch, e.g. `fix/xxx` or `feat/xxx`
2. Keep each change small and focused — one PR does one thing
3. In the PR description, state what changed, why, and how to verify it
4. If you add or change menu item detection, list the Zotero versions and plugin combinations you tested

## Development and build

No build dependencies. All source lives in `src/`; the repository root only keeps docs and the build script:

```
src/
├── manifest.json
├── bootstrap.js
├── prefs.js
└── content/
    ├── preferences.xhtml
    ├── preferences.js
    └── icon.svg
build.ps1
```

```powershell
pwsh ./build.ps1
```

The script puts the contents of `src/` at the XPI root (Zotero requires `manifest.json` at the package root). The resulting `hide-manage.xpi` can be dragged into Zotero's Plugins window for testing.

Debugging:

- Zotero → Tools → Developer → Run JavaScript: `Zotero.MenuHider` is available there
- Help → Debug Output Logging: look for lines prefixed with `[MenuHider]`

## Code conventions

- Plain JavaScript (ES2020), no runtime dependencies
- Native item detection lives in `NATIVE_MENUBAR_IDS` / `NATIVE_CONTEXT_IDS` in `src/bootstrap.js`; when you add a rule, update the settings pane call sites too
- Every hide or move operation must be reversible: only set the `hidden` attribute or move nodes, never delete them

## License

By submitting code you agree to release it under the [MIT](LICENSE) license.
