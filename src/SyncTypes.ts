import { type SyncFlags, type SyncSettingsManager } from "./SyncSettings";
import { getMimeType } from "./mimetypes";
import { Observable } from "./observable/Observable";

export enum SyncType {
	Folder = "folder",
	Document = "markdown",
	Canvas = "canvas",
	Image = "image",
	PDF = "pdf",
	Audio = "audio",
	Video = "video",
	Base = "base",
	File = "file",
}

export type SyncFileType =
	| SyncType.Image
	| SyncType.PDF
	| SyncType.Audio
	| SyncType.Video
	| SyncType.Base
	| SyncType.File;

interface MetaBase {
	id: string;
	version: number;
	type: SyncType;
	hash?: string;
	synctime?: number;
	mimetype?: string;
}

export interface FolderMeta extends MetaBase {
	version: 0;
	type: SyncType.Folder;
}

export interface DocumentMeta extends MetaBase {
	version: 0;
	type: SyncType.Document;
}

export interface CanvasMeta extends MetaBase {
	version: 0;
	type: SyncType.Canvas;
}

interface BaseFileMeta extends MetaBase {
	size?: number;
	version: 0;
	type: SyncFileType;
	mimetype: string;
	hash: string;
	synctime: number;
}

export interface ImageMeta extends BaseFileMeta {
	type: SyncType.Image;
}

export interface PDFMeta extends BaseFileMeta {
	type: SyncType.PDF;
}

export interface AudioMeta extends BaseFileMeta {
	type: SyncType.Audio;
}

export interface VideoMeta extends BaseFileMeta {
	type: SyncType.Video;
}

export interface BaseMeta extends BaseFileMeta {
	type: SyncType.Base;
}

export interface FileMeta extends BaseFileMeta {
	type: SyncType.File;
}

export type FileMetas =
	| ImageMeta
	| PDFMeta
	| AudioMeta
	| VideoMeta
	| BaseMeta
	| FileMeta;

export type Meta = FolderMeta | DocumentMeta | FileMetas | CanvasMeta;

type SyncTypeToMeta = {
	[SyncType.Folder]: FolderMeta;
	[SyncType.Document]: DocumentMeta;
	[SyncType.Canvas]: CanvasMeta;
	[SyncType.PDF]: PDFMeta;
	[SyncType.Image]: ImageMeta;
	[SyncType.Audio]: AudioMeta;
	[SyncType.Video]: VideoMeta;
	[SyncType.Base]: BaseMeta;
	[SyncType.File]: FileMeta;
};

// `html` is absent: it has no SyncType of its own (see TypeRegistry.isEnabledFor).
export const SyncFlagToTypeMap: Record<Exclude<keyof SyncFlags, "html">, SyncType> = {
	images: SyncType.Image,
	audio: SyncType.Audio,
	videos: SyncType.Video,
	pdfs: SyncType.PDF,
	canvas: SyncType.Canvas,
	bases: SyncType.Base,
	otherTypes: SyncType.File,
};

export const SyncTypeToFlagMap: Record<SyncType, keyof SyncFlags | null> = {
	[SyncType.Document]: null, // Always enabled
	[SyncType.Canvas]: "canvas",
	[SyncType.Folder]: null, // Always enabled
	[SyncType.Image]: "images",
	[SyncType.Audio]: "audio",
	[SyncType.Video]: "videos",
	[SyncType.PDF]: "pdfs",
	[SyncType.Base]: "bases",
	[SyncType.File]: "otherTypes",
};

export function isDocumentMeta(meta?: Meta): meta is DocumentMeta {
	return meta?.type === SyncType.Document;
}

export function isCanvasMeta(meta?: Meta): meta is DocumentMeta {
	return meta?.type === SyncType.Canvas;
}

export function isSyncFolderMeta(meta?: Meta): meta is FolderMeta {
	return meta?.type === SyncType.Folder;
}

export function isSyncFileMeta(meta?: Meta): meta is FileMeta {
	return meta?.type === SyncType.File;
}

