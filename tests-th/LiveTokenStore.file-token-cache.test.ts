jest.mock("src/customFetch", () => ({
	customFetch: jest.fn(),
	getRelayRequestHeaders: () => ({}),
}));
jest.mock("pocketbase", () => ({
	__esModule: true,
	default: jest.fn(),
	BaseAuthStore: class {},
}));

const memory = new Map<string, string>();
Object.assign(globalThis, {
	localStorage: {
		getItem: (key: string) => memory.get(key) ?? null,
		setItem: (key: string, value: string) => memory.set(key, value),
		removeItem: (key: string) => memory.delete(key),
		key: (index: number) => [...memory.keys()][index] ?? null,
		get length() {
			return memory.size;
		},
	},
});

import { LiveTokenStore } from "src/LiveTokenStore";
import type { LoginManager } from "src/LoginManager";
import type { FileToken } from "src/client/types";
import type { TimeProvider } from "src/TimeProvider";

const timeProvider = {
	now: () => Date.now(),
	setInterval: () => 0,
	clearInterval: () => undefined,
	setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
	clearTimeout: (id: number) => clearTimeout(id),
} as unknown as TimeProvider;

function makeStore(): LiveTokenStore {
	return new LiveTokenStore(
		{} as unknown as LoginManager,
		timeProvider,
		"test-vault",
		"test-device",
	);
}

function fileToken(): FileToken {
	return {
		token: "tok",
		url: "",
		baseUrl: "https://relay.example/f/doc",
		docId: "doc",
		folder: "folder",
		authorization: "full",
		expiryTime: Date.now() + 30 * 60 * 1000,
	} as FileToken;
}

beforeEach(() => memory.clear());

test("a second request for the same file reuses the cached token", async () => {
	const store = makeStore();
	const fetchFileToken = jest
		.spyOn(store, "fetchFileToken")
		.mockImplementation(async () => fileToken());

	await store.getFileToken("s3rn:file", "hash-a", "image/png", 10);
	await store.getFileToken("s3rn:file", "hash-a", "image/png", 10);

	expect(fetchFileToken).toHaveBeenCalledTimes(1);
});

test("a different hash of the same file fetches its own token", async () => {
	const store = makeStore();
	const fetchFileToken = jest
		.spyOn(store, "fetchFileToken")
		.mockImplementation(async () => fileToken());

	await store.getFileToken("s3rn:file", "hash-a", "image/png", 10);
	await store.getFileToken("s3rn:file", "hash-b", "image/png", 10);

	expect(fetchFileToken).toHaveBeenCalledTimes(2);
});
