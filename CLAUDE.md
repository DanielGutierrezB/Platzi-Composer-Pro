# CLAUDE.md — Project State

## What is this?
Platzi Composer Pro is a CEP panel for After Effects used in Platzi video course production. It automates repetitive motion graphics tasks (ease, highlights, zoom, professor camera moves, spell checking).

## Architecture
- **client/** — CEP panel UI (HTML/CSS/JS, runs in embedded Chromium)
- **host/index.jsx** — ExtendScript (ES3) that talks to AE API directly
- **CSXS/manifest.xml** — CEP extension manifest
- **VERSION** — Single source of truth for version number

## Key Technical Notes

### ExtendScript (host/index.jsx)
- ES3 only. No let/const, arrow functions, template literals, or modern JS.
- All functions return `JSON.stringify({success: true})` or `JSON.stringify({error: "msg"})`.
- Helper functions: `_pcRequireComp()`, `_pcRequireSelected()`, `_pcApplyEaseScalar()`, `_pcApplyEaseArray()`.
- For keyframe ease to work: must use `addKey()` + `setValueAtKey()` + `setInterpolationTypeAtKey(BEZIER, BEZIER)` BEFORE applying ease.
- Position is spatial → use `_pcApplyEaseScalar` (counter-intuitive but correct in AE scripting).
- Scale is array → use `_pcApplyEaseArray`.
- Effect Controls: use `addProperty("ADBE Slider Control")` or `"ADBE Color Control"` then link via expressions.
- When using expressions on a property, DO NOT keyframe that property directly — keyframe the slider/control instead.

### CEP Panel (client/)
- Runs in old Chromium (no modern JS features like forEach on NodeList, use for-loops with IIFE).
- Native `title` tooltips DON'T work in CEP → we use CSS `[data-tooltip]:hover::after` pattern.
- Ctrl+Click = right-click on Mac → we use Alt/Option as modifier instead.
- Host script doesn't auto-reload on panel refresh → `init()` calls `$.evalFile()` to force reload.
- Accordion: only one tool-card open at a time (except spellcheck which is independent).

### Versioning
- `VERSION` file at repo root (read by panel and update check).
- Badge in `client/index.html` header.
- `CSXS/manifest.xml` has its own version (sync on major releases).
- Git push to `main` = deploy (panel pulls from GitHub directly).

## Current State (v1.1.0)

### Working ✅
- SpellCheck IA (Ollama, OpenAI, Anthropic, Google)
- Ease application (Apply, Apply on Playhead)
- Quick Scale (+5/10/20%)
- Continuous Zoom
- Stroke Highlighter (2-point path, Trim Paths, Effect Controls)
- Line Highlighter (with Glow toggle, Effect Controls)
- Focus Mask (user draws mask → black solid with SUBTRACT mask, Darkness/Feather controls)
- Zoom Focus (user draws mask → duplicate+mask animates to center, blur on original, Blur Amount/Mask Feather controls)
- Modifier keys (Shift=InOut, Alt=In, Shift+Alt=Out)
- Profesor Views (Mini + Corner merged)
- Zoomer, Solid Creator, Flip Horizontal
- Auto-update via git pull
- Save/Reset defaults (localStorage)
- Custom CSS tooltips
- Action logging to ~/Downloads/

### Known Issues / TODO
- Stroke Highlighter: `createPath()` expression may fail on AE versions < 2019. Falls back to static 400px path.
- Line Highlight: same `createPath()` limitation.
- The `pcHighlighterAnimate` function finds Trim Paths by searching nested groups — fragile if layer structure changes.
- Focus Mask / Zoom Focus: if user has multiple masks, only the first one is used.
- Manifest still uses `com.codigo.aespellcheck` bundle ID (legacy from original SpellCheck-only extension).

### File Sizes
- host/index.jsx: ~1090 lines
- client/js/main.js: ~1134 lines
- client/index.html: ~336 lines
- client/css/styles.css: ~912 lines

## Common Patterns

### Adding a new tool
1. Add ExtendScript function in `host/index.jsx` (follow `pcCreateXxx` pattern)
2. Add HTML section in `client/index.html` (tool-card with header + body)
3. Wire button in `client/js/main.js` bindEvents() or bindToolEvents()
4. Add CSS if needed
5. Bump VERSION, commit, push

### Adding Effect Controls to a tool
```javascript
var fxs = layer.property("Effects");
var ctrl = fxs.addProperty("ADBE Slider Control"); ctrl.name = "MyParam";
ctrl.property("Slider").setValue(defaultValue);
// Link property via expression:
targetProp.expression = "effect(\"MyParam\")(\"Slider\")";
// If animating: keyframe the SLIDER, not the target prop
```

### Applying ease correctly
```javascript
var prop = layer.property("Transform").property("Scale");
var k1 = prop.addKey(t0); prop.setValueAtKey(k1, val0);
var k2 = prop.addKey(t1); prop.setValueAtKey(k2, val1);
prop.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
prop.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
_pcApplyEaseArray(prop, k1, k2, easeOut, easeIn); // for array props (Scale)
_pcApplyEaseScalar(prop, k1, k2, easeOut, easeIn); // for scalar OR spatial (Position, Opacity)
```

## Owner
Daniel Gutiérrez (@DanielGutierrezBo) — Video producer at Platzi.
