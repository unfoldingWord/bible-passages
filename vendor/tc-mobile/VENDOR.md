# Vendored from tc-mobile

These files are copied byte for byte from
[unfoldingWord/tc-mobile](https://github.com/unfoldingWord/tc-mobile) so this repo
can run the app's own template checker on `dist/tc-mobile/`. They are MIT
licensed, copyright 2026 unfoldingWord, the same as this repo's code.

Do not edit them. To update, copy the files from a newer tc-mobile `develop`
commit and change the commit and hashes below in the same PR.
`tests/vendor.test.ts` fails if a file's hash does not match this table.

Pinned commit: `94430f39776242699b84785679737d017fac3efb` (`develop`, 2026-11-17)

| File here | Path in tc-mobile | SHA-256 |
| --- | --- | --- |
| `template.ts` | `src/types/template.ts` | `cc2b00e2419e8d9e72b5988bf1d7e2a0ac8964eb8ae4cb723525f79ce42ceda2` |
| `validate.ts` | `src/lib/templates/validate.ts` | `8683306d03ec4c05ac0f540e2e8656377d40fa41dad124252052d57bda45a970` |

The contract these files implement is tc-mobile's
`docs/contracts/template-package-v0.md` at the same commit.

`validate.ts` imports `@/types/template`. `tsconfig.json` and
`vitest.config.ts` map that path to `template.ts` here, so neither file needs
editing.

The fixtures in `tests/fixtures/tc-mobile/` come from
`tests/fixtures/templates/` at the same commit. `bible-passages-TIT.json` is not copied: it is
tc-mobile's pinned copy of this repo's own pre-release
`dist/tc-mobile/TIT.json`, so it would test this repo against itself.
