/**
 * Undo scoping resolves per relay server, falling back to the vault default.
 *
 * Covers the resolution alone. Its caller, shouldScopeUndoToLocalEdits in
 * editorContext, walks the plugin registry off the editor's info field and cannot
 * be reached from a test: `obsidian` is a runtime module and upstream git-crypts
 * the mocks that would stub it.
 */

import { resolveScopeUndo } from "../src/EditorSettings";

test("a relay's own choice wins over the vault default", () => {
	expect(resolveScopeUndo(true, false)).toBe(true);
	expect(resolveScopeUndo(false, true)).toBe(false);
});

test("an unconfigured relay inherits the vault default", () => {
	expect(resolveScopeUndo(undefined, true)).toBe(true);
	expect(resolveScopeUndo(undefined, false)).toBe(false);
});

test("both unset means unscoped, matching pre-existing behavior", () => {
	expect(resolveScopeUndo(undefined, undefined)).toBe(false);
});

test("a relay opting out is not overridden by a vault default of on", () => {
	// The case the per-relay layer exists for: scoping on everywhere except one
	// collaboration where shared undo is wanted.
	expect(resolveScopeUndo(false, true)).toBe(false);
});
