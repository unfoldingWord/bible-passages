# Vendored from tc-mobile

These files are copied byte for byte from
[unfoldingWord/tc-mobile](https://github.com/unfoldingWord/tc-mobile) so this repo
can run the app's own template checker on `dist/tc-mobile/`. They are MIT
licensed, copyright 2026 unfoldingWord, the same as this repo's code.

Do not edit them. To update, copy the files from a newer tc-mobile `develop`
commit and change the commit and hashes below in the same PR.
`tests/vendor.test.ts` fails if a file's hash does not match this table.

Pinned commit: `8757e3a818f7054048491769e08716a11b09484a` (`develop`, 2026-10-28)

| File here | Path in tc-mobile | SHA-256 |
| --- | --- | --- |
| `template.ts` | `src/types/template.ts` | `7cae51c5b7f39ce015683722e46331b5dcdf8a5eb219ad5a0a79517c818ac03a` |
| `validate.ts` | `src/lib/templates/validate.ts` | `1cd9803ecfa1dda8f52fd41c177386e9c021b22b9de99ca4dba2988b8b3faf7f` |

The contract these files implement is tc-mobile's
`docs/contracts/template-package-v0.md` at the same commit.

`validate.ts` imports `@/types/template`. `tsconfig.json` and
`vitest.config.ts` map that path to `template.ts` here, so neither file needs
editing.

The fixtures in `tests/fixtures/tc-mobile/` come from
`tests/fixtures/templates/` at the same commit.
