# CrystalDB Release Guide

Follow this checklist any time you publish new versions of the CrystalDB packages to npm.

## 1. Prerequisites
- You must have publish access to the npm organization.
- Run `npm login` once in your shell. Confirm with `npm whoami`.
- Ensure you are on a clean `main` (or release) branch and have pulled the latest changes.

## 2. Choose the Version
- Decide on the next semantic version (`MAJOR.MINOR.PATCH`, optionally with a pre-release suffix such as `-beta.1`).
- Substitute `X.Y.Z` with your target version in every command below.

## 3. Update Versions
Run the following from the repository root to bump the root workspace and each package without creating git tags:

```
npm version X.Y.Z --no-git-tag-version
(cd packages/core && npm version X.Y.Z --no-git-tag-version)
(cd packages/node && npm version X.Y.Z --no-git-tag-version)
(cd packages/react && npm version X.Y.Z --no-git-tag-version)
```

## 4. Align Internal Dependencies
`@crystaldb/node` and `@crystaldb/react` depend on `@crystaldb/core`. Update their dependency ranges:

```
(cd packages/node && npm pkg set 'dependencies["@crystaldb/core"]=^X.Y.Z')
(cd packages/react && npm pkg set 'dependencies["@crystaldb/core"]=^X.Y.Z')
```

Review each `package.json` to confirm the versions look correct.

## 5. Reinstall and Build
From the repository root:

```
npm install
npm run build --workspaces
```

Optional but recommended: `npm test`.

## 6. Publish Packages
Publish each package from its directory. Use `--dry-run` first if you want to verify the tarball contents.

```
(cd packages/core && npm publish --access public)
(cd packages/node && npm publish --access public)
(cd packages/react && npm publish --access public)
```

If any publish fails, fix the problem, rerun the build, and retry only the failed package.

## 7. Commit and Tag
- Inspect `git status`. You should see version bumps and the updated `package-lock.json`.
- Commit with a message such as `Release X.Y.Z`.
- Create and push a git tag if desired: `git tag vX.Y.Z` and `git push origin vX.Y.Z`.
- Push the commit: `git push origin <your-branch>`.

## 8. Post-Release Checks
- Confirm the packages appear on npm with the expected version numbers.
- Update documentation or changelog entries if needed.
- Notify the team or stakeholders about the release.

You are done!

