// A remote removal or move that the previous session committed to membership
// but never carried out on disk must keep the leftover file from being minted
// as a new local note after a restart.

class MemoryStorage {
	private items = new Map<string, string>();
	get length(): number {
		return this.items.size;
	}
	key(index: number): string | null {
		return Array.from(this.items.keys())[index] ?? null;
	}
	getItem(key: string): string | null {
		return this.items.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.items.set(key, String(value));
	}
	removeItem(key: string): void {
		this.items.delete(key);
	}
	clear(): void {
		this.items.clear();
	}
}

const storage = new MemoryStorage();
// LocalStorage builds its key index from Object.keys(storage).
const storageProxy = new Proxy(storage, {
	ownKeys: (target) => Array.from({ length: target.length }, (_, i) => target.key(i) as string),
	getOwnPropertyDescriptor: (target, key) =>
		typeof key === "string" && target.getItem(key) !== null
			? { enumerable: true, configurable: true, value: target.getItem(key) }
			: undefined,
});
(globalThis as { localStorage?: unknown }).localStorage = storageProxy;

// SharedFolder's import graph reaches pocketbase and obsidian classes at
// module load; none of them run in these tests.
jest.mock("pocketbase", () => ({ __esModule: true, default: class {}, BaseAuthStore: class {} }));
jest.mock(
	"obsidian",
	() =>
		new Proxy(
			{ __esModule: true, Platform: { isDesktop: true, isMobile: false } } as Record<string | symbol, unknown>,
			{ get: (target, key) => (key in target ? target[key] : class {}) },
		),
	{ virtual: true },
);

import { LocalStorage } from "src/LocalStorage";
import { SharedFolder } from "src/SharedFolder";
import { MembershipSnapshot } from "src/folder-hsm/MembershipSnapshot";
import { ServerOps, type PendingServerOp } from "src/folder-hsm/ServerOps";

const NAMESPACE = "app-system3-relay/folders/folder-guid/pendingServerOps";

type Membership = Map<string, string>;

/**
 * A folder object carrying only the state the restart path reads: the
 * durable claims, replayed membership, and the boot snapshot built from it.
 * Each call is one app session over the same device storage.
 */
function session(membership: Membership): SharedFolder {
	const folder = Object.create(SharedFolder.prototype) as any;
	folder.destroyed = false;
	folder.pendingServerOpsRestored = false;
	folder.pendingServerOps = new LocalStorage<PendingServerOp>(NAMESPACE);
	folder.serverOps = new ServerOps((paths: string[]) => folder.persistPendingServerOps(paths));
	folder.syncStore = {
		has: (path: string) => membership.has(path),
		membershipPaths: () => membership.keys(),
	};
	folder.findCommittedPathByGuid = (guid: string) => {
		for (const [path, id] of membership) if (id === guid) return path;
		return null;
	};
	folder.log = () => {};
	folder.warn = () => {};
	return folder;
}

/** The boot ordering from SharedFolder's connect path. */
function boot(folder: any, restore: boolean): void {
	if (restore) folder.restorePendingServerOps();
	folder.pendingServerOpsRestored = true;
	folder.persistPendingServerOps(Array.from(folder.pendingServerOps.keys()));
	folder.bootSnapshot = new MembershipSnapshot(folder.syncStore.membershipPaths());
}

const isNovel = (folder: any, path: string): boolean => folder.isNovelPath(path);

beforeEach(() => storage.clear());

test("a removal recorded before restart keeps the file on disk from minting", () => {
	const membership: Membership = new Map([
		["kept.md", "guid-kept"],
		["gone.md", "guid-gone"],
	]);
	const first = session(membership);
	boot(first, true);

	// The server removes gone.md; the client records the pending disk delete
	// and commits membership, then quits before the tree sync trashes it.
	(first as any).serverOps.recordDelete("gone.md");
	membership.delete("gone.md");

	const second = session(membership);
	boot(second, true);

	expect(isNovel(second, "gone.md")).toBe(false);
	expect((second as any).serverOps.pendingDeletePaths()).toEqual(["gone.md"]);
	expect(isNovel(second, "brand-new.md")).toBe(true);
});

test("without the saved claim the same leftover file reads as a new note", () => {
	const membership: Membership = new Map([["gone.md", "guid-gone"]]);
	const first = session(membership);
	boot(first, true);
	(first as any).serverOps.recordDelete("gone.md");
	membership.delete("gone.md");

	const second = session(membership);
	boot(second, false);

	expect(isNovel(second, "gone.md")).toBe(true);
});

test("a move recorded before restart covers its source and follows the identity", () => {
	const membership: Membership = new Map([["old/note.md", "guid-note"]]);
	const first = session(membership);
	boot(first, true);
	(first as any).serverOps.recordMove({ guid: "guid-note", from: "old/note.md", to: "new/note.md" });
	membership.delete("old/note.md");
	membership.set("new/note.md", "guid-note");

	const second = session(membership);
	boot(second, true);

	expect(isNovel(second, "old/note.md")).toBe(false);
	expect((second as any).serverOps.pendingMoves()).toEqual([
		{ guid: "guid-note", from: "old/note.md", to: "new/note.md" },
	]);
});

test("a claim whose membership update never committed is dropped at boot", () => {
	const membership: Membership = new Map([["note.md", "guid-note"]]);
	const first = session(membership);
	boot(first, true);

	// The claim was written, but the process died before membership changed.
	(first as any).serverOps.recordDelete("note.md");

	const second = session(membership);
	boot(second, true);

	expect((second as any).serverOps.pendingDeletePaths()).toEqual([]);
	expect(new LocalStorage<PendingServerOp>(NAMESPACE).has("note.md")).toBe(false);
});

test("a completed disk delete clears its saved claim", () => {
	const membership: Membership = new Map([["gone.md", "guid-gone"]]);
	const first = session(membership);
	boot(first, true);
	(first as any).serverOps.recordDelete("gone.md");
	membership.delete("gone.md");
	(first as any).serverOps.clearDelete("gone.md");

	const second = session(membership);
	boot(second, true);

	expect(isNovel(second, "gone.md")).toBe(true);
	expect(new LocalStorage<PendingServerOp>(NAMESPACE).size).toBe(0);
});
