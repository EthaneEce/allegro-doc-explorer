# Allegro Doc Explorer

Static local explorer for Allegro 4.4.3 documentation with:

- indexation of API entries (functions/macros/variables)
- dedicated search by symbol name
- dedicated search by topic/term in function docs
- English/French UI toggle
- pinned functions (favorites) persisted in browser storage
- direct links to original Allegro HTML pages and anchors

## Files

- `index.html`: new explorer UI
- `styles.css`: UI theme and responsive layout
- `app.js`: search logic + language switch + runtime translation helper
- `scripts/build-index.mjs`: parser/index generator from `alleg000.html` ... `alleg048.html`
- `data/index.js`: generated API dataset for UI
- `data/search-index.js`: generated optimized search index
- `upstream-index.html`: original `index.html` from liballeg.org mirror

## Rebuild index

```bash
bun scripts/build-index.mjs
```

Optional metadata translation during build (slower, needs network):

```bash
TRANSLATE_METADATA=1 bun scripts/build-index.mjs
```

## Run locally

```bash
python3 -m http.server 8000
```

Then open: `http://localhost:8000/index.html`
