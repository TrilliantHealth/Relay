// Upstream's jest.config.mjs names a setup file inside __tests__/, which is
// git-crypt encrypted and unreadable without upstream's key. This config runs
// the unencrypted tests-th/ suites without it.
import base from "./jest.config.mjs";

export default {
	...base,
	setupFiles: [],
	testMatch: ["<rootDir>/tests-th/**/*.test.ts"],
};
