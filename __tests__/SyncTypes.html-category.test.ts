import { Settings } from "../src/SettingsStorage";
import { SyncSettingsManager, type SyncFlags } from "../src/SyncSettings";
import { SyncType, TypeRegistry, makeFileMeta } from "../src/SyncTypes";

async function registryWith(flags: SyncFlags): Promise<TypeRegistry> {
	const data = { sync: flags };
	const settings = new Settings<Record<string, unknown>>(
		{ loadData: async () => data, saveData: async () => {} },
		{},
	);
	await settings.load();
	return new TypeRegistry(new SyncSettingsManager(settings, "sync"));
}

const fileMeta = makeFileMeta(SyncType.File, "g1", "text/html", "h1");

describe("html sync category", () => {
	test("HTML syncs with otherTypes off, and other unsupported files do not", async () => {
		const registry = await registryWith({ otherTypes: false });

		expect(registry.canSync("page.html")).toBe(true);
		expect(registry.canSync("page.HTM", fileMeta)).toBe(true);
		expect(registry.canSync("archive.zip")).toBe(false);
		expect(registry.isEnabledFor(SyncType.File, "archive.zip")).toBe(false);
	});

	test("HTML is on by default, for folders whose settings predate the category", async () => {
		const registry = await registryWith({});

		expect(registry.canSync("page.html", fileMeta)).toBe(true);
	});

	test("turning HTML off stops HTML even when otherTypes is on", async () => {
		const registry = await registryWith({ html: false, otherTypes: true });

		expect(registry.canSync("page.html", fileMeta)).toBe(false);
		expect(registry.canSync("archive.zip")).toBe(true);
	});

	test("HTML stays SyncType.File, so metadata is unchanged for older clients", async () => {
		const registry = await registryWith({});

		expect(registry.getTypeForPath("page.html")).toBe(SyncType.File);
	});

	test("File is an enabled type whenever HTML is on, so its entries reach syncByType", async () => {
		expect((await registryWith({ otherTypes: false })).getEnabledFileSyncTypes()).toContain(
			SyncType.File,
		);
		expect(
			(await registryWith({ html: false, otherTypes: false })).getEnabledFileSyncTypes(),
		).not.toContain(SyncType.File);
	});

	test("each File switch is its own gate, so turning either on is seen as newly enabled", async () => {
		const htmlOnly = await registryWith({ otherTypes: false });
		const both = await registryWith({ otherTypes: true });
		const otherOnly = await registryWith({ html: false, otherTypes: true });

		expect([...htmlOnly.getEnabledSyncGates().keys()]).toContain("file:html");
		expect([...htmlOnly.getEnabledSyncGates().keys()]).not.toContain("file:otherTypes");
		expect([...both.getEnabledSyncGates().keys()]).toEqual(
			expect.arrayContaining(["file:html", "file:otherTypes"]),
		);
		expect([...otherOnly.getEnabledSyncGates().keys()]).not.toContain("file:html");
		expect(both.getEnabledSyncGates().get("file:otherTypes")).toBe(SyncType.File);
	});
});
