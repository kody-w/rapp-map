# The spine

The estate's vertebrae: a derived map, a canon-drift oracle, and a chain of
snapshots.

## The problem it was built for

`estate-map.json` used to be **authored**. Its own purpose field said every repo
was "scanned then verifier-rechecked" — by a person or an agent going and
looking. On 2026-07-25 that map was **27 days stale**, knew **92 repos where 400
existed**, and had never heard of 86 rapp-named repos including an entire
release train.

A hand-built map is a photograph. The estate was using it as a mirror.

The first mechanical scan found what the photograph could not:

| canon file | versions | repos holding it |
|---|---:|---:|
| `CONSTITUTION.md` | **22** | 24 |
| `agents/basic_agent.py` | **10** | 58 |
| `specs/SPEC.md` | 5 | 7 |
| `RAPP1_AUTHORITY.json` | 3 | 3 |
| `rapp_brainstem/agents/basic_agent.py` | 2 | 25 |

Zero canon files aligned. `basic_agent.py` is the file RAPP/1 §11.2 calls
"universal DNA".

## The three layers, and why they are separate files

| layer | file | author | fails how |
|---|---|---|---|
| **mechanical** | `spine/observations.json` | the GitHub API | loudly — a failed job |
| **declared** | each repo's `.rapp/heartbeat.json` | the repo itself | absent, harmlessly |
| **curated** | `spine/overlay.json` | a human | goes stale, visibly |

`estate-map.json` is the **merge**, and it is generated. **A human never edits
the output; the generator never writes to the overlay.** That single rule is the
whole design — the previous map died because a human correction and a machine
observation lived in the same file, so nobody could regenerate it without losing
the corrections.

No repo has to opt in. The map is complete without a single heartbeat; declaring
one only adds what a repo says about *itself*, which the API cannot know.

## Why git blob shas

One `git/trees?recursive=1` call returns every path in a repo with its blob sha.
That is **one request per repo** for complete content identity instead of one
per file. Two repos holding a byte-identical `CONSTITUTION.md` share a blob sha,
which is the only question canon drift asks.

## Use

```bash
python3 tools/spine.py collect              # observe (1 API call per repo)
python3 tools/spine.py map                  # rebuild estate-map.json
python3 tools/spine.py drift                # where canon diverges
python3 tools/spine.py gate --ratchet       # fail only if it got WORSE
python3 tools/spine.py snapshot             # freeze a vertebra (.egg, ~20KB)
python3 tools/spine.py diff a.egg b.egg     # exactly what moved
python3 tools/spine.py check v.egg          # a vertebra vs the estate now
```

## The gate is a ratchet, not a wall

Five canon files diverge today. A gate that simply failed on that would be red
from the moment it was installed — and **a permanently red gate is worse than no
gate**, because it also teaches everyone that red means nothing.

So the gate fails only when drift gets *worse* than `spine/drift-baseline.json`,
and tightens that baseline automatically when it improves. The estate is allowed
to be in a bad state. It is not allowed to deteriorate quietly.

Divergence you accept on purpose goes in `spine/waivers.json` with a reason and
an **expiry** — an unexpiring waiver is just permanent drift with paperwork.

## The vertebrae

`spine/vertebrae/estate-<date>.egg` is a `brainstem-egg/2.3-estate` cartridge:
one entry per repo with its head tree sha and the blob shas of its canon files.
**Pointers and digests, never content** — 400 repos fit in about 20 KB, so the
whole chain can be kept forever.

The spine is not a repo. **It is the chain of vertebrae** — a git history for
the whole organism. `spine diff` between any two answers the only question that
matters in an incident: *what changed since the last good state?*
