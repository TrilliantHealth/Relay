TH-authored tests, plaintext on purpose: upstream git-crypts `__tests__/**` and we
have no key, so our tests live here instead. Jest's default testMatch picks these up;
run just ours with `npx jest tests-th` (a bare `npx jest` chokes on the encrypted
upstream suite in a locked checkout).
