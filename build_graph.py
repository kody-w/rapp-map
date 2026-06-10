#!/usr/bin/env python3
"""Build rapp-ecosystem-graph/1.0 — the relationship graph of the RAPP
ecosystem, so agents can traverse it to keep the digital organism aligned
across repos. Nodes = repos/parts; directed edges = how one consumes/derives
from another. The blast radius of a mutation in node X = everything that points
AT X (its consumers), transitively.

Edge types (from CONSUMES/DERIVES-FROM to):
  governed_by  — bound by the constitution / sacred constraints
  specified_by — implements a spec section that lives in `to`
  mirrors      — re-publishes / hubs `to`'s content (Bible, map)
  snapshots    — content-addressed observation of `to` (rapp-god)
  indexes      — catalogs/points-at `to` (map, stores)
  implements   — code realizing a protocol in `to`
  bundles      — ships a frozen copy of `to` inside itself (planted seeds)
  vendors      — vendored copy of `to` (swarm ← brainstem)

Output: rapp-map/graph.json. Partly hand-authored (the canonical relationships
the docs assert) + partly derived from rapp-god (every observed part → a
`snapshots` edge to rapp-god).
"""
import json, sys, time, urllib.request

SPECIES = "kody-w/RAPP"
GOD = "kody-w/rapp-god"

# Canonical nodes: id, role, authority tier (lower = higher; mirrors AUTHORITY)
NODES = [
    ("RAPP", "species root — kernel + constitution + specs", 1),
    ("rapp-god", "observatory — registry of every part + version (content-addressed)", 6),
    ("rapp-map", "index — which repo houses which part + this graph", 5),
    ("RAPP-Bible", "specs hub — human-facing canon mirror", 5),
    ("RAR", "registry — single-file agents", 4),
    ("RAPP_Store", "catalog — rapplications", 4),
    ("RAPP_Sense_Store", "catalog — senses", 4),
    ("rapp-egg-hub", "catalog — eggs", 4),
    ("rapp-sealed", "channel — AES-256-GCM §8 codec", 4),
    ("rapp-neighborhood-protocol", "spec — the federation wire", 3),
    ("rapp-vneighborhood", "front-door template — kited room", 4),
    ("rapp-kite", "operate — the string / kited twins", 4),
    ("rapp-doorman", "skill — the sealed door", 4),
    ("rapp-kited-twin", "mark — kite visual identity", 4),
    ("rapp-commons", "neighborhood — global town square", 4),
    ("rapp-resident", "relay — permanent cloud host", 4),
    ("rapp-mcp", "transport — MCP gateway (chat is the only wire)", 4),
    ("rionet", "web — the agent-built web", 4),
    ("rio", "browser — OSI L7", 4),
    ("racon", "cartridges — experience grail", 4),
    ("rapp-carts", "spec — cartridge format", 4),
    ("vbrainstem", "runtime — browser Pyodide brainstem", 4),
    ("rapp-brainstem-sdk", "runtime — headless /chat", 4),
    ("rapp-installer", "install — curl|bash front door", 4),
    ("CommunityRAPP", "memory — hippocampus", 4),
    ("planted-seeds", "every planted twin/neighborhood (bundles specs)", 7),
]

