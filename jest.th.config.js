// Upstream's jest.config.js names a setup file inside __tests__/, which is
// git-crypt encrypted and unreadable without upstream's key. This config runs
// the unencrypted tests-th/ suites without it.
const base = require("./jest.config.js");
module.exports = {
	...base,
	setupFiles: [],
	testMatch: ["<rootDir>/tests-th/**/*.test.ts"],
};
