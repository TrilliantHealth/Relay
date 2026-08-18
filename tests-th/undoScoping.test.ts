/**
 * Remote changes must not enter the local editor's undo history.
 *
 * The bug these cover: Relay dispatched a collaborator's incoming change with
 * only `ySyncAnnotation`, which stops HSM re-capture but says nothing to
 * CodeMirror's history extension. The change therefore joined the local undo
 * stack and Ctrl+Z reverted the collaborator's work.
 */

import { EditorState, Transaction } from "@codemirror/state";
import {
	syncDispatchAnnotations,
	ySyncAnnotation,
} from "../src/merge-hsm/integration/annotations";

/** Reads annotations back off a real transaction rather than the spec array. */
function annotationsOf(scopeUndo: boolean) {
	const state = EditorState.create({ doc: "hello" });
	const tr = state.update({
		changes: { from: 5, insert: " world" },
		annotations: syncDispatchAnnotations("view-sentinel", scopeUndo),
	});
	return {
		addToHistory: tr.annotation(Transaction.addToHistory),
		remote: tr.annotation(Transaction.remote),
		ySync: tr.annotation(ySyncAnnotation),
	};
}

test("scoped dispatch keeps the change out of the undo history", () => {
	expect(annotationsOf(true).addToHistory).toBe(false);
});

test("scoped dispatch marks the change as authored by another actor", () => {
	expect(annotationsOf(true).remote).toBe(true);
});

test("scoped dispatch still carries ySyncAnnotation, so the HSM skips re-capture", () => {
	expect(annotationsOf(true).ySync).toBe("view-sentinel");
});

test("unscoped dispatch leaves history untouched, preserving prior behavior", () => {
	const { addToHistory, remote } = annotationsOf(false);
	expect(addToHistory).toBeUndefined();
	expect(remote).toBeUndefined();
});

test("unscoped dispatch still carries ySyncAnnotation", () => {
	expect(annotationsOf(false).ySync).toBe("view-sentinel");
});

test("the local user's own typing stays undoable", () => {
	// Regression guard for the distinction the fix turns on: pre-bind input
	// replay dispatches with userEvent input.type and must NOT be suppressed,
	// or the user loses the ability to undo what they themselves just typed.
	const state = EditorState.create({ doc: "hello" });
	const tr = state.update({
		changes: { from: 5, insert: "!" },
		annotations: Transaction.userEvent.of("input.type"),
	});
	expect(tr.annotation(Transaction.addToHistory)).toBeUndefined();
	expect(tr.annotation(Transaction.remote)).toBeUndefined();
});
