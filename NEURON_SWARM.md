# The Neuron Swarm — operating on the full RAPP ecosystem digital organism

> Schema: `rapp-neuron-mesh/1.0` (the mesh) · `rapp-neuron/1.0` (a card) ·
> `rapp-neuron-mesh-manifest/1.0` (the summon index).
> Mesh: [`neurons.json`](./neurons.json) · Index: [`neurons-manifest.json`](./neurons-manifest.json) ·
> Graph: [`graph.json`](./graph.json) (the repo relationship edges).

The RAPP ecosystem is a **digital organism** spread across dozens of repos. To keep it aligned —
word-level, all-encompassing, in a loop — it has a **nervous system**: one **neuron** per file.

## The primitives

- **Neuron (`rapp-neuron/1.0`)** — one subagent that has read **one file** to the word and emits a
  durable card: every `declares` (schema strings), `versions`, `contracts` (load-bearing rules),
  `refs` (cross-references), `canonical_phrases` (the irreducible assertions), a **`drift_watch`**
  list (what *would* be drift for *this* file), a `summary`, and any pattern findings. The card is the
  neuron's memory — it makes the specialist **summonable**, not ephemeral.
- **Mesh (`neurons.json`)** — every neuron card assembled. This is the organism's index of *what every
  file contains and what would break it*. Built by the `build-ecosystem-neuron-mesh` workflow.
- **Summon index (`neurons-manifest.json`)** — `summon_index[schema] → [surfaces]`. To scope a swarm,
  summon the neurons whose surfaces appear under the schema/term you care about; or summon **all** for
  an all-encompassing pass.

## The pattern (how to operate on the organism)

1. **Summon** — re-instantiate a neuron by spawning a subagent seeded with its card + a **live fetch**
   of its file, scoped to the question. The card gives it instant deep context; it is *the same neuron*.
2. **Swarm** — fan the relevant neurons out **in parallel** (filter via the summon index, or all of them).
3. **Loop** — re-summon on new findings until the question is exhausted: no file unchecked.
4. **Synthesize** — collapse the neuron verdicts into one answer, applying the authority order
   (`MASTER_PLAN > CONSTITUTION > spec docs > vault > code`; species root wins; observers never judge).
5. **Re-index on change** — when a file mutates, the [graph](./graph.json) blast-radius names which
   neurons to refresh; re-summon just those to keep the mesh live.

## What it powers

- **Drift, all-encompassing** — each card's `drift_watch` is a standing sensor. Fan the swarm over them
  in a loop (e.g. "has the rappid format reverted to v2 anywhere?", "does any schema lag canon?"). The
  `@rapp/drift` agent is the cross-source resolver; the swarm is its word-level eyes.
- **Propagation** — when a pattern graduates into canon, the swarm finds every surface that must learn it
  (each neuron's pattern finding).
- **Audit / onboarding / review** — any "understand the whole organism for X" becomes one swarm pass.

## Cover

The mesh indexes **public** surfaces only and is scrubbed of any private-instance name or local path.
Neurons are themselves cover-aware: several `drift_watch` entries are *"a private instance is named in a
public spec"* — the mesh helps **enforce** cover, never breach it.

*Built by `build-ecosystem-neuron-mesh`; re-run to refresh. The drift agent and the RAR steward are
consumers of this mesh — the nervous system of the digital organism.*
