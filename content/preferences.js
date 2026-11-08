(function () {
	"use strict";

	const MENUS = [
		{ key: "file", popup: "menu_FilePopup", label: "File" },
		{ key: "edit", popup: "menu_EditPopup", label: "Edit" },
		{ key: "view", popup: "menu_viewPopup", label: "View" },
		{ key: "tools", popup: "menu_ToolsPopup", label: "Tools" },
		{ key: "help", popup: "menu_HelpPopup", label: "Help" }
	];

	const CONTEXT_MENUS = [
		{ key: "item", popup: "zotero-itemmenu", target: "main/library/item", label: "Item" },
		{ key: "collection", popup: "zotero-collectionmenu", target: "main/library/collection", label: "Collection" }
	];

	const CATEGORIES = [
		{ key: "system", label: "System Manage" },
		{ key: "context", label: "Context Menu" }
	];

	const state = {
		category: "system",
		active: "file",
		catalog: {},
		show: readShow(),
		contextActive: "item",
		contextCatalog: {},
		contextHidden: readContextHidden()
	};

	function readShow() {
		try {
			const raw = Zotero.Prefs.get("menuhider.show");
			const parsed = raw ? JSON.parse(raw) : {};
			return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
		}
		catch (e) {
			return {};
		}
	}

	function writeShow(map) {
		Zotero.Prefs.set("menuhider.show", JSON.stringify(map));
	}

	function readContextHidden() {
		try {
			const raw = Zotero.Prefs.get("menuhider.contextHidden");
			const parsed = raw ? JSON.parse(raw) : {};
			return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
		}
		catch (e) {
			return {};
		}
	}

	function writeContextHidden(map) {
		Zotero.Prefs.set("menuhider.contextHidden", JSON.stringify(map));
	}

	function normalizeLabel(label) {
		return String(label || "")
			.replace(/\s+/g, " ")
			.trim()
			.replace(/[…]+/g, "...")
			.replace(/\.\.\.$/, "")
			.trim();
	}

	function elementKey(el) {
		var l10n = el.getAttribute("data-l10n-id") || "";
		var id = el.id || "";
		var label = el.getAttribute("label") || "";
		var key = l10n ? ("l10n:" + l10n)
			: id ? ("id:" + id)
			: (label ? ("label:" + normalizeLabel(label)) : "");
		return { key: key, label: label || l10n || id || key };
	}

	function isNative(el, menuKey) {
		if (Zotero.MenuHider && Zotero.MenuHider.isNativeMenubarItem) {
			try {
				return Zotero.MenuHider.isNativeMenubarItem(el, menuKey);
			}
			catch (e) {
				// fall through
			}
		}
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
		return false;
	}

	function isNativeContext(el, menuKey) {
		if (Zotero.MenuHider && Zotero.MenuHider.isNativeContextItem) {
			try {
				return Zotero.MenuHider.isNativeContextItem(el, menuKey);
			}
			catch (e) {
				// fall through
			}
		}
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
		return false;
	}

	function pluginIDFor(el, options) {
		if (!el.classList) {
			return "";
		}
		for (var i = 0; i < options.length; i++) {
			if (options[i].menuID && el.classList.contains(options[i].menuID)) {
				return options[i].pluginID || "";
			}
		}
		return "";
	}

	function getLegacyGroups() {
		try {
			const raw = Zotero.Prefs.get("menuhider.legacyGroups");
			const parsed = raw ? JSON.parse(raw) : {};
			return (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? parsed : {};
		}
		catch (e) {
			return {};
		}
	}

	function legacyNameFor(el) {
		var groups = getLegacyGroups();
		var ids = [];
		if (el.id) {
			ids.push(el.id);
		}
		var l10n = el.getAttribute("data-l10n-id");
		if (l10n) {
			ids.push(l10n);
		}
		for (var prefix in groups) {
			for (var i = 0; i < ids.length; i++) {
				if (ids[i].indexOf(prefix) === 0) {
					return groups[prefix];
				}
			}
		}
		return "";
	}

	function getMenuManagerOptions() {
		try {
			return Zotero.MenuManager._menuManager.options || [];
		}
		catch (e) {
			return [];
		}
	}

	async function buildCatalog() {
		var options = getMenuManagerOptions();
		var mainWindow = Zotero.getMainWindow();
		var doc = mainWindow ? mainWindow.document : null;
		var catalog = {};

		for (var m = 0; m < MENUS.length; m++) {
			var menu = MENUS[m];
			var items = [];
			var seen = new Set();

			if (doc) {
				var popup = doc.getElementById(menu.popup);
				if (popup) {
					var kids = Array.prototype.slice.call(popup.children);
					for (var i = 0; i < kids.length; i++) {
						var el = kids[i];
						if (el.tagName.toLowerCase() === "menuseparator" || isNative(el, menu.key)) {
							continue;
						}
						var info = elementKey(el);
						if (!info.key || seen.has(info.key)) {
							continue;
						}
						seen.add(info.key);
						var pid = pluginIDFor(el, options);
						items.push({
							key: info.key,
							label: info.label,
							pluginID: pid,
							fallback: pid ? "" : legacyNameFor(el)
						});
					}
				}
			}

			for (var o = 0; o < options.length; o++) {
				var option = options[o];
				if (option.target !== ("main/menubar/" + menu.key)) {
					continue;
				}
				var flat = option.menus || [];
				for (var f = 0; f < flat.length; f++) {
					var md = flat[f];
					if (!md || md.menuType === "separator" || !md.l10nID) {
						continue;
					}
					var rkey = "l10n:" + md.l10nID;
					if (seen.has(rkey)) {
						continue;
					}
					seen.add(rkey);
					var text = md.l10nID;
					if (doc && doc.l10n) {
						try {
							text = await doc.l10n.formatValue(md.l10nID) || md.l10nID;
						}
						catch (e) {}
					}
					items.push({ key: rkey, label: text, pluginID: option.pluginID || "" });
				}
			}

			await attachPluginNames(items);
			catalog[menu.key] = items;
		}

		return catalog;
	}

	async function buildContextCatalog() {
		var options = getMenuManagerOptions();
		var mainWindow = Zotero.getMainWindow();
		var doc = mainWindow ? mainWindow.document : null;
		var catalog = {};

		for (var m = 0; m < CONTEXT_MENUS.length; m++) {
			var menu = CONTEXT_MENUS[m];
			var items = [];
			var seen = new Set();

			var addItem = function (el, groupLabel) {
				if (!el || el.nodeType !== 1) {
					return;
				}
				if (el.tagName.toLowerCase() === "menuseparator" || isNativeContext(el, menu.key)) {
					return;
				}
				var info = elementKey(el);
				if (!info.key || seen.has(info.key)) {
					return;
				}
				seen.add(info.key);
				var pid = pluginIDFor(el, options);
				items.push({
					key: info.key,
					label: info.label,
					pluginID: pid,
					fallback: pid ? "" : legacyNameFor(el),
					group: groupLabel || ""
				});
			};

			var walkGroup = function (container) {
				var containerPopup = null;
				for (var i = 0; i < container.children.length; i++) {
					if (container.children[i].tagName.toLowerCase() === "menupopup") {
						containerPopup = container.children[i];
						break;
					}
				}
				if (!containerPopup) {
					return;
				}
				var nodes = Array.prototype.slice.call(containerPopup.children);
				for (var j = 0; j < nodes.length; j++) {
					var node = nodes[j];
					if (node.tagName.toLowerCase() === "menuseparator") {
						continue;
					}
					if (node.classList && node.classList.contains("menuhider-group-menu")) {
						var subPopup = null;
						for (var s = 0; s < node.children.length; s++) {
							if (node.children[s].tagName.toLowerCase() === "menupopup") {
								subPopup = node.children[s];
								break;
							}
						}
						if (subPopup) {
							var subs = Array.prototype.slice.call(subPopup.children);
							for (var k = 0; k < subs.length; k++) {
								addItem(subs[k], node.getAttribute("label"));
							}
						}
					}
					else {
						addItem(node, "");
					}
				}
			};

			if (doc) {
				var popup = doc.getElementById(menu.popup);
				if (popup) {
					var kids = Array.prototype.slice.call(popup.children);
					for (var i = 0; i < kids.length; i++) {
						if (kids[i].id === "menuhider-group") {
							walkGroup(kids[i]);
						}
						else {
							addItem(kids[i], "");
						}
					}
				}
			}

			for (var o = 0; o < options.length; o++) {
				var option = options[o];
				if (option.target !== menu.target) {
					continue;
				}
				var flat = option.menus || [];
				for (var f = 0; f < flat.length; f++) {
					var md = flat[f];
					if (!md || md.menuType === "separator" || !md.l10nID) {
						continue;
					}
					var rkey = "l10n:" + md.l10nID;
					if (seen.has(rkey)) {
						continue;
					}
					seen.add(rkey);
					var text = md.l10nID;
					if (doc && doc.l10n) {
						try {
							text = await doc.l10n.formatValue(md.l10nID) || md.l10nID;
						}
						catch (e) {}
					}
					items.push({ key: rkey, label: text, pluginID: option.pluginID || "", group: "" });
				}
			}

			await attachPluginNames(items);
			catalog[menu.key] = items;
		}

		return catalog;
	}

	async function attachPluginNames(items) {
		for (var i = 0; i < items.length; i++) {
			if (items[i].pluginID) {
				try {
					items[i].plugin = await Zotero.Plugins.getName(items[i].pluginID);
				}
				catch (e) {
					items[i].plugin = items[i].pluginID.split("@")[0];
				}
			}
			else {
				items[i].plugin = items[i].fallback || "Unknown";
			}
		}
	}

	function el(tag, className, text) {
		var node = document.createElement(tag);
		if (className) {
			node.className = className;
		}
		if (text !== undefined) {
			node.textContent = text;
		}
		return node;
	}

	function renderCategories() {
		var box = document.getElementById("mh-categories");
		box.textContent = "";
		for (var i = 0; i < CATEGORIES.length; i++) {
			(function (cat) {
				var btn = el("button", "mh-category" + (cat.key === state.category ? " active" : ""), cat.label);
				btn.addEventListener("click", function () {
					state.category = cat.key;
					renderCategories();
					renderBody();
				});
				box.appendChild(btn);
			})(CATEGORIES[i]);
		}
	}

	function renderMenuTabs() {
		var tabs = document.getElementById("mh-tabs");
		tabs.textContent = "";
		for (var i = 0; i < MENUS.length; i++) {
			(function (menu) {
				var btn = el("button", "mh-tab" + (menu.key === state.active ? " active" : ""), menu.label);
				btn.addEventListener("click", function () {
					state.active = menu.key;
					renderMenuTabs();
					renderList();
				});
				tabs.appendChild(btn);
			})(MENUS[i]);
		}
	}

	function renderList() {
		var list = document.getElementById("mh-list");
		list.textContent = "";
		var items = state.catalog[state.active] || [];
		var shown = state.show[state.active] || [];

		if (!items.length) {
			list.appendChild(el("div", "mh-empty",
				"No plugin items detected in this menu. Open the menu once, then click Refresh."));
			updateCount();
			return;
		}

		for (var i = 0; i < items.length; i++) {
			(function (item) {
				var row = el("div", "mh-row");
				var cb = document.createElement("input");
				cb.type = "checkbox";
				cb.checked = shown.indexOf(item.key) !== -1;
				cb.addEventListener("change", function () {
					toggle(item.key, cb.checked);
				});
				row.appendChild(cb);
				row.appendChild(el("span", "mh-name", item.label));
				row.appendChild(el("span", "mh-plugin", item.plugin || ""));
				list.appendChild(row);
			})(items[i]);
		}
		updateCount();
	}

	function updateCount() {
		var items = state.catalog[state.active] || [];
		var shown = state.show[state.active] || [];
		var count = 0;
		for (var i = 0; i < items.length; i++) {
			if (shown.indexOf(items[i].key) !== -1) {
				count++;
			}
		}
		var node = document.getElementById("mh-count");
		if (node) {
			node.textContent = count + " of " + items.length + " shown";
		}
	}

	function toggle(key, visible) {
		var list = (state.show[state.active] || []).slice();
		var index = list.indexOf(key);
		if (visible && index === -1) {
			list.push(key);
		}
		else if (!visible && index !== -1) {
			list.splice(index, 1);
		}
		state.show[state.active] = list;
		writeShow(state.show);
		updateCount();
	}

	function setAll(visible) {
		var items = state.catalog[state.active] || [];
		state.show[state.active] = visible ? items.map(function (item) { return item.key; }) : [];
		writeShow(state.show);
		renderList();
	}

	function renderContextTabs() {
		var tabs = document.getElementById("mh-context-tabs");
		tabs.textContent = "";
		for (var i = 0; i < CONTEXT_MENUS.length; i++) {
			(function (menu) {
				var btn = el("button", "mh-tab" + (menu.key === state.contextActive ? " active" : ""), menu.label);
				btn.addEventListener("click", function () {
					state.contextActive = menu.key;
					renderContextTabs();
					renderContextList();
				});
				tabs.appendChild(btn);
			})(CONTEXT_MENUS[i]);
		}
	}

	function renderContextList() {
		var list = document.getElementById("mh-context-list");
		list.textContent = "";
		var items = state.contextCatalog[state.contextActive] || [];
		var hidden = state.contextHidden[state.contextActive] || [];

		if (!items.length) {
			list.appendChild(el("div", "mh-empty",
				"No plugin items detected. Open this menu once, then click Refresh."));
			updateContextCount();
			return;
		}

		for (var i = 0; i < items.length; i++) {
			(function (item) {
				var row = el("div", "mh-row");
				var cb = document.createElement("input");
				cb.type = "checkbox";
				cb.checked = hidden.indexOf(item.key) === -1;
				cb.addEventListener("change", function () {
					toggleContext(item.key, cb.checked);
				});
				row.appendChild(cb);
				row.appendChild(el("span", "mh-name", item.label));
				row.appendChild(el("span", "mh-plugin", item.plugin || ""));
				list.appendChild(row);
			})(items[i]);
		}
		updateContextCount();
	}

	function updateContextCount() {
		var items = state.contextCatalog[state.contextActive] || [];
		var hidden = state.contextHidden[state.contextActive] || [];
		var count = 0;
		for (var i = 0; i < items.length; i++) {
			if (hidden.indexOf(items[i].key) === -1) {
				count++;
			}
		}
		var node = document.getElementById("mh-context-count");
		if (node) {
			node.textContent = count + " of " + items.length + " shown";
		}
	}

	function toggleContext(key, visible) {
		var list = (state.contextHidden[state.contextActive] || []).slice();
		var index = list.indexOf(key);
		if (!visible && index === -1) {
			list.push(key);
		}
		else if (visible && index !== -1) {
			list.splice(index, 1);
		}
		state.contextHidden[state.contextActive] = list;
		writeContextHidden(state.contextHidden);
		updateContextCount();
	}

	function setAllContext(visible) {
		var items = state.contextCatalog[state.contextActive] || [];
		state.contextHidden[state.contextActive] = visible
			? []
			: items.map(function (item) { return item.key; });
		writeContextHidden(state.contextHidden);
		renderContextList();
	}

	function renderBody() {
		var system = document.getElementById("mh-system");
		var context = document.getElementById("mh-context");
		var isSystem = state.category === "system";
		system.hidden = !isSystem;
		context.hidden = isSystem;
		if (isSystem) {
			renderMenuTabs();
			renderList();
		}
		else {
			renderContextTabs();
			renderContextList();
		}
	}

	async function refresh() {
		var list = document.getElementById("mh-list");
		var contextList = document.getElementById("mh-context-list");
		if (!list || !contextList) {
			return;
		}
		list.textContent = "";
		list.appendChild(el("div", "mh-empty", "Scanning…"));
		contextList.textContent = "";
		contextList.appendChild(el("div", "mh-empty", "Scanning…"));

		state.catalog = await buildCatalog();
		state.contextCatalog = await buildContextCatalog();
		state.show = readShow();
		state.contextHidden = readContextHidden();
		renderMenuTabs();
		renderList();
		renderContextTabs();
		renderContextList();
	}

	function init() {
		document.getElementById("mh-show-all").addEventListener("click", function () { setAll(true); });
		document.getElementById("mh-hide-all").addEventListener("click", function () { setAll(false); });
		document.getElementById("mh-refresh").addEventListener("click", function () { refresh(); });
		document.getElementById("mh-context-show-all").addEventListener("click", function () { setAllContext(true); });
		document.getElementById("mh-context-hide-all").addEventListener("click", function () { setAllContext(false); });
		document.getElementById("mh-context-refresh").addEventListener("click", function () { refresh(); });
		renderCategories();
		renderBody();
		refresh();
	}

	function boot(attempt) {
		if (!document.getElementById("mh-categories") || !document.getElementById("mh-context-list")) {
			if ((attempt || 0) < 40) {
				setTimeout(function () { boot((attempt || 0) + 1); }, 50);
			}
			return;
		}
		init();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () { boot(0); }, { once: true });
	}
	else {
		boot(0);
	}
})();
