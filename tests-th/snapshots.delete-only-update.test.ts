import * as Y from "yjs";

import { snapshotContainsUpdate, snapshotFromDoc, yjsUpdateIsNoop } from "src/merge-hsm/snapshots";

function replicaWithOneDeletion(): { local: Y.Doc; remote: Y.Doc } {
	const remote = new Y.Doc();
	remote.getText("contents").insert(0, "hello");
	remote.getText("contents").delete(1, 1);
	const local = new Y.Doc();
	Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));
	return { local, remote };
}

function nextDeletion(remote: Y.Doc): Uint8Array {
	let update = new Uint8Array();
	remote.once("update", (u: Uint8Array) => {
		update = u;
	});
	remote.getText("contents").delete(1, 1);
	return update;
}

test("a deletion that extends an existing tombstone range is not a no-op", () => {
	const { local, remote } = replicaWithOneDeletion();
	const update = nextDeletion(remote);

	expect(yjsUpdateIsNoop(local, update)).toBe(false);
	expect(snapshotContainsUpdate(snapshotFromDoc(local), update)).toBe(false);
});

test("a deletion the doc already has is a no-op", () => {
	const { local, remote } = replicaWithOneDeletion();
	const update = nextDeletion(remote);
	Y.applyUpdate(local, update);

	expect(local.getText("contents").toString()).toBe("hlo");
	expect(yjsUpdateIsNoop(local, update)).toBe(true);
	expect(snapshotContainsUpdate(snapshotFromDoc(local), update)).toBe(true);
});
