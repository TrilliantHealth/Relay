/**
 * Editor-behavior settings: local to this vault, never negotiated with peers.
 *
 * Distinct from SyncFlags, which describe what a shared folder syncs and so
 * belong to the folder. These describe how this machine's editor responds to
 * input. Undo scoping is resolved per relay server, since which collaborators a
 * document is shared with is what determines whether shared undo is wanted; the
 * vault-level value is the default for relays with no explicit choice.
 */

export interface EditorSettings {
	scopeUndoToLocalEdits: boolean;
}

/** Per-relay overrides of the vault-level editor settings, keyed by relay guid. */
export interface RelayEditorSettings {
	scopeUndoToLocalEdits?: boolean;
}

/**
 * Undo scoping defaults off, preserving the behavior every existing install
 * already has: a collaborator's incoming change enters the local undo history.
 *
 * Deliberately not the safer value. Flipping a default cannot reach an existing
 * vault anyway — the plugin materializes every settings key into data.json on
 * save — so a default of `true` would change nothing for current users while
 * silently changing behavior for new ones. Deployments that want scoping turn it
 * on explicitly, per vault or per relay.
 */
export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
	scopeUndoToLocalEdits: false,
};

/**
 * Resolve whether a dispatch should be kept out of the local undo history.
 *
 * The relay-level value wins when set, so one collaboration can differ from the
 * rest; otherwise the vault-level default applies. Both absent means off, which
 * is the historical behavior.
 */
export function resolveScopeUndo(
	relayValue: boolean | undefined,
	vaultValue: boolean | undefined,
): boolean {
	return relayValue ?? vaultValue ?? false;
}
