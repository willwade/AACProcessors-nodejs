Project plan: dual Node + browser support

- Define scope and guarantees
- Support fully in Node and browser: OPML, DOT, ApplePanels, AstericsGrid, OBF/OBZ, Gridset (including Gridsetx where possible without sqlite)
- Defer sqlite-backed formats (Snap, TouchChat) but design adapters so they can be added later with a wasm sqlite implementation
- Keep tests green throughout; adjust/add tests only when necessary to cover new browser pathways

- Create explicit platform entrypoints and exports
- Add `src/index.node.ts` (current behavior) and `src/index.browser.ts` (browser-safe exports only)
- Update `package.json` exports with `node` and `browser` conditions and ensure typings map correctly
- Ensure no top-level Node-only imports in browser entrypoints

- Refactor IO boundaries to enable browser inputs
- Update processors to accept `string | Buffer | ArrayBuffer | Uint8Array` and only use `fs/path` for string paths
- Add tiny IO helpers for reading text/binary from buffers and browser objects
- Move Node-only code paths behind internal adapter functions

- Migrate ZIP usage to JSZip
- Replace `adm-zip` (and other zip readers) with `jszip` in OBF/OBZ and Gridset workflows
- Ensure Node and browser both use the same zip abstraction
- Update tests and fixtures to validate zip handling in both environments

- Make Gridset browser-compatible (non-sqlite first)
- Split Gridsetx sqlite features into a separate adapter/module
- Keep non-sqlite Gridset parsing in core path that works in browser
- Add a placeholder interface for sqlite-backed features to enable future wasm integration

- Validate browser-safe processors and validators
- Ensure OPML, DOT, ApplePanels, AstericsGrid, OBF/OBZ, Gridset processing works in both environments
- Keep validators Node-only unless explicitly needed in browser; document any gaps

- Update example scripts and docs
- Migrate `scripts/*` to use new entrypoints and buffer-based IO where possible
- Add browser usage examples (e.g., File/Blob inputs) and Node usage examples (paths)

- Testing and CI
- Run existing test suite after each phase; fix regressions immediately
- Add targeted tests for browser code paths (buffer/ArrayBuffer inputs and zip handling)