const fileMetaTypes: ReadonlySet<SyncType> = new Set<SyncType>([
	SyncType.Image,
	SyncType.PDF,
	SyncType.Audio,
	SyncType.Video,
	SyncType.Base,
	SyncType.File,
]);

/** True for any content-addressed file meta, whatever its file type. */
export function isFileMetas(meta?: Meta): meta is FileMetas {
	return !!meta && fileMetaTypes.has(meta.type);
}

export function isImageMeta(meta?: Meta): meta is ImageMeta {
	return meta?.type === SyncType.Image;
}

export function isPDFMeta(meta?: Meta): meta is PDFMeta {
	return meta?.type === SyncType.PDF;
}

export function isAudioMeta(meta?: Meta): meta is AudioMeta {
	return meta?.type === SyncType.Audio;
}

export function isVideoMeta(meta?: Meta): meta is VideoMeta {
	return meta?.type === SyncType.Video;
}

export function isBaseMeta(meta?: Meta): meta is BaseMeta {
	return meta?.type === SyncType.Base;
}

export function makeDocumentMeta(guid: string): DocumentMeta {
	return {
		version: 0,
		id: guid,
		type: SyncType.Document,
	};
}

export function makeCanvasMeta(guid: string): CanvasMeta {
	return {
		version: 0,
		id: guid,
		type: SyncType.Canvas,
	};
}

export function makeFolderMeta(guid: string): FolderMeta {
	return {
		version: 0,
		id: guid,
		type: SyncType.Folder,
	};
}

export function makeFileMeta<T extends SyncFileType>(
	type: T,
	guid: string,
	mimetype: string,
	hash: string,
	synctime?: number,
	size?: number,
): SyncTypeToMeta[T] {
	if (!synctime) {
		synctime = Date.now();
	}
	return {
		version: 0,
		id: guid,
		type: type,
		mimetype,
		synctime,
		hash,
		...(size === undefined ? {} : { size }),
	} as SyncTypeToMeta[T];
}

interface ProtocolSupport {
	maxVersion: number;
	mimetypes: string[];
	enabled: boolean;
}

export class TypeRegistry extends Observable<TypeRegistry> {
	private protocols = new Map<SyncType, ProtocolSupport>();

	constructor(
		private syncSettings: SyncSettingsManager,
		private configs?: Array<[SyncType, ProtocolSupport]>,
	) {
		super();
		configs = configs || TypeRegistry.defaults;
		configs.forEach(([type, config]) => this.protocols.set(type, config));
		this.updateFromSettings();
		this.unsubscribes.push(
			syncSettings.subscribe(() => {
				this.updateFromSettings();
			}),
		);
	}

	static defaults: Array<[SyncType, ProtocolSupport]> = [
		[
			SyncType.Folder,
			{
				maxVersion: 0,
				mimetypes: [],
				enabled: true,
			},
		],
		[
			SyncType.Document,
			{
				maxVersion: 0,
				mimetypes: ["text/markdown"],
				enabled: true,
			},
		],
		[
			SyncType.Image,
			{
				maxVersion: 0,
				mimetypes: [
					"image/png",
					"image/jpeg",
					"image/gif",
					"image/svg+xml",
					"image/webp",
					"image/avif",
					"image/bmp",
				],
				enabled: true,
			},
		],
		[
			SyncType.PDF,
			{
				maxVersion: 0,
				mimetypes: ["application/pdf"],
				enabled: true,
			},
		],
		[
			SyncType.Audio,
			{
				maxVersion: 0,
				mimetypes: [
					"audio/mpeg",
					"audio/wav",
					"audio/flac",
					"audio/mp4",
					"audio/x-m4a",
					"audio/ogg",
					"audio/opus",
				],
				enabled: true,
			},
		],
		[
			SyncType.Video,
			{
				maxVersion: 0,
				mimetypes: [
					"video/mp4",
					"video/webm",
					"video/ogg",
					"video/quicktime",
					"video/x-matroska",
				],
				enabled: true,
			},
		],
		[
			SyncType.Canvas,
			{
				maxVersion: 0,
				mimetypes: ["application/canvas+json"],
				enabled: true,
			},
		],
		[
			SyncType.Base,
			{
				maxVersion: 0,
				mimetypes: ["application/vnd.obsidian.base+yaml"],
				enabled: true,
			},
		],
		[
			SyncType.File,
			{
				maxVersion: 0,
				mimetypes: ["application/octet-stream"],
				enabled: false,
			},
		],
	];

