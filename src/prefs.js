/* Default preferences for Menu Hider (prototype) */

/* Menubar: hide plugin items unless explicitly whitelisted.
   show = { "file": ["l10n:..."], "tools": ["plugin:..."] } */
pref("extensions.zotero.menuhider.showOnly", true);
pref("extensions.zotero.menuhider.show", "{}");

/* Context menus: everything is shown under Other unless listed here */
pref("extensions.zotero.menuhider.contextHidden", "{}");

/* Explicit hide rules (works for native items too) */
pref("extensions.zotero.menuhider.rules", "{}");

pref("extensions.zotero.menuhider.scan", true);

/* Context-menu grouping */
pref("extensions.zotero.menuhider.groupMenus", true);
pref("extensions.zotero.menuhider.groupLabel", "Other");
pref("extensions.zotero.menuhider.minGroupSize", 2);

/* Legacy (non-MenuManager) items can only be attributed by id/l10n prefix */
pref("extensions.zotero.menuhider.legacyGroups", '{"zoterostyle-":"Ethereal Style","style-plugin-":"Ethereal Style","ccf-":"CCF Rank","linter-":"Linter","citationtally-":"Citation Tally","BetterNotes-":"Better Notes"}');

/* Force these to be treated as native: "id:...", "l10n:...", "label:..." */
pref("extensions.zotero.menuhider.nativeIds", "[]");
