# Why this exists — the vision

**`brainstem.py` is an operating system for on‑device AI agent swarms** — and this is the moment
distributed AI stops being a developer's science project and becomes something a nontechnical person
just *uses*, the way the personal computer did that for software.

## The thesis

- **The brainstem is the OS.** It runs the agents — the intelligence layer — **on the user's own
  device**. Autonomous agent swarms, at scale, locally.
- **Regular people never see that.** They see **RACon** — the console — and they run **apps**
  (rapplications) by dropping in **`.egg` cartridges** (eggs that incubate and hatch into twins),
  exactly the way you run software on a personal computer or pop a cartridge into a console.
- **It can ship preloaded, out of the factory.** A device can come with the brainstem already on it
  and a shelf of **out‑of‑the‑box rapplications** — the same way personal computers have shipped with
  productivity software for business users for decades. Any compliant device speaks this protocol.
- **It runs on device, on your own account.** Just a **GitHub account** is the identity *and* the
  runtime for the intelligence layer. No cloud account, no servers, no data leaving the machine —
  unless the user *kites* it on purpose.
- **The kited layer is the web of this agentic ecosystem.** The way the web connected computers, the
  kite connects your devices and your twins: cross‑device, multiplayer, sealed end‑to‑end. Your
  apps, anywhere you are, and shareable with people you trust.

## The stack, one line each

| Layer | In this ecosystem |
|-------|-------------------|
| **Operating system** | `brainstem.py` — runs the agents on your device |
| **Desktop / console** | **RACon** — the user‑facing layer; all anyone has to know |
| **Apps** | **rapplications**, shipped as **`.egg` cartridges** that hatch into twins |
| **Identity + runtime** | your **GitHub account** — the only account you need |
| **Network** | the **kited layer** — the web that links every device + twin; **MCP** is the second on‑ramp — external AI hosts call into a brainstem's `/chat` (the kite links *your* devices/twins; MCP lets any AI host reach one) |

## Why it matters

For decades, "an operating system with apps you just install" is how computing reached everyone.
Distributed AI hasn't had that layer — until now. The brainstem + RACon + `.egg` cartridges + the
kited layer is that stack for AI agents: **on‑device, ownable, preloadable, and connected** — a
productivity layer for business users and everyone else, running on intelligence they fully control
with nothing but a GitHub account.

---

The how: [ECOSYSTEM.md](ECOSYSTEM.md) (v1 release notes) · the experience: [racon](https://github.com/kody-w/racon) ·
the live state: [rapp‑god](https://kody-w.github.io/rapp-god/). MIT © Kody Wildfeuer.
