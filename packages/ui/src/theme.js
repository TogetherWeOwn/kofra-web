// Kofra theme switch: the only script the marketing site ships.
// Load it in <head> without defer or async: it sets data-theme on <html> before
// the first paint (no flash), then wires every [data-theme-toggle] button.
// Order: the visitor's saved choice, else the system setting. Without script,
// tokens.css follows the system setting and the toggle stays hidden.
(function () {
	var KEY = 'kofra-theme';
	var root = document.documentElement;
	var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
	/** The choice made on this page, kept even when storage is blocked. @type {'light' | 'dark' | null} */
	var chosen = null;

	function saved() {
		try {
			var v = window.localStorage.getItem(KEY);
			return v === 'light' || v === 'dark' ? v : chosen;
		} catch {
			return chosen; // storage blocked: only this page's choice counts
		}
	}
	function system() {
		return media && media.matches ? 'dark' : 'light';
	}
	/** @param {'light' | 'dark'} theme */
	function apply(theme) {
		root.setAttribute('data-theme', theme);
		var buttons = document.querySelectorAll('[data-theme-toggle]');
		buttons.forEach(function (button) {
			button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
		});
	}

	apply(saved() || system());
	root.classList.add('js');

	if (media && media.addEventListener) {
		media.addEventListener('change', function () {
			if (!saved()) apply(system());
		});
	}
	document.addEventListener('DOMContentLoaded', function () {
		apply(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
	});
	// Another tab changed the choice, or the page came back from the back-forward cache.
	window.addEventListener('storage', function (event) {
		if (event.key !== KEY && event.key !== null) return;
		// The other tab's choice (or its clearing of storage) replaces this page's own choice.
		chosen = null;
		apply(saved() || system());
	});
	window.addEventListener('pageshow', function (event) {
		if (event.persisted) apply(saved() || system());
	});
	document.addEventListener('click', function (event) {
		var target = event.target;
		var button = target instanceof Element ? target.closest('[data-theme-toggle]') : null;
		if (!button) return;
		/** @type {'light' | 'dark'} */
		var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
		chosen = next;
		try {
			window.localStorage.setItem(KEY, next);
		} catch {
			// storage blocked: the choice lasts until the page is left
		}
		apply(next);
	});
})();
