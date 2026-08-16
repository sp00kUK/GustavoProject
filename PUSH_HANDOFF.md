# Push Handoff

## Outcome

The application now uses the real Vector Magic Desktop engine through a fully
automatic, hidden local workflow. The user sees a monotonic loading bar while
Vector Magic selects Fully Automatic, reviews the result, explicitly chooses
SVG in the native Save dialog, exports, and closes. The exported Vector Magic
SVG is imported as the active pattern.

The bridge prefers the machine-local runtime at:

```text
F:\GustavoProject\vendor\vector-magic\vmde.exe
```

That tree contains 47 files totaling 24,988,890 bytes. It was compared against
`C:\Program Files (x86)\Vector Magic` with SHA-256 hashes and had zero
differences. A native smoke test launched the repo-local executable and produced
a complete 11,228-character SVG with no lingering `vmde.exe` process.

## Important push boundary

Do **not** force-add or push `vendor/vector-magic/`. Its bundled
`license.txt` grants personal, non-transferable use, permits reasonable backup
copies, and restricts copying/distribution of the software. The directory is
therefore intentionally covered by `.gitignore`. `vendor/README.md` is the
tracked setup note.

If the user later supplies explicit redistribution authorization from the
rights holder, handle that as a separate decision. Until then, a normal clone
must use its own licensed local copy via `vendor/vector-magic/`,
`VECTOR_MAGIC_EXE`, or a standard Program Files installation.

The original Program Files tree still existed at final inspection. An attempted
non-elevated move was denied by Windows, so the local repo tree is a verified
copy rather than the only remaining installation.

## Main implementation files

- `server/vectorMagicBridge.ts` — loopback-only Vite bridge, repo-local
  executable discovery, isolated sessions, progress/result/cancel endpoints.
- `scripts/vectorMagicAutomation.ps1` — hidden Win32/Qt wizard and native Save
  dialog automation.
- `src/pattern/vectorMagicDesktop.ts` — browser transport, polling, and
  cancellation client.
- `src/components/PatternSection.tsx` — one-click automatic flow and progress
  bar.
- `src/pattern/loaders.ts`, `src/pattern/types.ts`, persistence and worker files
  — preserve original bitmap bytes and pattern kind through the pipeline.
- `src/pattern/vectorizer.ts` — deleted; the substitute in-browser tracer is no
  longer used.
- `tests/vectorMagicBridge.test.ts` — executable discovery, security, input,
  filename, and progress parsing coverage.
- `docs/VECTORIZER_HANDOFF.md` — detailed architecture and operating contract.

## Verification

The completed implementation has passed:

```text
npm run typecheck
npm test                 72/72 tests
npm run fixtures         9/9 fixtures
npm run build
PowerShell parser check
git diff --check
native repo-local SVG smoke test
```

The Vite chunk-size warning is informational and pre-existing in nature; the
build succeeds.

## Push checklist

1. Review the full dirty worktree; all current changes belong to this feature.
2. Confirm `vendor/vector-magic/` remains ignored and absent from the staged
   file list. Never use `git add -f` on it.
3. Include `.gitignore`, `vendor/README.md`, this handoff, the bridge/helper,
   UI/client updates, tests, docs, and deletion of `src/pattern/vectorizer.ts`.
4. Re-run the four npm checks above if anything changes.
5. Commit and push through the normal repository workflow. No commit or push
   has been performed by this agent.

The dev server is expected at `http://localhost:5173/`; availability should
report the repo-local `vendor/vector-magic/vmde.exe` on this machine.
