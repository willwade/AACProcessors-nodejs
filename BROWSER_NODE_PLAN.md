Project plan: dual Node + browser support

- Define scope and guarantees (done: scope captured, Node + browser targets listed)
- Support fully in Node and browser: OPML, DOT, ApplePanels, AstericsGrid, OBF/OBZ, Gridset (including Gridsetx where possible without sqlite)
- Defer sqlite-backed formats (Snap, TouchChat) but design adapters so they can be added later with a wasm sqlite implementation
- Keep tests green throughout; adjust/add tests only when necessary to cover new browser pathways

- Create explicit platform entrypoints and exports (done)
- Add `src/index.node.ts` (current behavior) and `src/index.browser.ts` (browser-safe exports only) (done)
- Update `package.json` exports with `node` and `browser` conditions and ensure typings map correctly (done)
- Ensure no top-level Node-only imports in browser entrypoints (done for entrypoints; still to audit processor imports used by browser build)

- Refactor IO boundaries to enable browser inputs (in progress)
- Update processors to accept `string | Buffer | ArrayBuffer | Uint8Array` and only use `fs/path` for string paths (done for most processors; Gridset/Snap/TouchChat still rely on Node fs/sqlite)
- Add tiny IO helpers for reading text/binary from buffers and browser objects (done)
- Move Node-only code paths behind internal adapter functions (partially done; remaining zip/sqlite helpers still import Node-only libs)

- Migrate ZIP usage to JSZip
- Replace `adm-zip` (and other zip readers) with `jszip` in OBF/OBZ and Gridset workflows
- Ensure Node and browser both use the same zip abstraction
- Update tests and fixtures to validate zip handling in both environments

- Make Gridset browser-compatible (non-sqlite first)
- Re-evaluate Gridsetx split: crypto requirements may be manageable in browser (confirm before splitting adapters)
- Keep non-sqlite Gridset parsing in core path that works in browser
- Add a placeholder interface for sqlite-backed features to enable future wasm integration

- Validate browser-safe processors and validators
- Ensure OPML, DOT, ApplePanels, AstericsGrid, OBF/OBZ, Gridset processing works in both environments
- Keep validators Node-only unless explicitly needed in browser; document any gaps (Gridset/Snap validators now use JSZip)

- Update example scripts and docs
- Migrate `scripts/*` to use new entrypoints and buffer-based IO where possible
- Add browser usage examples (e.g., File/Blob inputs) and Node usage examples (paths)

- Testing and CI
- Run existing test suite after each phase; fix regressions immediately
- Add targeted tests for browser code paths (buffer/ArrayBuffer inputs and zip handling)

New considerations:
- Browser entrypoint should avoid exporting processors that still import Node-only dependencies at the module top level (Gridset/Snap/TouchChat/Excel).
- Browser usage for OBF/OBZ and Gridset requires JSZip or a shared zip abstraction (current OBF still relies on adm-zip).
- Validators currently depend on fs/path; decide whether to keep them Node-only or add buffer-based validators for browser usage.
