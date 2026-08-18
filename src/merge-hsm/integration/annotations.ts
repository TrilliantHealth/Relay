/**
 * Shared CodeMirror annotations for HSM/CRDT integration.
 *
 * These annotations are used to mark editor dispatches that originate from
 * the sync system (HSM, Yjs) to prevent feedback loops.
 */

import { Annotation, Transaction, type TransactionSpec } from "@codemirror/state";

/**
 * Annotation used to mark editor changes that originate from Yjs/HSM sync.
 * When this annotation is present on a transaction, the HSM should NOT
 * capture those changes (they already came from the CRDT).
 *
 * Usage:
 * - When dispatching changes TO the editor (CRDT → editor):
 *   editor.dispatch({ changes, annotations: [ySyncAnnotation.of(editor)] })
 *
 * - When receiving editor changes (editor → CRDT):
 *   if (transaction.annotation(ySyncAnnotation)) return; // Skip, from sync
 */
export const ySyncAnnotation = Annotation.define<unknown>();

/**
 * Annotations for a CRDT -> editor dispatch.
 *
 * `ySyncAnnotation` only stops the change from being re-captured by the HSM; it
 * carries no meaning for CodeMirror's history extension. Without
 * `Transaction.addToHistory: false`, a change authored by a collaborator lands in
 * this editor's undo stack, and the next Ctrl+Z reverts their edit rather than
 * anything the local user typed.
 *
 * `Transaction.remote` is CodeMirror's own marker for "another actor made this
 * change"; extensions consult it to avoid treating a peer's edit as local input.
 *
 * When `scopeUndo` is false the dispatch keeps the historical behavior, where
 * undo reaches every change visible in the buffer regardless of who wrote it.
 * The caller resolves that flag per relay server; see resolveScopeUndo.
 */
export function syncDispatchAnnotations(
	view: unknown,
	scopeUndo: boolean,
): TransactionSpec["annotations"] {
	if (!scopeUndo) return [ySyncAnnotation.of(view)];

	return [
		ySyncAnnotation.of(view),
		Transaction.addToHistory.of(false),
		Transaction.remote.of(true),
	];
}
