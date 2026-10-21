---
created-at: 2026-10-20T13:12:43-04:00
created-by: MatchOdd
---
# TH local move candidate

This branch ports the reviewed public local-move API from [upstream PR #147](https://github.com/No-Instructions/Relay/pull/147), commit `20261020.1308-18d5a07c`, onto deployed `0.8.13-pre.2-th.1`. The API contract is in [API-LOCAL-MOVE.md](API-LOCAL-MOVE.md).

The proposed next internal version is `0.8.13-pre.2-th.2`. It is a local candidate, not a published release or a fleet pin. The tracked manifest keeps the deployed version until the release version is approved.

## Build without a tag

`RELAY_BUILD_VERSION` overrides the Git-derived version for a local build. Without it, builds use `git describe --tags --always` as before. The override sets the embedded runtime version, Relay-Version request header, health URL version, and output manifest together.

Run from a clean checkout after `npm ci`:

```sh
npx tsc --noEmit -skipLibCheck
RELAY_BUILD_VERSION=0.8.13-pre.2-th.2 node esbuild.config.mjs production .z/candidate
shasum -a 256 .z/candidate/main.js .z/candidate/manifest.json .z/candidate/styles.css
```

The explicit output directory keeps the candidate assets separate from the tracked manifest. Keep the source commit and hashes with the candidate. Rebuild and verify again if any input changes, including the eventual release tag or version.

## Validation

```sh
npm test -- --config jest.public-api.config.mjs --runInBand
npx tsc --noEmit -skipLibCheck -p tests
npm run lint
npm run build production
```

Public tests validate the API and folder provenance helpers. SharedFolder's encrypted developer tests and a two-client trial remain separate requirements for rollout.

## Release order

Before any client install, a separately approved server change must admit the exact candidate version alongside `0.8.13-pre.2-th.1`. Keep both admitted during the canary and rollback window. Only then publish a targeted Nurse manifest, validate the Relay and Auto Alias pair, and consider a fleet pin change.

Relay's fleet pin is `_DEFAULT_RELAY_TAG` in `obsidian-witchdoctor.py`, not `plugin-lock.json`. Auto Alias is built from monorepo source; its consumer change needs an isolated canary publication path before a shared publication. On rollback, direct Nurse to the previous pair while the server still admits it, verify client downgrade and reconnection, and only then consider removing candidate admission.

This branch does not authorize a release tag, publication, install, server change, Nurse change, merge, or deployment.