	setEnabled(type: SyncType, enabled: boolean) {
		const config = this.protocols.get(type);
		if (config) {
			this.protocols.set(type, { ...config, enabled: enabled });
		}
	}

	canSync(vpath: string, meta?: Meta): boolean {
		if (vpath.endsWith(".md")) return true;

		// For new folders
		const hasExtension = vpath.split("/").pop()?.includes(".");
		if (!hasExtension) {
			return true;
		}

		// For existing files, check meta
		if (meta) {
			const config = this.protocols.get(meta.type);
			if (!config) return false;
			return this.isEnabledFor(meta.type, vpath) && meta.version <= config.maxVersion;
		}

		// For new files, check path
		return this.isEnabledFor(this.getTypeForPath(vpath), vpath);
	}

	/**
	 * Whether a file of `type` at `vpath` syncs. A SyncType.File with an HTML extension follows
	 * the `html` category rather than `otherTypes`; every other file follows its type.
	 * Does not check protocol version; `canSync` does.
	 */
	isEnabledFor(type: SyncType, vpath: string): boolean {
		if (type === SyncType.File) {
			const html = this.syncSettings.getCategory("html");
			const extension = (vpath.split(".").pop() || "").toLowerCase();
			if (html.extensions.includes(extension)) return html.enabled;
		}
		return !!this.protocols.get(type)?.enabled;
	}

	private updateFromSettings(): void {
		const categories = this.syncSettings.getCategories();
		Object.entries(SyncFlagToTypeMap).forEach(([flagKey, syncType]) => {
			const enabled = categories[flagKey as keyof SyncFlags].enabled;
			this.setEnabled(syncType, enabled);
		});
	}

	/**
	 * Types that may have synced files. `SyncType.File` is included when either `otherTypes`
	 * or `html` is on, so entries of that type must still be narrowed per path with `isEnabledFor`.
	 */
	public getEnabledFileSyncTypes(): SyncType[] {
		// Documents and folders are always enabled

		const enabledTypes: SyncType[] = [];
		this.protocols.forEach((proto, syncType) => {
			if (proto?.enabled && syncType !== SyncType.Folder) {
				enabledTypes.push(syncType);
			}
		});

		if (
			!enabledTypes.includes(SyncType.File) &&
			this.syncSettings.getCategory("html").enabled
		) {
			enabledTypes.push(SyncType.File);
		}

		return enabledTypes;
	}

	/**
	 * The switches currently letting files sync, keyed so that a key appearing between two calls
	 * means some local files just became syncable. Each is one SyncType, except that
	 * `SyncType.File` has two switches, `otherTypes` and `html`.
	 */
	public getEnabledSyncGates(): Map<string, SyncType> {
		const gates = new Map<string, SyncType>();
		for (const type of this.getEnabledFileSyncTypes()) {
			if (type !== SyncType.File) gates.set(type, type);
		}
		if (this.protocols.get(SyncType.File)?.enabled) {
			gates.set("file:otherTypes", SyncType.File);
		}
		if (this.syncSettings.getCategory("html").enabled) {
			gates.set("file:html", SyncType.File);
		}
		return gates;
	}

	getTypeForPath(vpath: string): SyncType {
		const mimetype = getMimeType(vpath);

		for (const [type, config] of this.protocols) {
			if (config.mimetypes.includes(mimetype)) {
				return type;
			}
		}

		return SyncType.File;
	}
}
