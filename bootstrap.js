/*
 * Menu Hider — prototype for Zotero 7+
 *
 * Two features:
 *   1. Hide items in menubar menus (File / Edit / View / Go / Tools / Help).
 *   2. Collapse plugin-injected items in the item / collection context menus
 *      into one top-level submenu, grouped by plugin.
 *
 * Prefs (all under extensions.zotero.menuhider.):
 *   rules        JSON string, hide rules
 *   scan         bool, write an inventory file on every menu show
 *   groupMenus   bool, enable context-menu grouping
 *   groupLabel   string, top-level label (default "Other")
 *   minGroupSize int, only create a per-plugin submenu when it has >= N items
 *   legacyGroups JSON object, id/l10n prefix -> plugin display name
 *   nativeIds    JSON array, force these items to be treated as native
 *
 * Rule / key format: id:<id>, l10n:<l10nID>, label:<text>, plugin:<pluginID>
 */

var MenuHider = {
	prefPrefix: "menuhider.",
	GROUP_ID: "menuhider-group",
	GROUP_MENU_CLASS: "menuhider-group-menu",
	MENU_IDS: {
		menu_FilePopup: "file",
		menu_EditPopup: "edit",
		menu_viewPopup: "view",
		menu_goPopup: "go",
		menu_ToolsPopup: "tools",
		menu_HelpPopup: "help",
		"zotero-itemmenu": "item",
		"zotero-collectionmenu": "collection"
	},
	CONTEXT_KEYS: { item: true, collection: true },
	handlers: new Map(),
	pluginNames: new Map(),

	log: function (msg) {
		try {
			Zotero.debug("[MenuHider] " + msg);
		}
		catch (e) {}
	},

	// ---------------------------------------------------------------- prefs

	getPref: function (key, fallback) {
		try {
			var value = Zotero.Prefs.get(this.prefPrefix + key);
			return (value === undefined || value === null || value === "") ? fallback : value;
		}
		catch (e) {
			return fallback;
		}
	},

	parseJSON: function (key, fallback) {
		var raw = this.getPref(key, "");
		if (!raw) {
			return fallback;
		}
		try {
			return JSON.parse(raw);
		}
		catch (e) {
			this.log("cannot parse pref " + key + ": " + e);
			return fallback;
		}
	},

	getRules: function () {
		var parsed = this.parseJSON("rules", {});
		if (Array.isArray(parsed)) {
			return { "*": parsed };
		}
		return (parsed && typeof parsed === "object") ? parsed : {};
	},

	// Menubar menus controlled by the "show only checked" model.
	MANAGED_MENUBAR: { file: true, edit: true, view: true, tools: true, help: true },

	showOnlyEnabled: function () {
		return !!this.getPref("showOnly", true);
	},

	getShowList: function (menuKey) {
		var show = this.parseJSON("show", {});
		var list = show && show[menuKey];
		return Array.isArray(list) ? list : [];
	},

	// Context menus use the opposite model: everything is shown under "Other"
	// unless it appears in this per-menu hidden list.
	getContextHidden: function (menuKey) {
		var hidden = this.parseJSON("contextHidden", {});
		var list = hidden && hidden[menuKey];
		return Array.isArray(list) ? list : [];
	},

	// Hide every plugin item that isn't explicitly whitelisted.
	// Native items are never touched by this rule.
	applyShowWhitelist: function (popup, menuKey, options) {
		if (!this.showOnlyEnabled() || !this.MANAGED_MENUBAR[menuKey]) {
			return 0;
		}
		var showList = this.getShowList(menuKey);
		var overrides = this.getNativeOverrides();
		var count = 0;
		var children = Array.prototype.slice.call(popup.children);
		for (var i = 0; i < children.length; i++) {
			var el = children[i];
			if (el.tagName.toLowerCase() === "menuseparator" || el.id === this.GROUP_ID) {
				continue;
			}
			if (this.isNativeMenubarItem(el, menuKey, overrides)) {
				continue;
			}
			var keys = this.getKeys(el, options);
			var visible = false;
			for (var k = 0; k < keys.length; k++) {
				if (showList.indexOf(keys[k]) !== -1) {
					visible = true;
					break;
				}
			}
			if (!visible) {
				this.hide(el);
				count++;
			}
		}
		return count;
	},

	scanEnabled: function () {
		return !!this.getPref("scan", false);
	},

	groupEnabled: function () {
		return !!this.getPref("groupMenus", true);
	},

	getGroupLabel: function () {
		return String(this.getPref("groupLabel", "Other"));
	},

	getMinGroupSize: function () {
		var value = parseInt(this.getPref("minGroupSize", 2), 10);
		return isNaN(value) || value < 1 ? 2 : value;
	},

	getLegacyGroups: function () {
		return this.parseJSON("legacyGroups", {});
	},

	getNativeOverrides: function () {
		var list = this.parseJSON("nativeIds", []);
		return Array.isArray(list) ? list : [];
	},

	// ------------------------------------------------------------- identity

	normalizeLabel: function (label) {
		return String(label || "")
			.replace(/\s+/g, " ")
			.trim()
			.replace(/[…]+/g, "...")
			.replace(/\.\.\.$/, "")
			.trim();
	},

	getMenuManagerOptions: function () {
		try {
			return Zotero.MenuManager._menuManager.options || [];
		}
		catch (e) {
			return [];
		}
	},

	getPluginIDForElement: function (el, options) {
		if (!el.classList) {
			return "";
		}
		for (var i = 0; i < options.length; i++) {
			var menuID = options[i].menuID;
			if (menuID && el.classList.contains(menuID)) {
				return options[i].pluginID || "";
			}
		}
		return "";
	},

	getKeys: function (el, options) {
		var keys = [];
		if (!el || el.nodeType !== 1) {
			return keys;
		}
		if (el.id) {
			keys.push("id:" + el.id);
		}
		var l10n = el.getAttribute("data-l10n-id");
		if (l10n) {
			keys.push("l10n:" + l10n);
		}
		var label = el.getAttribute("label");
		if (label) {
			keys.push("label:" + this.normalizeLabel(label));
		}
		if (el.classList && el.classList.contains("zotero-custom-menu-item")) {
			var pluginID = this.getPluginIDForElement(el, options || []);
			if (pluginID) {
				keys.push("plugin:" + pluginID);
			}
		}
		return keys;
	},

	isPluginItem: function (el) {
		return !!(el.classList && el.classList.contains("zotero-custom-menu-item"));
	},

	// Native Zotero items always carry a zotero-menuitem-* class, including
	// dynamically generated ones (see locateMenu.js ViewItem). This applies to
	// context menus. Menubar menus need the separate check below.
	isNative: function (el, overrides) {
		if (!el.classList) {
			return false;
		}
		if (el.classList.contains("zotero-custom-menu-item")) {
			return false;
		}
		for (var i = 0; i < el.classList.length; i++) {
			if (el.classList[i].indexOf("zotero-menuitem-") === 0) {
				return true;
			}
		}
		var keys = this.getKeys(el, []);
		for (var j = 0; j < overrides.length; j++) {
			if (keys.indexOf(overrides[j]) !== -1) {
				return true;
			}
		}
		return false;
	},

	// Native menubar ids, taken from chrome/content/zotero/zoteroPane.xhtml
	// (Zotero 10.0.x). Anything not listed here is treated as plugin-injected,
	// unless it matches one of the class/id heuristics below.
	NATIVE_MENUBAR_IDS: {
		file: "menu_newItem menu_addByIdentifier menu_attachmentAdd menu_noteAdd menu_newCollection menu_groupAdd menu_feedAddMenu menu_feedAddFromURL menu_feedAddFromOPML menu_transferFromPDF menu_importFromEPUB menu_export_file menu_print menu_showInLibrary menu_close menu_close_tab menu_showFile menu_export_files menu_import menu_importFromClipboard menu_exportLibrary menu_fileQuitSeparatorNonMac menu_fileQuitItemWin menu_fileQuitItemUnix",
		edit: "menu_undo menu_redo menu_cut menu_copy menu_copyCitation menu_copyBibliography menu_copyExport menu_copyNote menu_copyAnnotation menu_paste menu_delete menu_selectAll menu_rotateLeft menu_rotateRight menu_find menu_find_reader menu_advancedSearch menuitem-advanced-search textfieldDirection-separator textfieldDirection-swap menu-edit-bidi-switch-text-direction menu_EditPreferencesSeparator menu_EditPreferencesItem menu-settings",
		view: "view-menuitem-hand-tool view-menuitem-vertical-scrolling view-menuitem-horizontal-scrolling view-menuitem-wrapped-scrolling view-menuitem-no-spreads view-menuitem-odd-spreads view-menuitem-even-spreads view-menuitem-scrolled view-menuitem-paginated view-menuitem-zoom-in view-menuitem-zoom-out view-menuitem-zoom-reset view-menuitem-zoom-auto view-menuitem-zoom-page-width view-menuitem-zoom-page-height view-menuitem-split-horizontally view-menuitem-split-vertically layout-menu view-menuitem-standard view-menuitem-stacked view-menuitem-collections-pane view-menuitem-item-pane view-menuitem-tag-selector density-menu menu-density view-menuitem-ui-density-compact menu-ui-density-compact view-menuitem-ui-density-comfortable menu-ui-density-comfortable font-size-menu view-menuitem-font-size-bigger view-menuitem-font-size-smaller view-menuitem-font-size-reset note-font-size-menu menu-view-note-font-size view-menuitem-note-font-size-bigger view-menuitem-note-font-size-smaller view-menuitem-note-font-size-reset note-tab-font-size-menu menu-view-note-tab-font-size view-menuitem-note-tab-font-size-reset column-picker-submenu sort-submenu view-menuitem-recursive-collections view-menuitem-hide-context-annotation-rows show-tabs-menu menu-show-tabs-menu",
		go: "go-menuitem-first-page go-menuitem-last-page go-menuitem-back go-menuitem-forward",
		tools: "menu_rtfScan installConnector menu_addons menu-tools-plugins developer-menu menu_errorConsole menu_runJS style-editor-menu-item scaffold-menu-item manage-attachments-menu manage-attachments-menupopup file-menuitem-convert-to-stored file-menuitem-normalize-attachment-titles menu-normalize-attachment-titles",
		help: "menu_openHelp troubleShooting feedbackPage reportErrors debug-output-menu debug-output-submit debug-output-enable-disable debug-output-status debug-output-view debug-output-clear debug-output-restart-enabled menuitem-restart-in-troubleshooting-mode restart-in-troubleshooting-mode-menuitem checkForUpdates aboutName"
	},

	// Native ids for context menus, from zoteroPane.xhtml (Zotero 10.0.x).
	// Most context-menu natives carry a zotero-menuitem-* class; the ones below
	// don't, so they need an explicit list.
	NATIVE_CONTEXT_IDS: {
		item: "",
		collection: "sync newCollection newSubcollection refreshFeed showDuplicates showUnfiled showRecentlyRead showRetracted showPublications editSelectedCollection moveCollection copyCollection duplicate markReadFeed editSelectedFeed addFeed deleteCollection clearAllLastRead deleteCollectionAndItems exportCollection createBibCollection exportFile loadReport emptyTrash removeLibrary"
	},

	contextIdSets: null,

	getNativeContextIdSet: function (menuKey) {
		if (!this.contextIdSets) {
			this.contextIdSets = {};
			for (var key in this.NATIVE_CONTEXT_IDS) {
				var set = {};
				var parts = this.NATIVE_CONTEXT_IDS[key].split(/\s+/);
				for (var i = 0; i < parts.length; i++) {
					if (parts[i]) {
						set[parts[i]] = true;
					}
				}
				this.contextIdSets[key] = set;
			}
		}
		return this.contextIdSets[menuKey] || {};
	},

	isNativeContextItem: function (el, menuKey, overrides) {
		if (!el.classList) {
			return true;
		}
		if (el.classList.contains("zotero-custom-menu-item")) {
			return false;
		}
		for (var i = 0; i < el.classList.length; i++) {
			if (el.classList[i].indexOf("zotero-menuitem-") === 0) {
				return true;
			}
		}
		if (el.id && this.getNativeContextIdSet(menuKey)[el.id]) {
			return true;
		}
		var keys = this.getKeys(el, []);
		for (var j = 0; j < overrides.length; j++) {
			if (keys.indexOf(overrides[j]) !== -1) {
				return true;
			}
		}
		return false;
	},

	nativeIdSets: null,

	getNativeIdSet: function (menuKey) {
		if (!this.nativeIdSets) {
			this.nativeIdSets = {};
			for (var key in this.NATIVE_MENUBAR_IDS) {
				var set = {};
				var parts = this.NATIVE_MENUBAR_IDS[key].split(/\s+/);
				for (var i = 0; i < parts.length; i++) {
					if (parts[i]) {
						set[parts[i]] = true;
					}
				}
				this.nativeIdSets[key] = set;
			}
		}
		return this.nativeIdSets[menuKey] || {};
	},

	isNativeMenubarItem: function (el, menuKey, overrides) {
		if (!el.classList) {
			return true;
		}
		if (el.classList.contains("zotero-custom-menu-item")) {
			return false;
		}
		for (var i = 0; i < el.classList.length; i++) {
			var cls = el.classList[i];
			if (cls.indexOf("zotero-menuitem-") === 0 || cls.indexOf("menu-type-") === 0) {
				return true;
			}
		}

		var id = el.id || "";
		if (id) {
			// Zotero's own menubar ids follow these prefixes
			if (/^(menu_|menu-|view-menuitem-|go-menuitem-|file-menuitem-|textfieldDirection-|debug-output-)/.test(id)) {
				return true;
			}
			if (this.getNativeIdSet(menuKey)[id]) {
				return true;
			}
		}

		var keys = this.getKeys(el, []);
		for (var j = 0; j < overrides.length; j++) {
			if (keys.indexOf(overrides[j]) !== -1) {
				return true;
			}
		}
		return false;
	},

	getOwner: function (el, options, legacyMap) {
		if (this.isPluginItem(el)) {
			var pluginID = this.getPluginIDForElement(el, options);
			if (pluginID) {
				var name = this.pluginNames.get(pluginID) || pluginID.split("@")[0] || pluginID;
				return { key: "plugin:" + pluginID, label: name };
			}
			return { key: "plugin:unknown", label: "Plugins" };
		}

		var ids = [];
		if (el.id) {
			ids.push(el.id);
		}
		var l10n = el.getAttribute("data-l10n-id");
		if (l10n) {
			ids.push(l10n);
		}
		for (var prefix in legacyMap) {
			for (var i = 0; i < ids.length; i++) {
				if (ids[i].indexOf(prefix) === 0) {
					return { key: "legacy:" + legacyMap[prefix], label: legacyMap[prefix] };
				}
			}
		}
		return { key: "legacy:misc", label: "Misc" };
	},

	// ---------------------------------------------------------- hiding part

	hide: function (el) {
		el.setAttribute("hidden", "true");
		el.setAttribute("data-menuhider-hidden", "1");
	},

	restoreHidden: function (popup) {
		var mine = popup.querySelectorAll('[data-menuhider-hidden="1"]');
		for (var i = 0; i < mine.length; i++) {
			mine[i].removeAttribute("hidden");
			mine[i].removeAttribute("data-menuhider-hidden");
		}
	},

	applyHideRules: function (popup, menuKey, options, list) {
		if (!list.length) {
			return 0;
		}
		var hiddenCount = 0;
		var children = Array.prototype.slice.call(popup.children);
		for (var i = 0; i < children.length; i++) {
			var el = children[i];
			if (el.tagName.toLowerCase() === "menuseparator" || el.id === this.GROUP_ID) {
				continue;
			}
			var keys = this.getKeys(el, options);
			for (var k = 0; k < keys.length; k++) {
				if (list.indexOf(keys[k]) !== -1) {
					this.hide(el);
					hiddenCount++;
					break;
				}
			}
		}
		return hiddenCount;
	},

	cleanupSeparators: function (popup) {
		var kids = Array.prototype.slice.call(popup.children);
		var visible = kids.filter(function (el) {
			return el.getAttribute("hidden") !== "true";
		});
		var prevWasSeparator = false;
		for (var i = 0; i < visible.length; i++) {
			var el = visible[i];
			var isSeparator = el.tagName.toLowerCase() === "menuseparator";
			if (isSeparator) {
				if (i === 0 || i === visible.length - 1 || prevWasSeparator) {
					this.hide(el);
				}
				prevWasSeparator = true;
			}
			else {
				prevWasSeparator = false;
			}
		}
	},

	// ----------------------------------------------------------- grouping

	firstMenupopup: function (el) {
		for (var i = 0; i < el.children.length; i++) {
			if (el.children[i].tagName.toLowerCase() === "menupopup") {
				return el.children[i];
			}
		}
		return null;
	},

	findGroupContainer: function (popup) {
		for (var i = 0; i < popup.children.length; i++) {
			if (popup.children[i].id === this.GROUP_ID) {
				return popup.children[i];
			}
		}
		return null;
	},

	isOverflowGroup: function (el) {
		return !!(el.classList && el.classList.contains("zotero-custom-menu-group-submenu"));
	},

	// Undo a previous grouping: return persistent (legacy) nodes to the popup,
	// drop stale MenuManager nodes, remove the generated container.
	dismantleGroup: function (popup) {
		var container = this.findGroupContainer(popup);
		if (!container) {
			return;
		}

		var restorable = [];
		var containerPopup = this.firstMenupopup(container);
		if (containerPopup) {
			var nodes = Array.prototype.slice.call(containerPopup.children);
			for (var i = 0; i < nodes.length; i++) {
				var node = nodes[i];
				var tag = node.tagName.toLowerCase();
				if (tag === "menuseparator") {
					node.remove();
					continue;
				}
				if (node.classList && node.classList.contains(this.GROUP_MENU_CLASS)) {
					var subPopup = this.firstMenupopup(node);
					if (subPopup) {
						var subs = Array.prototype.slice.call(subPopup.children);
						for (var k = 0; k < subs.length; k++) {
							if (subs[k].tagName.toLowerCase() === "menuseparator") {
								subs[k].remove();
							}
							else {
								restorable.push(subs[k]);
							}
						}
					}
					node.remove();
					continue;
				}
				restorable.push(node);
			}
		}

		container.remove();

		for (var r = 0; r < restorable.length; r++) {
			var el = restorable[r];
			if (this.isPluginItem(el)) {
				// MenuManager rebuilds its items on every show; these are stale.
				el.remove();
			}
			else {
				popup.appendChild(el);
			}
		}
	},

	buildGroup: function (popup, menuKey) {
		var options = this.getMenuManagerOptions();
		var overrides = this.getNativeOverrides();
		var legacyMap = this.getLegacyGroups();
		var minGroupSize = this.getMinGroupSize();
		var hiddenList = this.getContextHidden(menuKey);

		var pluginItems = [];
		var overflowToRemove = [];
		var kids = Array.prototype.slice.call(popup.children);

		for (var i = 0; i < kids.length; i++) {
			var el = kids[i];
			var tag = el.tagName.toLowerCase();
			if (tag === "menuseparator" || el.id === this.GROUP_ID) {
				continue;
			}
			if (this.isOverflowGroup(el)) {
				var overflowPopup = this.firstMenupopup(el);
				if (overflowPopup) {
					var overflowItems = Array.prototype.slice.call(overflowPopup.children);
					for (var j = 0; j < overflowItems.length; j++) {
						if (overflowItems[j].tagName.toLowerCase() !== "menuseparator") {
							pluginItems.push(overflowItems[j]);
						}
					}
				}
				overflowToRemove.push(el);
				continue;
			}
			if (this.isNativeContextItem(el, menuKey, overrides)) {
				continue;
			}
			pluginItems.push(el);
		}

		for (var o = 0; o < overflowToRemove.length; o++) {
			overflowToRemove[o].remove();
		}

		var groups = new Map();
		for (var p = 0; p < pluginItems.length; p++) {
			var item = pluginItems[p];
			if (item.getAttribute("hidden") === "true") {
				continue;
			}
			var itemKeys = this.getKeys(item, options);
			var isHidden = false;
			for (var h = 0; h < hiddenList.length; h++) {
				if (itemKeys.indexOf(hiddenList[h]) !== -1) {
					isHidden = true;
					break;
				}
			}
			if (isHidden) {
				this.hide(item);
				continue;
			}
			var owner = this.getOwner(item, options, legacyMap);
			if (!groups.has(owner.key)) {
				groups.set(owner.key, { label: owner.label, items: [] });
			}
			groups.get(owner.key).items.push(item);
		}

		if (!groups.size) {
			return 0;
		}

		var doc = popup.ownerDocument;
		var container = doc.createXULElement("menu");
		container.id = this.GROUP_ID;
		container.setAttribute("label", this.getGroupLabel());
		container.classList.add("menu-iconic");

		var containerPopup = doc.createXULElement("menupopup");
		containerPopup.id = this.GROUP_ID + "-popup";
		container.appendChild(containerPopup);

		var index = 0;
		groups.forEach(function (group) {
			if (index > 0) {
				containerPopup.appendChild(doc.createXULElement("menuseparator"));
			}
			if (group.items.length >= minGroupSize) {
				var subMenu = doc.createXULElement("menu");
				subMenu.classList.add(MenuHider.GROUP_MENU_CLASS);
				subMenu.setAttribute("label", group.label);
				var subPopup = doc.createXULElement("menupopup");
				subMenu.appendChild(subPopup);
				for (var i = 0; i < group.items.length; i++) {
					subPopup.appendChild(group.items[i]);
				}
				containerPopup.appendChild(subMenu);
			}
			else {
				for (var i = 0; i < group.items.length; i++) {
					containerPopup.appendChild(group.items[i]);
				}
			}
			index++;
		});

		popup.appendChild(container);
		return pluginItems.length;
	},

	// -------------------------------------------------------------- events

	// Some plugins reset `hidden` in their own popupshowing handlers, which can
	// run after ours (registration order). Re-apply once the event has settled.
	enforceLate: function (popup, menuKey) {
		var options = this.getMenuManagerOptions();
		var hiddenList = this.getContextHidden(menuKey);
		var rules = this.getRules();
		var list = [].concat(rules["*"] || [], rules[menuKey] || []);
		var overrides = this.getNativeOverrides();
		var children = Array.prototype.slice.call(popup.children);
		var count = 0;
		for (var i = 0; i < children.length; i++) {
			var el = children[i];
			if (el.tagName.toLowerCase() === "menuseparator" || el.id === this.GROUP_ID) {
				continue;
			}
			if (this.isNativeContextItem(el, menuKey, overrides)) {
				continue;
			}
			var keys = this.getKeys(el, options);
			var hide = false;
			for (var k = 0; k < keys.length; k++) {
				if (hiddenList.indexOf(keys[k]) !== -1 || list.indexOf(keys[k]) !== -1) {
					hide = true;
					break;
				}
			}
			if (hide && el.getAttribute("hidden") !== "true") {
				this.hide(el);
				count++;
			}
		}
		return count;
	},

	scheduleLateEnforce: function (popup, menuKey) {
		var self = this;
		var run = function () {
			try {
				if (!popup || !popup.isConnected) {
					return;
				}
				if (popup.state && popup.state !== "showing" && popup.state !== "open") {
					return;
				}
				self.enforceLate(popup, menuKey);
			}
			catch (e) {}
		};
		setTimeout(run, 0);
		setTimeout(run, 60);
	},

	onPopupShowing: function (event) {
		var popup = event.target;
		if (!popup || !popup.id || !MenuHider.MENU_IDS[popup.id]) {
			return;
		}

		try {
			var menuKey = MenuHider.MENU_IDS[popup.id];
			var isContext = !!MenuHider.CONTEXT_KEYS[menuKey];

			if (isContext) {
				// Put legacy nodes back at the root before re-evaluating them.
				MenuHider.dismantleGroup(popup);
			}

			MenuHider.restoreHidden(popup);

			var rules = MenuHider.getRules();
			var list = [].concat(rules["*"] || [], rules[menuKey] || []);
			var options = MenuHider.getMenuManagerOptions();
			var hiddenCount = MenuHider.applyShowWhitelist(popup, menuKey, options);
			hiddenCount += MenuHider.applyHideRules(popup, menuKey, options, list);

			var groupedCount = 0;
			if (isContext && MenuHider.groupEnabled()) {
				groupedCount = MenuHider.buildGroup(popup, menuKey);
			}

			MenuHider.cleanupSeparators(popup);

			if (isContext) {
				MenuHider.scheduleLateEnforce(popup, menuKey);
			}

			if (MenuHider.scanEnabled()) {
				MenuHider.writeInventory(popup, menuKey, options, hiddenCount, groupedCount).catch(function (e) {
					MenuHider.log("inventory promise rejected: " + e);
				});
			}
		}
		catch (e) {
			MenuHider.log("onPopupShowing error: " + e);
		}
	},

	// ----------------------------------------------------------- inventory

	describe: function (el, options, group, index) {
		return {
			index: index,
			group: group || "",
			tag: el.tagName.toLowerCase(),
			id: el.id || "",
			l10n: el.getAttribute("data-l10n-id") || "",
			label: el.getAttribute("label") || "",
			pluginID: this.isPluginItem(el) ? this.getPluginIDForElement(el, options) : "",
			class: el.getAttribute("class") || "",
			hidden: el.getAttribute("hidden") === "true",
			hiddenBy: el.getAttribute("data-menuhider-hidden") === "1" ? "menuhider" : ""
		};
	},

	buildInventory: function (popup, options) {
		var items = [];
		var kids = Array.prototype.slice.call(popup.children);
		for (var i = 0; i < kids.length; i++) {
			var el = kids[i];
			if (el.id === this.GROUP_ID) {
				items.push(this.describe(el, options, "container", i));
				var cp = this.firstMenupopup(el);
				if (cp) {
					var ns = Array.prototype.slice.call(cp.children);
					for (var j = 0; j < ns.length; j++) {
						var node = ns[j];
						if (node.tagName.toLowerCase() === "menuseparator") {
							items.push(this.describe(node, options, "container", j));
							continue;
						}
						if (node.classList && node.classList.contains(this.GROUP_MENU_CLASS)) {
							items.push(this.describe(node, options, "subgroup", j));
							var sp = this.firstMenupopup(node);
							if (sp) {
								var ss = Array.prototype.slice.call(sp.children);
								for (var k = 0; k < ss.length; k++) {
									items.push(this.describe(ss[k], options, node.getAttribute("label"), k));
								}
							}
						}
						else {
							items.push(this.describe(node, options, "container", j));
						}
					}
				}
				continue;
			}
			items.push(this.describe(el, options, "", i));
		}
		return items;
	},

	writeInventory: async function (popup, menuKey, options, hiddenCount, groupedCount) {
		try {
			var sep = Zotero.isWin ? "\\" : "/";
			var path = Zotero.DataDirectory.dir + sep + "menuhider-inventory.json";

			var data = null;
			try {
				var existing = await Zotero.File.getContentsAsync(path);
				data = JSON.parse(existing);
			}
			catch (e) {
				data = null;
			}
			if (!data || typeof data !== "object") {
				data = {};
			}

			data.zoteroVersion = Zotero.version;
			data.updatedAt = new Date().toISOString();
			data.rules = this.getRules();
			data.group = {
				enabled: this.groupEnabled(),
				label: this.getGroupLabel()
			};
			data.menus = data.menus || {};
			data.menus[menuKey] = {
				writtenAt: new Date().toISOString(),
				hiddenCount: hiddenCount,
				groupedCount: groupedCount,
				items: this.buildInventory(popup, options)
			};

			Zotero.File.putContentsAsync(path, JSON.stringify(data, null, 2));
			this.log("inventory written: " + path + " (" + menuKey + ", hidden=" + hiddenCount + ", grouped=" + groupedCount + ")");
		}
		catch (e) {
			this.log("writeInventory failed: " + e);
		}
	},

	// -------------------------------------------------------------- window

	registerWindow: function (win) {
		if (!win || this.handlers.has(win)) {
			return;
		}
		var self = this;
		var handler = function (event) {
			self.onPopupShowing(event);
		};
		var ids = Object.keys(this.MENU_IDS);
		for (var i = 0; i < ids.length; i++) {
			var el = win.document.getElementById(ids[i]);
			if (el) {
				el.addEventListener("popupshowing", handler);
			}
		}
		this.handlers.set(win, handler);
		this.log("window registered");
	},

	unregisterWindow: function (win) {
		var handler = this.handlers.get(win);
		if (!handler) {
			return;
		}
		var ids = Object.keys(this.MENU_IDS);
		for (var i = 0; i < ids.length; i++) {
			var el = win.document.getElementById(ids[i]);
			if (el) {
				try {
					this.restoreHidden(el);
					this.dismantleGroup(el);
				}
				catch (e) {}
				el.removeEventListener("popupshowing", handler);
			}
		}
		this.handlers.delete(win);
	},

	loadPluginNames: function () {
		var self = this;
		try {
			var { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
			AddonManager.getActiveAddons(["extension"]).then(function ({ addons }) {
				for (var i = 0; i < addons.length; i++) {
					if (addons[i].id && addons[i].name) {
						self.pluginNames.set(addons[i].id, addons[i].name);
					}
				}
				self.log("plugin names loaded: " + self.pluginNames.size);
			}).catch(function (e) {
				self.log("loadPluginNames failed: " + e);
			});
		}
		catch (e) {
			this.log("AddonManager unavailable: " + e);
		}
	},

	registerPrefsPane: function () {
		if (!this.rootURI) {
			return;
		}
		try {
			if (!Zotero.PreferencePanes) {
				return;
			}
			var self = this;
			Zotero.PreferencePanes.register({
				pluginID: "menuhider@jikuixie.local",
				src: this.rootURI + "content/preferences.xhtml",
				label: "Hide Manage",
				image: this.rootURI + "content/icon.svg",
				scripts: [this.rootURI + "content/preferences.js"]
			}).catch(function (e) {
				self.log("prefs pane registration failed: " + e);
			});
		}
		catch (e) {
			this.log("registerPrefsPane failed: " + e);
		}
	},

	exposeAPI: function () {
		try {
			Zotero.MenuHider = {
				isNativeMenubarItem: function (el, menuKey) {
					return MenuHider.isNativeMenubarItem(el, menuKey, MenuHider.getNativeOverrides());
				},
				isNativeContextItem: function (el, menuKey) {
					return MenuHider.isNativeContextItem(el, menuKey, MenuHider.getNativeOverrides());
				},
				getKeys: function (el) {
					return MenuHider.getKeys(el, MenuHider.getMenuManagerOptions());
				}
			};
		}
		catch (e) {
			this.log("exposeAPI failed: " + e);
		}
	},

	startup: function (data) {
		this.log("startup");
		this.rootURI = data && data.rootURI ? data.rootURI : "";
		this.loadPluginNames();
		this.registerPrefsPane();
		this.exposeAPI();
		var wins = Zotero.getMainWindows();
		for (var i = 0; i < wins.length; i++) {
			this.registerWindow(wins[i]);
		}
	},

	shutdown: function () {
		this.log("shutdown");
		try {
			delete Zotero.MenuHider;
		}
		catch (e) {}
		var wins = Array.from(this.handlers.keys());
		for (var i = 0; i < wins.length; i++) {
			this.unregisterWindow(wins[i]);
		}
	}
};


function install(data, reason) {}

function uninstall(data, reason) {}

function startup(data, reason) {
	MenuHider.startup(data);
}

function shutdown(data, reason) {
	MenuHider.shutdown();
}

function onMainWindowLoad({ window }) {
	MenuHider.registerWindow(window);
}

function onMainWindowUnload({ window }) {
	MenuHider.unregisterWindow(window);
}
