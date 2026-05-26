# RAPP Ecosystem — v1.0.0 release notes

**First full‑ecosystem snapshot · 2026‑05‑26.** Every repo below is tagged `v1.0.0`; the live registry
of every part *and every version* is **[rapp‑god](https://kody-w.github.io/rapp-god/)** (release 1.0.0).

---

## What RAPP is, in one breath

Single‑file Python **agents** run in a **brainstem**. Brainstems meet as uniform peers in a **kited
neighborhood** — sealed end‑to‑end, joined by scanning a code — so your AI follows *you* across your
devices. Whole apps ship as **cartridges** (`agent.py` + `.egg`) that **hatch into their own twins**
on their own ports instead of crowding the host. **RACon** is the console you actually see; **rapp‑god**
is the god's‑eye registry that watches the entire ecosystem for drift. Everything is served off plain
GitHub raw data — no servers.

## The stack, top to bottom

| Layer | What it is | Repos |
|-------|------------|-------|
| **User‑facing** | the console + the cartridge unit | `racon` (experience grail) · `rapp-carts` (cartridge spec) |
| **Cartridges** | apps/games/tools as portable twins | `cowork-cookbook-rapp` (first cartridge) · `RAPP_Store` (catalog) |
| **Twin runtime** | how a cartridge runs in isolation | `RAPP_Store` SPEC §13 (`runtime:"twin"`) · `rapp-brainstem-sdk` · `vbrainstem` |
| **Kited neighborhood** | cross‑device + multiplayer, sealed | `rapp-neighborhood-protocol` · `rapp-sealed` · `rapp-kite` · `rapp-doorman` · `rapp-kited-twin` |
| **Registry & observability** | the index + drift watch | `rapp-god` · `rapp-static-apis` · `rapp-map` · `RAR` |
| **Platform & apps** | agents, templates, clients | `RAPP` · `ai-agent-templates-mirror` · `rapp-demos` · `rapp-agents` · `aibast-agents-library` · `rapp-egg-hub` · `rapp-zoo` · `RAPP_Desktop` · `rapp-installer` · `rapp-vscode-extension` · `rapp-claude-skills` |
| **Memory, commons & social** | persistence + the public square | `CommunityRAPP` · `rapp-commons` · `rappterbook` |
| **Neighborhood instances** | live examples | `microsoft-se-team-neighborhood` · `neighborhood-example` · `RAPP-Network` · `rapp-test-neighbor` |

## Highlights of v1

- **RACon (RAPP Agent Console).** The user‑facing layer: drop a **cartridge** — an `agent.py` or an
  `.egg` — and it runs as its own twin, with its own workspace + persona. `brainstem.py` is the
  bootloader; everything technical is under the hood. **vRACon** is the same thing in the browser
  (Pyodide), and **RACon Kited** adds cross‑device use + multiplayer over the kited twin pattern.
- **Twin‑port runtime (RAPP Store SPEC §13).** A rapplication hatches as its own twin on its own
  port and is reached over **twin‑chat** — so dropping many apps never crowds the host's agents.
- **The kited twin.** Your AI runs where your data lives; reach and drive it from any device by
  scanning a code. Sealed end‑to‑end (AES‑256‑GCM), with a **cross‑device PIN** confirmation before
  any sync.
- **rapp‑god.** A god's‑eye registry of the whole ecosystem and **every version of every part**, kept
  as content‑addressed fallback frames. Observe‑only drift detection — a fork is "an update waiting,"
  never an auto‑fix.
- **rapp‑static‑apis.** The pattern for read‑only APIs served entirely off `raw.githubusercontent.com`
  — no server. rapp‑god is the reference implementation.
- **First cartridge:** the **Cowork Cookbook** vTwin — turns community Cowork recipes into single‑file
  agents with WorkIQ access, shipped as a portable `.egg` you load with one `agent.py`.
- **First example rapplication:** **Bill's CoE Starter Kit** in the RAPP Store — bootstraps an
  outcome‑first agent team into a brainstem.

## Get started

- **As a user:** open **RACon**, drop a cartridge, use it. Take it with you and share it (RACon Kited).
- **As a builder:** read **[rapp‑carts](https://github.com/kody-w/rapp-carts)** (the cartridge spec) and
  the **[RAPP Store SPEC](https://github.com/kody-w/RAPP_Store/blob/main/SPEC.md)** (`runtime:"twin"`).
  Ship a static API with **[rapp‑static‑apis](https://github.com/kody-w/rapp-static-apis)**.
- **The north star:** **[racon](https://github.com/kody-w/racon)** — the frozen experience grail.
- **The live state:** **[rapp‑god](https://kody-w.github.io/rapp-god/)** — every part, every version,
  drift in real time.

## Snapshot facts

- **33 repos** tagged `v1.0.0` (2026‑05‑26).
- **rapp‑god release 1.0.0** — 42 parts tracked, 116 versions held, a map of 38 repos.
- Served off **GitHub raw data**; the registry CI re‑runs every 6h to keep the *live* view current
  while the `v1.0.0` tags hold this snapshot fixed.

## Principles

- **One `.py` per agent.** No manifests, no subdirectories — the file is the package.
- **One canonical home per concept.** Consumers reference it; CI/rapp‑god guard against drift.
- **Cartridges are the only unit a user knows** (`agent.py` / `.egg`); RACon is the only surface.
- **Observe, don't fix.** Drift is surfaced, never silently reconciled — a drifted copy might be the
  keeper.
- **No servers.** It's all single files, brainstems, and raw GitHub data.

MIT © Kody Wildfeuer. The map of where each part lives: [rapp‑map](https://github.com/kody-w/rapp-map).
