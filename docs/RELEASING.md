# Releasing

Versions are tagged manually on `main`. Version lives in `package.json`.

## Steps

1. Bump `version` in `package.json` (semver: `0.1.0`, `0.2.0`, patch for hotfixes)
2. Commit: `git commit -m "chore: bump version to x.x.x"`
3. Merge to `main`
4. Tag: `git tag -a vx.x.x -m "short description"`
5. Push tag: `git push origin vx.x.x`