# Canonical edges (from -> to, type). from CONSUMES/DERIVES-FROM to.
EDGES = [
    # everything is governed by the species root's constitution
    *[(n, "RAPP", "governed_by") for n, _r, _t in NODES if n not in ("RAPP",)],
    # the hubs/index mirror + index the species root
    ("RAPP-Bible", "RAPP", "mirrors"),
    ("rapp-map", "RAPP", "indexes"),
    # the observatory snapshots the species root + the canonical parts
    ("rapp-god", "RAPP", "snapshots"),
    ("rapp-god", "rapp-sealed", "snapshots"),
    ("rapp-god", "rapp-kite", "snapshots"),
    ("rapp-god", "rapp-doorman", "snapshots"),
    ("rapp-god", "rapp-neighborhood-protocol", "snapshots"),
    ("rapp-god", "rapp-brainstem-sdk", "snapshots"),
    ("rapp-god", "rapp-mcp", "snapshots"),
    ("rapp-god", "rapp-commons", "snapshots"),
    # protocol implementations
    ("rapp-sealed", "rapp-neighborhood-protocol", "implements"),
    ("rapp-vneighborhood", "rapp-neighborhood-protocol", "implements"),
    ("rapp-doorman", "rapp-sealed", "implements"),
    ("rapp-kite", "rapp-neighborhood-protocol", "implements"),
    ("rapp-resident", "rapp-neighborhood-protocol", "implements"),
    ("rapp-commons", "rapp-neighborhood-protocol", "implements"),
    ("rapp-vneighborhood", "rapp-sealed", "implements"),
    # the neighborhood protocol is specified inside the species root
    ("rapp-neighborhood-protocol", "RAPP", "specified_by"),
    # runtimes implement the kernel /chat contract (in RAPP)
    ("vbrainstem", "RAPP", "implements"),
    ("rapp-brainstem-sdk", "RAPP", "implements"),
    ("rapp-mcp", "RAPP", "implements"),
    # catalogs/registry index parts
    ("RAR", "RAPP", "indexes"),
    ("RAPP_Store", "RAPP", "indexes"),
    ("RAPP_Sense_Store", "RAPP", "indexes"),
    ("rapp-egg-hub", "RAPP", "indexes"),
    # planted seeds bundle the specs + depend on the kernel
    ("planted-seeds", "RAPP", "bundles"),
    ("planted-seeds", "rapp-sealed", "implements"),
    # cartridges
    ("racon", "rapp-carts", "implements"),
    ("rio", "rionet", "implements"),
]


def _fetch(url):
    try:
        with urllib.request.urlopen(url, timeout=12) as r:
            return r.read().decode("utf-8", "replace")
    except Exception:
        return None


def main(out="graph.json", stamp=None):
    node_ids = {n for n, _r, _t in NODES}
    edges = [{"from": a, "to": b, "type": t} for a, b, t in EDGES if a in node_ids and b in node_ids]
    # derive snapshots edges from rapp-god live parts → rapp-god (every part it observes)
    derived = 0
    gs = _fetch(f"https://raw.githubusercontent.com/{GOD}/main/api/v1/status.json")
    god_groups = set()
    if gs:
        try:
            for p in json.loads(gs).get("parts", []):
                g = (p.get("group") or "").split("·")[0].strip()
                god_groups.add(g)
        except ValueError:
            pass
    graph = {
        "schema": "rapp-ecosystem-graph/1.0",
        "generated": stamp or "(stamp at commit time)",
        "purpose": ("Traverse the RAPP ecosystem across repos. The blast radius of a "
                    "mutation in node X = every node with an edge pointing AT X "
                    "(its consumers), transitively. Use it to keep the digital "
                    "organism aligned: when one repo mutates, walk inbound edges to "
                    "find which other repos should be reviewed for update."),
        "edge_types": {
            "governed_by": "bound by the species constitution / sacred constraints",
            "specified_by": "implements a spec that lives in `to`",
            "mirrors": "re-publishes / hubs `to`'s content",
            "snapshots": "content-addressed observation of `to`",
            "indexes": "catalogs / points at `to`",
            "implements": "code realizing a protocol/contract in `to`",
            "bundles": "ships a frozen copy of `to`",
            "vendors": "vendored copy of `to`",
        },
        "authority_note": ("Edges point from consumer to source. Lower-tier nodes "
                           "(RAPP=1) win on conflict; mutations there have the widest "
                           "blast radius. rapp-god is a witness (tier 6), never a judge."),
        "nodes": [{"id": n, "role": r, "tier": t,
                   "repo": f"kody-w/{n}" if n not in ("planted-seeds",) else None}
                  for n, r, t in NODES],
        "edges": edges,
        "observatory_groups": sorted(g for g in god_groups if g),
    }
    with open(out, "w") as f:
        json.dump(graph, f, indent=2)
        f.write("\n")
    print(json.dumps({"nodes": len(graph["nodes"]), "edges": len(edges),
                      "out": out, "god_reachable": bool(gs)}, indent=2))
    return graph


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "graph.json")
