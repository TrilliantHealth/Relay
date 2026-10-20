"use strict";

import type { LocalMove } from "./PublicAPI";

/**
 * What a shared folder decided about one vault rename: the move this client
 * made, none when the rename moves nothing (no path change, or a shared
 * folder's own rename reaching a descendant), or null when the rename is
 * Relay's own work: a rejection it is restoring, or the echo of a restore or
 * a server move.
 */
export type RenameDecision = LocalMove[] | null;

export function localMoves(
	oldPath: string,
	newPath: string,
	kind: LocalMove["kind"],
): LocalMove[] {
	return [{ oldPath, newPath, kind }];
}

/**
 * A rename between two shared folders is one move, made of a removal from
 * the source and an addition to the destination. It is a local move only
 * when neither half is Relay's own work.
 */
export function crossFolderMoves(
	from: RenameDecision,
	to: RenameDecision,
): LocalMove[] {
	if (from === null || to === null) return [];

	return from.length > 0 ? from : to;
}

/** A vault file or folder, as far as descendant tracking needs it. */
export interface RenamedNode {
	path: string;
	children?: RenamedNode[];
}

/**
 * Descendants of folder renames, awaiting their own vault rename. Obsidian
 * renames a folder first and each descendant afterwards, one callback each;
 * a descendant's move is local exactly when its folder's was.
 */
export type PendingDescendants = Map<RenamedNode, { oldPath: string; local: boolean }>;

/**
 * Record a renamed folder's descendants. Call during the folder's own rename
 * callback, while its descendants still carry their old paths.
 */
export function expectDescendants(
	pending: PendingDescendants,
	folder: RenamedNode,
	local: boolean,
): void {
	for (const child of folder.children ?? []) {
		pending.set(child, { oldPath: child.path, local });
		expectDescendants(pending, child, local);
	}
}

/** Whether a rename belongs to a folder rename and, if so, whether that was local. */
export function takeDescendant(
	pending: PendingDescendants,
	file: RenamedNode,
	oldPath: string,
): boolean | undefined {
	const expected = pending.get(file);
	if (expected?.oldPath !== oldPath) return undefined;

	pending.delete(file);
	return expected.local;
}
