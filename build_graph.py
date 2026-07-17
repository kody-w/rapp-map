#!/usr/bin/env python3
"""Generate the deterministic RAPP/1 relationship map without network imports.

Format 2 separates technical ``conforms_to`` edges to the pinned protocol
authority from section 11 ``subordinate_to`` edges to the federal source.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
AUTHORITY_PATH = ROOT / "RAPP1_AUTHORITY.json"
DEFAULT_OUTPUT = ROOT / "graph.json"

EXPECTED_AUTHORITY = {
    "document_type": "rapp-1-authority-pin",
    "repository": "kody-w/rapp-1",
    "commit": "6723c7add2aed36bb68992fc71a56b0a4bd5ad81",
    "spec_path": "SPEC.md",
    "spec_revision": 5,
    "raw_url": (
        "https://raw.githubusercontent.com/kody-w/rapp-1/"
        "6723c7add2aed36bb68992fc71a56b0a4bd5ad81/SPEC.md"
    ),
    "bytes": 41880,
    "sha256": "6d06daba65d7c045716f3d6e95db8401ab58e727820e4114466d847f62cae49b",
    "structural_pin_only": True,
    "authenticated_registry_acceptance": False,
}


def load_authority() -> dict[str, Any]:
    try:
        authority = json.loads(AUTHORITY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot load {AUTHORITY_PATH.name}: {error}") from error

    for key, expected in EXPECTED_AUTHORITY.items():
        if authority.get(key) != expected:
            raise ValueError(
                f"{AUTHORITY_PATH.name}.{key} must be {expected!r}, "
                f"found {authority.get(key)!r}"
            )
    return authority


def build_graph(authority: dict[str, Any]) -> dict[str, Any]:
    nodes = [
        {
            "id": "rapp-1",
            "repo": authority["repository"],
            "classification": "protocol-authority",
            "role": "Exact rev-5 technical protocol authority.",
            "protocol_authority": True,
            "federal_canonical_source": False,
            "pinned_commit": authority["commit"],
        },
        {
            "id": "RAPP",
            "repo": "kody-w/RAPP",
            "classification": "federal-canonical-source",
            "role": "Federal canonical source named by RAPP/1 section 11.",
            "protocol_authority": False,
            "federal_canonical_source": True,
            "pinned_commit": None,
        },
        {
            "id": "rapp-map",
            "repo": "kody-w/rapp-map",
            "classification": "router-mirror",
            "role": "Read-only structural map and historical observation holder.",
            "protocol_authority": False,
            "federal_canonical_source": False,
        },
        {
            "id": "rapp-god",
            "repo": "kody-w/rapp-god",
            "classification": "observation-mirror",
            "role": "External observation surface; moving or unsigned state is not authority.",
            "protocol_authority": False,
            "federal_canonical_source": False,
        },
        {
            "id": "RAPP-Bible",
            "repo": "kody-w/RAPP-Bible",
            "classification": "documentation-mirror",
            "role": "Human documentation surface; not a protocol or trust authority.",
            "protocol_authority": False,
            "federal_canonical_source": False,
        },
    ]

    return {
        "document_type": "repository-relationship-map",
        "format_version": 2,
        "generated_by": "build_graph.py",
        "generation": "deterministic-network-free",
        "disposition": {
            "classification": "structural-map",
            "authoritative": False,
            "rapp1_registry": False,
            "registry_provenance": None,
            "owner_acceptance": False,
        },
        "protocol_authority": {
            "repository": authority["repository"],
            "commit": authority["commit"],
            "spec_path": authority["spec_path"],
            "spec_revision": authority["spec_revision"],
            "raw_url": authority["raw_url"],
            "bytes": authority["bytes"],
            "sha256": authority["sha256"],
        },
        "federal_canonical_source": {
            "repository": "kody-w/RAPP",
            "commit": None,
            "basis": "RAPP/1 rev-5 section 11 Router/Mirror subordination.",
        },
        "edge_semantics": {
            "conforms_to": (
                "Declares the technical RAPP/1 protocol target only; not owner "
                "acceptance or section 13 provenance."
            ),
            "subordinate_to": (
                "Declares mandatory Router/Mirror subordination to the section 11 "
                "federal canonical source."
            ),
        },
        "nodes": nodes,
        "edges": [
            {
                "from": "RAPP",
                "to": "rapp-1",
                "type": "conforms_to",
            },
            {
                "from": "rapp-map",
                "to": "rapp-1",
                "type": "conforms_to",
            },
            {
                "from": "rapp-map",
                "to": "RAPP",
                "type": "subordinate_to",
            },
            {
                "from": "rapp-god",
                "to": "rapp-1",
                "type": "conforms_to",
            },
            {
                "from": "rapp-god",
                "to": "RAPP",
                "type": "subordinate_to",
            },
            {
                "from": "RAPP-Bible",
                "to": "rapp-1",
                "type": "conforms_to",
            },
            {
                "from": "RAPP-Bible",
                "to": "RAPP",
                "type": "subordinate_to",
            },
        ],
    }


def render_graph() -> bytes:
    graph = build_graph(load_authority())
    return (json.dumps(graph, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate graph.json without timestamps or network-capable imports."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if the committed output differs; do not write",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="output path (default: graph.json beside this script)",
    )
    return parser.parse_args()


def main() -> int:
    if sys.version_info < (3, 11):
        print("build_graph.py requires Python 3.11 or newer", file=sys.stderr)
        return 2

    args = parse_args()
    output = args.output if args.output.is_absolute() else ROOT / args.output

    try:
        candidate = render_graph()
        if candidate != render_graph():
            raise ValueError("generator produced different bytes on consecutive renders")
    except ValueError as error:
        print(f"GRAPH ERROR: {error}", file=sys.stderr)
        return 2

    if args.check:
        try:
            current = output.read_bytes()
        except OSError as error:
            print(f"GRAPH STALE: cannot read {output}: {error}", file=sys.stderr)
            return 1
        if current != candidate:
            print(f"GRAPH STALE: regenerate {output.name} with build_graph.py", file=sys.stderr)
            return 1
        print(
            f"GRAPH PASS: {output.name} is deterministic and current "
            "(network-free by construction)"
        )
        return 0

    output.write_bytes(candidate)
    print(
        f"GRAPH WROTE: {output} ({len(candidate)} bytes, "
        "network-free by construction)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
