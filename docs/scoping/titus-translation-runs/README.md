# Titus translation runs: ledgers

The run ledgers behind
[titus-translation-comparison.md](../titus-translation-comparison.md), kept
so a reviewer can check the ledger sums, model ids and verdict counts, not
only the printed arithmetic (#63). Each `run.json` is the ledger the runner
(`scripts/translate/titles.ts`) or the checker (`scripts/translate/check.ts`)
wrote on 2026-10-29: inputs and their SHA-256, every call (OpenRouter
generation id, the model that answered, prompt, completion and reasoning
tokens, cost in US dollars, milliseconds), why the run stopped, and its
summary. A ledger holds no API key.

**Withheld until #64 closes.** The per-language files (`<lang>/TIT.json`:
each translated title, and each check's verdict, reason and suggestion) are
not committed. A blind review of these titles (#64) is running, and the
files would show which model wrote which title. They are kept outside the
repository by the session that made them, to be committed when #64 closes.

## Runs

| Directory                | What                                       | Languages with a call          | Calls | Cost (USD) | Stop      |
| ------------------------ | ------------------------------------------ | ------------------------------ | ----: | ---------: | --------- |
| `tr-gemini`              | translation, `google/gemini-3.8-flash`     | all 9                          |     9 |  0.2138175 | done      |
| `tr-claude`              | translation, `anthropic/claude-sonnet-5.5` | all 9                          |     9 |   0.419606 | done      |
| `ck-by-claude`           | Claude checks `tr-gemini`                  | none                           |     0 |          0 | 402 at ar |
| `ck-by-claude-2`         | Claude checks `tr-gemini`                  | ar, es-419, fr, hi             |     4 |   0.251604 | 402 at id |
| `ck-by-claude-3`         | Claude checks `tr-gemini`                  | none                           |     0 |          0 | 402 at id |
| `ck-by-claude-4`         | Claude checks `tr-gemini`                  | id, pt-BR                      |     2 |   0.125972 | 402 at ru |
| `ck-by-claude-5`         | Claude checks `tr-gemini`                  | ru                             |     1 |   0.059832 | 402 at sw |
| `ck-by-claude-6`         | Claude checks `tr-gemini`                  | none                           |     0 |          0 | 402 at sw |
| `ck-by-claude-7-sw`      | Claude checks `tr-gemini`                  | none                           |     0 |          0 | 402 at sw |
| `ck-by-claude-7-zh-Hans` | Claude checks `tr-gemini`                  | zh-Hans                        |     1 |   0.021826 | done      |
| `ck-by-claude-8-sw`      | Claude checks `tr-gemini`                  | none                           |     0 |          0 | 402 at sw |
| `ck-by-claude-9-sw`      | Claude checks `tr-gemini`                  | none                           |     0 |          0 | 402 at sw |
| `ck-by-claude-10-sw`     | Claude checks `tr-gemini`                  | sw                             |     1 |   0.066006 | done      |
| `ck-by-gemini`           | Gemini checks `tr-claude`                  | ar, es-419, fr                 |     3 | 0.06916875 | 402 at hi |
| `ck-by-gemini-2`         | Gemini checks `tr-claude`                  | hi, id, pt-BR, ru, sw, zh-Hans |     6 |   0.141846 | done      |
| `smoke/tr-gemini`        | 4-title smoke test, Gemini translation     | fr, ar                         |     2 | 0.00411075 | done      |
| `smoke/ck-claude`        | smoke test, Claude check                   | fr, ar                         |     2 |    0.00583 | done      |

A 402 is OpenRouter refusing a call for credit. The ledgers record no call
for it and the response carried no usage, so we infer it was not billed (not
checked against the OpenRouter activity log). The next check run started
from the language the last one stopped at. Each language has exactly one check call by each checker:
Claude's 9 are in `ck-by-claude-2`, `-4`, `-5`, `-7-zh-Hans` and
`-10-sw`, Gemini's 9 in `ck-by-gemini` and `ck-by-gemini-2`. Each check
ledger names the translation run it read by the SHA-256 of that run's
`run.json` (`translation.sha256`), which matches the committed
`tr-*/run.json`. The `translation.run` paths are where the runs were kept
on the machine that made them; the checker now writes that path relative to
the repository, or null for a run kept outside it (#83), and these ledgers
are left as written.

Measured from these files, once with
`jq -s '[.[].calls[].cost] | add'` over each group and once in Python:

- Titus run, all 15 ledgers: 36 calls, $1.36967825 ($0.2138175 +
  $0.419606 translating, $0.52524 Claude checking, $0.21101475 Gemini
  checking).
- Smoke test, 2 ledgers: 4 calls, $0.00994075.

## Changed from the originals

One ledger is changed: in `ck-by-claude-3/run.json` the 402 message quoted
an OpenRouter key-settings URL ending in an account identifier, which is
replaced by `[redacted]`. Every other file is byte for byte as written.

| File                              | SHA-256 as written                                                 | As committed                                                       |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `ck-by-claude-10-sw/run.json`     | `c1511ba97a7c05eff9d66deda1877df3f153fb58b28a7f6b0a6db026b4e60f28` | same                                                               |
| `ck-by-claude-2/run.json`         | `00d528f50bada27c7f65365eaf9d8e6efb1fb04e16f7207c5c18a4d3b809c3dd` | same                                                               |
| `ck-by-claude-3/run.json`         | `06a000437a3e6601b944b522012d305b0194d9c8dd6756f9a7ca724e1d5ca7b6` | `376f549852cacc7c9e5bc85344e2a0fd9ff25034a48ca47f4c5a0dff11e03608` |
| `ck-by-claude-4/run.json`         | `5c93a279449fa53f83d89ab1c44f13f30989bd44a0e00523cebffb287c186f61` | same                                                               |
| `ck-by-claude-5/run.json`         | `4441859cb4fbd0e1834537b74bb95151e425cc3d0272f632e7b54834b2444479` | same                                                               |
| `ck-by-claude-6/run.json`         | `ce8ad0b0b081f9d071067263e87da4360b0581862f80cb5e3f234dade5979ae8` | same                                                               |
| `ck-by-claude-7-sw/run.json`      | `bec07abc068e196fbe36c00e673f1e71c486edb426c058b042f0d60f3b7ce7bc` | same                                                               |
| `ck-by-claude-7-zh-Hans/run.json` | `b5d64705969a75feb4016773de26329b9a2daf62c5880930cc97f9913c4c2375` | same                                                               |
| `ck-by-claude-8-sw/run.json`      | `20bf328d8ba4ecf51458965707a69cd3258a195fd0425b1b1d4b2bfb674ad26c` | same                                                               |
| `ck-by-claude-9-sw/run.json`      | `0abf4eafc5ef98a99c915f3e00722d00d3817f48ad69c75751542179fa897894` | same                                                               |
| `ck-by-claude/run.json`           | `7d28905b6f3122b6e0c1cfb3fbb77a3770751406ad92b6e3377c5d3c94305f4b` | same                                                               |
| `ck-by-gemini-2/run.json`         | `b543e851c0fa134e1f1709451a8d5d116cf0314dc2ce9199c5a9e728d1160040` | same                                                               |
| `ck-by-gemini/run.json`           | `9a033ebd00859932d0d0b2916ab67cbe1b1eadc87195df0b4288319a8051f975` | same                                                               |
| `smoke/ck-claude/run.json`        | `20da1aa780dca8c9be8dbe2430e1f98ac364ba37909f010ab49f36285682b447` | same                                                               |
| `smoke/tr-gemini/run.json`        | `cf764383f13db7251fb00dcc5f5c8905dc8c12ee66f21f7e17a0a0223ce31b80` | same                                                               |
| `tr-claude/run.json`              | `66f0fd2e5ee7c185572fae5b6c5ea2010090ec47e36d93d53aea4e97fc67ce27` | same                                                               |
| `tr-gemini/run.json`              | `31f428b3e32413f74b4f2c2c95f5528ea17a1b3b8258d7e3f280e1c83daec9a0` | same                                                               |

## Re-derivation

`rederive.py` is the independent second count used for the comparison: it
reads per-call ledger entries and the per-language files, never a
`summary` block. It needs the withheld `<lang>/TIT.json` files, so it can be
run in full only once they are committed (#64). Before it reads any of
them it stops if a check ledger's `translation.sha256` is not the SHA-256 of
the translation run's `run.json`, or if two check ledgers both have a call
for one language (#83); those guards need only the committed ledgers. As it
was run for the comparison, from this directory:

```
python3 rederive.py tr-gemini ck-by-claude-2 ck-by-claude-4 ck-by-claude-5 ck-by-claude-7-zh-Hans ck-by-claude-10-sw
python3 rederive.py tr-claude ck-by-gemini ck-by-gemini-2
```

The ledger sums above need only the committed files.
