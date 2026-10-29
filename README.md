# bible-passages

The Bible Passages dataset: passage (pericope) and chunk divisions for every
book of the Bible, with titles in multiple languages.

Tracking issue: [unfoldingWord/servant.bible#1](https://github.com/unfoldingWord/servant.bible/issues/1).
Servant.Bible slug: `uw/bible-passages` (proposed in servant.bible PR #31).

Project home: https://claude.ai/artifact/RiDFC57H2UCyKHe4ZwhvDT?sk=N9G-t8PMGiKhJQplKo8ivw#home

## Status

No data yet. The proposed layout, key format and checks are in
[docs/schema.md](docs/schema.md), with the decisions still open listed at the
end.

## Using it

tC Mobile reads the generated packages in `dist/tc-mobile/`, in its template
package format v0. Releases will be git tags (`v0.1.0` onward).

## Development

```
npm ci
npm run verify
```

## Licence

- Data (`data/`, `dist/`, `sources.json`): [CC BY-SA 4.0](LICENSE).
- Code (`scripts/`, `tests/`, configuration): [MIT](LICENSE-CODE).
- `vendor/tc-mobile/` is copied from unfoldingWord/tc-mobile under its MIT
  licence; see [VENDOR.md](vendor/tc-mobile/VENDOR.md).
