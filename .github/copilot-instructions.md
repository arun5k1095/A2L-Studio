# A2L Studio Repository Conventions

## Implementation

- Use the existing React 19, TypeScript, Vite, Chevrotain, and CodeMirror stack. Keep business rules in `src/a2l.ts` and file/encoding operations in `src/files.ts`, independently testable from React.
- `src/App.tsx` owns per-document source, filters, selection, view, and undo/redo state; `src/parser.worker.ts` handles parsing. Preserve tab isolation and the 20-entry undo history limit.
- Preserve source text around exact token edits, encoding/BOM and newline behavior, unknown/vendor blocks, and include directives. Do not silently rewrite references or expand/fetch includes.
- Keep source editing unrestricted by property-field coverage. CodeMirror uses C-like highlighting, not a full A2L language service.
- Maintain the compact responsive workbench, accessible labeled controls, lucide-react icons, scrollable Properties/Structure inspector, Details disclosure, and desktop inspector width toggle. Follow existing CSS conventions.
- Bundle fonts locally; do not introduce external runtime font requests, file uploads, backend dependencies, persistence, or telemetry without an explicit requirement.
- Validate untrusted input: `.a2l`/`.aml`, up to 12 files per open operation, 50 MiB per file. Downloads must leave original disk files unchanged. Preserve dirty-close guards and explicit UTF-8 export.

## Verification and Safety

- Use Node.js LTS >=22.12 and `npm ci`; retain the committed lockfile. Scripts bind dev/preview to loopback. On Windows use `npm.cmd`/`npx.cmd` if PowerShell blocks script shims; never change execution policy as a workaround.
- Run focused tests for changed behavior, then relevant broader checks: `npm test` (964-test baseline), `npm run build`, and browser tests when UI behavior changes.
- Browser setup: `npx playwright install chromium`; run `npm run test:e2e` or optional `npm run test:e2e:ui`. The suite defines 24 cases across Chromium desktop/mobile emulation; report observed results, not assumed passes.
- Layout screenshots are repeatable outputs under `test-results/`, not committed visual baselines. Use the existing Playwright configuration and synthetic, deterministic fixtures; never add proprietary calibration data or secrets.
- Keep diagnostics scoped to structural checks. Never claim complete semantic validation, full ASAM certification, automatic reference repair, universal vendor compatibility, or enterprise-scale certification from the file cap.
- Serve production `dist/` over HTTPS with modern browser/worker support; use localhost for development, not `file://`. State browser/security-policy limitations accurately.
- Keep changes focused, preserve user edits, and update the README when behavior or setup changes. Do not report test/build success without executing the relevant command.

## Completed Project Setup

- [x] React/TypeScript/Vite frontend and static build pipeline implemented.
- [x] Synthetic demo opens on startup; multi-file tabs and independent editing/filter history implemented.
- [x] Explorer, raw source editor, token property edits, structural diagnostics, and guarded tab closing implemented.
- [x] Encoding-preserving Save copy, explicit UTF-8 downloads, local bundled fonts, and worker parsing implemented.
- [x] Unit/generated tests and Chromium desktop/mobile browser suites configured.
- [x] Compact-layout screenshots, accessibility checks, and local build/preview commands configured.

This checklist records implemented setup, not a certification or assertion that the latest test run passed. Documents remain memory-only; includes are preserved, not expanded.