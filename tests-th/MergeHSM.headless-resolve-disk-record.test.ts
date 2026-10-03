import * as Y from "yjs";

import { MergeHSM } from "src/merge-hsm/MergeHSM";
import { buildConflict } from "src/merge-hsm/conflictValue";

const DISK_TEXT = "intro\n";
const SERVER_TEXT = "intro\nsection the server kept\n";
const DISK_RECORD = { hash: "hash-of-disk-text", mtime: 1 };

function docWith(text: string): Y.Doc {
	const doc = new Y.Doc();
	doc.getText("contents").insert(0, text);
	return doc;
}

function conflictedIdleMachine(): MergeHSM {
	const remoteDoc = docWith(SERVER_TEXT);
	const localDoc = new Y.Doc();
	Y.applyUpdate(localDoc, Y.encodeStateAsUpdate(remoteDoc));
	const hsm = new MergeHSM({
		guid: "doc",
		getPath: () => "doc.md",
		vaultId: "vault",
		remoteDoc,
		hashFn: async (contents: string) => `hash-of-${contents.length}`,
		createPersistence: (() => null) as never,
	});
	Object.assign(hsm, {
		localDoc,
		_statePath: "idle.conflict",
		_disk: DISK_RECORD,
		_conflict: buildConflict({
			situation: "no-baseline",
			base: null,
			ours: { source: "remote", text: SERVER_TEXT },
			theirs: { source: "file", text: DISK_TEXT },
		}),
	});
	return hsm;
}

test("a headless resolve writes against the disk record the conflict was computed from", async () => {
	const hsm = conflictedIdleMachine();
	const effects: { type: string; contents?: string; expectedDisk?: unknown }[] = [];
	jest.spyOn(hsm, "emitEffect").mockImplementation((effect) => {
		effects.push(effect as (typeof effects)[number]);
	});

	await hsm.resolveConflictHeadless(SERVER_TEXT);

	const writes = effects.filter((e) => e.type === "WRITE_DISK");
	expect(writes).toHaveLength(1);
	expect(writes[0].contents).toBe(SERVER_TEXT);
	expect(writes[0].expectedDisk).toEqual(DISK_RECORD);
	expect(effects.some((e) => e.type === "ENQUEUE_SYNC")).toBe(true);
});
