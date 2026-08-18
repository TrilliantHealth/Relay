import type { EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import type { App, TFile, CachedMetadata } from "obsidian";
import type { SharedFolders } from "./SharedFolder";
import {
	resolveScopeUndo,
	type RelayEditorSettings,
} from "./EditorSettings";

export interface MetadataBridge {
	onMeta(
		tfile: TFile,
		cb: (data: string, cache: CachedMetadata) => void,
	): void;
	offMeta(tfile: TFile): void;
}

interface RelayPlugin {
	sharedFolders: SharedFolders;
	app: App;
	metadataBridge?: MetadataBridge;
	editorSettings?: { get(): { scopeUndoToLocalEdits?: boolean } };
	relayEditorSettings?: { get(): Record<string, RelayEditorSettings> };
}

export function getRelayPlugin(editor: EditorView): RelayPlugin | null {
	const fileInfo = editor.state.field(editorInfoField, false);
	return (fileInfo as any)?.app?.plugins?.plugins?.["system3-relay"] ?? null;
}

export function getSharedFolders(editor: EditorView): SharedFolders | null {
	return getRelayPlugin(editor)?.sharedFolders ?? null;
}

export function getLiveViews(editor: EditorView): unknown | null {
	return (getRelayPlugin(editor) as any)?._liveViews ?? null;
}

export function getApp(editor: EditorView): App | null {
	const fileInfo = editor.state.field(editorInfoField, false);
	return (fileInfo as any)?.app ?? null;
}

export function getEditorFile(editor: EditorView) {
	const fileInfo = editor.state.field(editorInfoField, false);
	return fileInfo?.file ?? null;
}

/**
 * Whether remote changes should be kept out of this editor's undo history.
 *
 * Resolved per relay server, falling back to the vault-level default. Read live
 * on each dispatch rather than cached, so a toggle takes effect on the next
 * incoming change without a reload.
 */
export function shouldScopeUndoToLocalEdits(editor: EditorView): boolean {
	const plugin = getRelayPlugin(editor);
	if (!plugin) return false;

	const file = getEditorFile(editor);
	const relayId = file
		? (plugin.sharedFolders?.lookup(file.path)?.relayId ?? null)
		: null;

	return resolveScopeUndo(
		relayId
			? plugin.relayEditorSettings?.get()?.[relayId]?.scopeUndoToLocalEdits
			: undefined,
		plugin.editorSettings?.get()?.scopeUndoToLocalEdits,
	);
}
