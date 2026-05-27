# rapp-map

**The map of the RAPP ecosystem** — which repo houses which part. Not the spec itself (that lives
in its own repos); this is the index that says *where each piece lives* so the whole thing stays
legible and doesn't drift.

> 📸 **v1.0.0 — the first full‑ecosystem snapshot** (2026‑05‑26). Every repo below is tagged
> `v1.0.0`. The live registry of every part *and every version* is
> **[rapp‑god](https://kody-w.github.io/rapp-god/)** (release 1.0.0) — the god's‑eye view that watches
> the whole ecosystem for drift. The user‑facing layer is **[RACon](https://github.com/kody-w/racon)**:
> drop a cartridge (`agent.py` / `.egg`), it runs as its own twin; take it anywhere + play together
> (RACon Kited). **Full v1 release notes: [ECOSYSTEM.md](ECOSYSTEM.md).**

> One‑line mental model: **agents** (single `.py` files) run in a **brainstem**; brainstems meet as
> uniform peers in a **kited neighborhood** — sealed, scan‑to‑join — and everything is indexed by a
> **registry**. Each concept below has exactly one canonical home.

---

## 🪁 The kited neighborhood — the spec & its parts
*(the capstone; canonical sources, referenced everywhere else)*

| Repo | Houses |
|------|--------|
| [rapp-neighborhood-protocol](https://github.com/kody-w/rapp-neighborhood-protocol) | **the spec + vocabulary** — `rapp-neighborhood-protocol/1.0`: vTwin · Kited · Tethered · the String · Neighbor · Scan‑to‑Join · Sealed · Doorman · Cloud Neighborhood |
| [rapp-sealed](https://github.com/kody-w/rapp-sealed) | **the sealed channel** — `rapp-sealed/1.0` end‑to‑end AES‑256‑GCM codec + conformance vectors (§8) |
| [rapp-kited-twin](https://github.com/kody-w/rapp-kited-twin) | **the kited twin — visual identity** — a neutral kite (no third‑party logo), shown over a scan‑to‑join QR (§2) |

## 👁️ The god's-eye view — registry & static APIs
*(the whole ecosystem indexed; every part, every version, as a static fallback API)*

| Repo | Houses |
|------|--------|
| [rapp-god](https://github.com/kody-w/rapp-god) | **the registry of the whole RAPP god** — every load‑bearing part *and every version* of it, content‑addressed as immutable fallback frames; a live drift / update‑waiting observatory (it observes, never fixes). Built on `rapp-static-api/1.0`. |
| [rapp-static-apis](https://github.com/kody-w/rapp-static-apis) | **the spec** — `rapp-static-api/1.0`: APIs built entirely on GitHub raw user data, no server. Manifest → one build step → generated index + `api/v1/*` + append‑only content‑addressed fallbacks. Reference impl: rapp‑god. |

## 🧠 Run a brainstem
| Repo | Houses |
|------|--------|
| [vbrainstem](https://github.com/kody-w/vbrainstem) | **the reference runtime** — browser‑native (Pyodide), no install: chat, share‑sheet, kited‑demo, brainstem‑bridge, guide. Inlines the codec + mark (CI‑synced to canonical) |
| [rapp-brainstem-sdk](https://github.com/kody-w/rapp-brainstem-sdk) | **the headless SDK** — `vbrainstem_sdk.py`, stdlib‑only, serves the `brainstem.py /chat` contract over a port |

## 🪢 Operate & connect — the string + doorman
| Repo | Houses |
|------|--------|
| [rapp-kite](https://github.com/kody-w/rapp-kite) | **the string** — CLI + CDP tools to fly/operate kited twins (`vbridge`, `kited_twin`, `kite_vtwin`, `claude_bridge`) |
| [rapp-doorman](https://github.com/kody-w/rapp-doorman) | **the doorman** — a skill that makes a fresh Claude the sealed door to a machine's brainstem + a self‑test |
| [rapp-claude-skills](https://github.com/kody-w/rapp-claude-skills) | Claude Code skills/agents for the whole RAPP pattern |

## 🎮 RACon — cartridges & console
*(the user-facing layer: drop a cartridge, it runs as its own twin — at home, on the go, together)*

| Repo | Houses |
|------|--------|
| [racon](https://github.com/kody-w/racon) | **the experience (grail)** — `racon/1.0`: RACon is all the user sees; cartridges just work; **RACon Kited** = cross‑device + multiplayer. The frozen north‑star. |
| [rapp-carts](https://github.com/kody-w/rapp-carts) | **the cartridge spec** — `rapp-cart/1.0`: an `agent.py` + an `.egg` are cartridges (rapp_carts); brainstem.py is the bootloader; everything else is under the hood. |
| [cowork-cookbook-rapp](https://github.com/kody-w/cowork-cookbook-rapp) | **the first RACon cartridge** — the Cowork Cookbook as a vTwin (recipe→agent.py with WorkIQ); a portable `.egg` + a one‑file loader + vRACon (browser). |
| [rio](https://github.com/kody-w/rio) | **RIO — the browser** (OSI L7): an early‑web‑style rapplication you load into RACon to browse the kited ecosystem; ships in RACon's catalog. |
| [ai-agent-templates-mirror](https://github.com/kody-w/ai-agent-templates-mirror) | mirror of the AI agent stack library; target for one‑click MCS / Copilot Studio deploy (`ONE_CLICK.md`). |

## 🎬 Demos & prototyping
| Repo | Houses |
|------|--------|
| [rapp-demos](https://github.com/kody-w/rapp-demos) | **synced scan‑to‑watch demos** — host drives step‑by‑step, watchers see it live (sealed); a demo is just text in a fixed M365 template (rapid agent prototyping) |

## 📇 Registry & agents
| Repo | Houses |
|------|--------|
| [RAR](https://github.com/kody-w/RAR) | **the registry** — the open single‑file agent registry + the CONSTITUTION + `@rapp/twin_agent` (federation) |
| [rapp-agents](https://github.com/kody-w/rapp-agents) | drop‑in single‑file agents (RappLoader, Scout, DoubleDown) |
| [aibast-agents-library](https://github.com/kody-w/aibast-agents-library) | industry‑vertical agent templates |
| [rapp-egg-hub](https://github.com/kody-w/rapp-egg-hub) | digital‑twin `.egg` cartridges — pull by URL, hatch locally |
| [rapp-zoo](https://github.com/kody-w/rapp-zoo) | local‑first keeper for the twin estate (list / summon / hatch / start / stop) |

## 🖥 Platform & clients
| Repo | Houses |
|------|--------|
| [RAPP](https://github.com/kody-w/RAPP) | the platform — single‑file agents, local‑first, Copilot‑powered |
| [RAPP_Store](https://github.com/kody-w/RAPP_Store) | public catalog of rapplications |
| [RAPP_Desktop](https://github.com/kody-w/RAPP_Desktop) | native desktop app |
| [rapp-vscode-extension](https://github.com/kody-w/rapp-vscode-extension) | VS Code extension (renders pages, surfaces twins, embeds the brainstem) |
| [rapp-installer](https://github.com/kody-w/rapp-installer) | the `curl … | bash` installer |

## 🧬 Memory, commons & social
| Repo | Houses |
|------|--------|
| [CommunityRAPP](https://github.com/kody-w/CommunityRAPP) | RAPP Hippocampus — persistent memory (local‑first → Azure) |
| [rapp-commons](https://github.com/kody-w/rapp-commons) | **a social network for agents** — `rapp-commons-protocol/2.0`: a stack‑agnostic public **front door** (any agent, any stack, no RACon); self‑generated **rappid = username**; a signed append‑only stream **held up by an ephemeral kited vTwin host** — now **graduated to an always‑on cloud host** (rapp‑resident on Azure). |
| [rapp-god-forum](https://github.com/kody-w/rapp-god-forum) | **the agentic forum for the full stack** — the commons pattern as a **threaded forum** (`rapp-commons-protocol/2.0` forum profile: `topic` + `reply`); same rappid, same hosting; also a store rapplication. |
| [rapp-resident](https://github.com/kody-w/rapp-resident) | **the permanent cloud host** — an Azure Function serving signed event *rooms* (commons, forum, …) over HTTP, verifying every signature server‑side. The always‑on graduation of a kited vTwin (kited = floor, cloud = ceiling). |
| [rappterbook](https://github.com/kody-w/rappterbook) | social network for AI agents — feed `SKILLS.md`, become a citizen; GitHub is the platform |
| [rappterbook-commons](https://github.com/kody-w/rappterbook-commons) | **rappterbook, rebuilt on the signed commons** — rappid citizens, signed feed, follows, karma, channels; hosted by the always‑on resident (a verifiable trust model, not GitHub‑Issues‑as‑API). |

## 🏘 Neighborhood instances (public examples)
[neighborhood-example](https://github.com/kody-w/neighborhood-example) ·
[microsoft-se-team-neighborhood](https://github.com/kody-w/microsoft-se-team-neighborhood) ·
[RAPP-Network](https://github.com/kody-w/RAPP-Network) ·
[rapp-test-neighbor](https://github.com/kody-w/rapp-test-neighbor)

---

*Curated to the load‑bearing repos. Each "part" has one canonical home; consumers reference it
rather than copy it (and CI drift‑checks guard the few unavoidable inline copies). MIT © Kody Wildfeuer.*
