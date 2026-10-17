# Saved page — incremental update

Based only on the supplied 10.9with_Login project. Existing styling, demo login, route data and ride flow are preserved.

## Use
1. Open dist/index.html through VS Code Live Server, as before.
2. Choose a supported destination and tap Save destination (also available on route comparison).
3. Open Saved beside MVP. Tap a saved place to go directly to route comparison.
4. Choose safety-focused, quick or scenic as usual. Existing preference filters still apply.

Labels such as Uni or Work are optional. Remove supports Undo. Saving the same destination twice does not create duplicates. A saved place stores the destination, not a fixed route.

Saved places persist in localStorage, separately for each existing demo account and for guests. There is no server or cross-device synchronisation. Only the existing City Hall, UQ and South Bank destinations are supported. No new geocoding or arbitrary-address routing is implied. Saved navigation is unavailable during riding.

## Code
- dist/saved.js and dist/saved.css: new page interactions, persistence and layout.
- dist/index.html: parallel MVP/Saved navigation, list, label dialog and save buttons.
- dist/core.js, planner.js and auth.js: small state-change events to keep Saved in sync.
- dist/hazards.js: allow the shared Undo button to undo a saved-place removal; existing report undo preserved.
- tests.cjs: extended integration coverage.

## Checks
Existing route tests and new Saved checks passed: duplicate prevention, labels and escaping, removal/undo, account separation, direct comparison, and ride navigation guard. Chromium desktop and mobile checks passed for save, refresh persistence, label editing, saved-to-comparison and scenic selection, with no JavaScript errors. Mobile Saved has no horizontal overflow at 390px.
