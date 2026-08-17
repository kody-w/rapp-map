#!/usr/bin/env python3
"""spine — the estate's vertebrae: derived observation, canon drift, snapshots.

    spine collect                 observe every repo mechanically (no opt-in)
    spine map                     rebuild estate-map.json from observations
    spine drift                   where canon files diverge across the estate
    spine snapshot [-o x.egg]     freeze this moment as an estate vertebra
    spine diff <a.egg> <b.egg>    exactly what moved between two moments
    spine check <vertebra.egg>    that vertebra vs the estate as it is now

WHY THIS EXISTS

`estate-map.json` was authored, not derived. Its own purpose field says every
repo was "scanned then verifier-rechecked" — by a person or an agent reading
repositories. On 2026-07-25 it was 27 days stale, knew 92 repos where 180
existed, and had never heard of 86 of them, including a whole release train.

A hand-built map is a photograph. The estate was using it as a mirror.

THE THREE LAYERS, AND WHY THEY ARE SEPARATE

    mechanical   what is true right now, from the GitHub API. No opt-in, no
                 cooperation required, cannot go stale without failing loudly.
    declared     what a repo says about itself in .rapp/heartbeat.json.
                 Enrichment only — the map is complete without it.
    curated      human judgement (load-bearing, status, intent) in overlay.json.

They are separate files because they have different failure modes and different
authors. Merging them into one hand-edited artifact is exactly how the last map
died: a human correction and a machine observation went into the same file, and
after that nobody could regenerate it without losing the corrections.

**The generator never writes to the overlay, and a human never edits the
output.** That rule is the whole design.

WHY GIT BLOB SHAS ARE THE CONTENT IDENTITY

One `git/trees?recursive=1` call returns every path in a repo with its blob
sha. That is one request per repo for complete content identity, instead of one
request per file. The sha is git's own (sha1 over "blob <len>\\0<content>"), so
two repos holding byte-identical CONSTITUTION.md have the same blob sha — which
is the only question canon drift asks.
"""

import argparse
import base64
import hashlib
import io
import json
import os
import subprocess
import sys
import time
import zipfile

OWNER = os.getenv("SPINE_OWNER", "kody-w")

# Files that MUST be identical wherever they appear. Everything else is allowed
# to differ — 180 repos SHOULD differ, and defining drift over all of them is
# how a drift report becomes noise nobody reads.
CANON = [
    "CONSTITUTION.md",
    "specs/SPEC.md",
    "rapp_brainstem/agents/basic_agent.py",
    "agents/basic_agent.py",
    "RAPP1_AUTHORITY.json",
]

VERTEBRA_SCHEMA = "brainstem-egg/2.3-estate"
OBS_SCHEMA = "rapp-estate-observation/1.0"


def gh(*args, parse=True, quiet=False):
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if r.returncode != 0:
        if quiet:
            return None
        raise RuntimeError(f"gh {' '.join(args[:3])}: {r.stderr.strip()[:200]}")
    return json.loads(r.stdout) if parse and r.stdout.strip() else r.stdout


# ── collect: the mechanical layer ────────────────────────────────────────────

def collect(owner=OWNER, limit=2000, only=None):
    repos = gh("repo", "list", owner, "--limit", str(limit), "--json",
               "name,isArchived,isPrivate,defaultBranchRef,updatedAt,description")
    # If the listing came back exactly at the limit, it was almost certainly
    # truncated — and a truncated listing produces a perfectly well-formed map
    # that is simply missing repos. On 2026-07-25 a --limit of 400 hid 121 of
    # 521 repos, and nothing anywhere said so.
    if len(repos) >= limit:
        raise RuntimeError(
            f"the repo listing returned exactly {len(repos)} for --limit "
            f"{limit}, so it was truncated. Raise --limit; a truncated estate "
            f"is worse than no estate because it looks complete.")
    out, skipped = {}, 0
    for i, r in enumerate(repos, 1):
        name = r["name"]
        if only and name not in only:
            continue
        branch = (r.get("defaultBranchRef") or {}).get("name")
        private = bool(r.get("isPrivate"))
        # A private repo's description is private content. This map is public,
        # so mirroring it here republishes the one field the owner wrote
        # expecting a closed audience. The estate shape (name, visibility,
        # heartbeat) is the public fact; the blurb is not.
        description = "" if private else (r.get("description") or "")[:200]
        rec = {
            "repo": f"{owner}/{name}",
            "archived": bool(r.get("isArchived")),
            "private": private,
            "default_branch": branch,
            "updated_at": r.get("updatedAt"),
            "description": description,
        }
        if not branch or r.get("isArchived"):
            # An archived repo is a real member of the estate and its absence
            # from the map is what let 86 repos go unnoticed. Record it, mark
            # it, and do not spend an API call on its tree.
            out[name] = rec
            skipped += 1
            print(f"  [{i}/{len(repos)}] {name}: "
                  f"{'archived' if r.get('archived') else 'no default branch'}",
                  file=sys.stderr)
            continue

        tree = gh("api", f"repos/{owner}/{name}/git/trees/{branch}?recursive=1",
                  quiet=True)
        if not tree:
            rec["error"] = "tree unreadable"
            out[name] = rec
            continue
        rec["head_tree_sha"] = tree.get("sha")
        rec["truncated"] = bool(tree.get("truncated"))
        blobs = {t["path"]: t["sha"] for t in (tree.get("tree") or [])
                 if t.get("type") == "blob"}
        rec["file_count"] = len(blobs)
        rec["canon"] = {p: blobs[p] for p in CANON if p in blobs}
        # Declared layer, if the repo opted in. Enrichment, never a requirement.
        if ".rapp/heartbeat.json" in blobs:
            hb = gh("api", f"repos/{owner}/{name}/contents/.rapp/heartbeat.json",
                    quiet=True)
            if hb and hb.get("content"):
                try:
                    rec["declared"] = json.loads(
                        base64.b64decode(hb["content"]).decode())
                except Exception:  # noqa: BLE001
                    rec["declared"] = {"error": "heartbeat is not valid JSON"}
        out[name] = rec
        print(f"  [{i}/{len(repos)}] {name}: {len(blobs)} files, "
              f"{len(rec['canon'])} canon", file=sys.stderr)
    private = sum(1 for r in out.values() if r.get("private"))
    return {"schema": OBS_SCHEMA, "owner": owner,
            "observed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "count": len(out), "archived_or_empty": skipped,
            # An observation must state what it could SEE, not only what it
            # found. A token without private scope produces a perfectly
            # well-formed map that is missing a third of the estate.
            "visibility": {"private_visible": private,
                           "token_sees_private": private > 0},
            "repos": out}


def _newest_vertebra(d="spine/vertebrae"):
    if not os.path.isdir(d):
        return None
    eggs = sorted(f for f in os.listdir(d) if f.endswith(".egg"))
    if not eggs:
        return None
    try:
        return read_vertebra(os.path.join(d, eggs[-1]))
    except Exception:  # noqa: BLE001
        return None


def cmd_collect(args):
    obs = collect(args.owner, args.limit,
                  set(args.only.split(",")) if args.only else None)

    # A map may never quietly get smaller. On 2026-07-25 the first scheduled
    # run wrote a map with 103 fewer repos than the local run, because Actions'
    # default GITHUB_TOKEN cannot see other repositories' private repos. The
    # output was valid JSON, the job was green, and a third of the estate had
    # silently vanished. Shrinking is now an error you must opt into.
    prev = _newest_vertebra()
    if prev and not args.allow_shrink:
        was, now = len(prev.get("members") or {}), obs["count"]
        lost = sorted(set(prev.get("members") or {}) - set(obs["repos"]))
        if lost and len(lost) > max(2, int(was * 0.02)):
            print(f"\n  REFUSED: {len(lost)} repo(s) present in the last "
                  f"vertebra are missing from this observation "
                  f"({was} -> {now} members).", file=sys.stderr)
            print(f"  Missing: {', '.join(lost[:8])}"
                  + (" …" if len(lost) > 8 else ""), file=sys.stderr)
            if prev.get("private_visible") and not obs["visibility"]["token_sees_private"]:
                print("  The observer could not see private repos this time — "
                      "almost certainly a token scope problem, not deletions.",
                      file=sys.stderr)
            print("  Fix the token, or pass --allow-shrink if repos really "
                  "were deleted.", file=sys.stderr)
            return 2
    with open(args.out, "w") as fh:
        json.dump(obs, fh, indent=2, sort_keys=True)
        fh.write("\n")
    live = sum(1 for r in obs["repos"].values() if r.get("head_tree_sha"))
    print(f"\n  observed {obs['count']} repos ({live} with a readable tree, "
          f"{obs['archived_or_empty']} archived/empty)")
    print(f"  declared heartbeats: "
          f"{sum(1 for r in obs['repos'].values() if r.get('declared'))}")
    print(f"  wrote {args.out}")
    return 0


# ── drift: canon divergence ──────────────────────────────────────────────────

def canon_groups(obs):
    """For each canon path, group repos by blob sha. More than one group is
    divergence — stated as a fact, with no judgement about which is right."""
    byfile = {}
    for name, rec in obs["repos"].items():
        for path, sha in (rec.get("canon") or {}).items():
            byfile.setdefault(path, {}).setdefault(sha, []).append(name)
    return byfile


def cmd_drift(args):
    with open(args.observations) as fh:
        obs = json.load(fh)
    waivers = {}
    if args.waivers and os.path.isfile(args.waivers):
        with open(args.waivers) as fh:
            waivers = json.load(fh).get("waivers", {})
    groups = canon_groups(obs)
    if not groups:
        print("  no canon files found in any observed repo")
        return 0
    findings, clean = [], []
    for path, bysha in sorted(groups.items()):
        holders = sum(len(v) for v in bysha.values())
        if len(bysha) == 1:
            clean.append((path, holders))
            continue
        w = waivers.get(path) or {}
        findings.append({"path": path, "variants": len(bysha), "repos": holders,
                         "groups": {sha[:12]: sorted(names)
                                    for sha, names in sorted(
                                        bysha.items(), key=lambda kv: -len(kv[1]))},
                         "waiver": w or None})
    print(f"  canon observed at {obs['observed_at']}\n")
    for path, n in clean:
        print(f"  ALIGNED   {path}  ({n} repo(s), one version)")
    if clean:
        print()
    for f in findings:
        tag = "WAIVED  " if f["waiver"] else "DRIFT   "
        print(f"  {tag}  {f['path']}  — {f['variants']} versions "
              f"across {f['repos']} repos")
        for sha, names in f["groups"].items():
            head = ", ".join(names[:6]) + (" …" if len(names) > 6 else "")
            print(f"              {sha}  ({len(names)})  {head}")
        if f["waiver"]:
            print(f"              waiver: {f['waiver'].get('reason','?')} "
                  f"(expires {f['waiver'].get('expires','never')})")
        print()
    unwaived = [f for f in findings if not f["waiver"]]
    print(f"  {len(clean)} canon file(s) aligned, {len(findings)} diverging "
          f"({len(unwaived)} unwaived)")
    if args.strict and unwaived:
        return 1
    return 0


# ── map: the derived estate map ──────────────────────────────────────────────

def cmd_map(args):
    with open(args.observations) as fh:
        obs = json.load(fh)
    overlay = {}
    if args.overlay and os.path.isfile(args.overlay):
        with open(args.overlay) as fh:
            overlay = json.load(fh).get("repos", {})

    members, unknown_overlay = [], []
    for name, rec in sorted(obs["repos"].items()):
        m = {"repo": rec["repo"], "archived": rec["archived"],
             "private": rec["private"], "default_branch": rec.get("default_branch"),
             "updated_at": rec.get("updated_at"),
             "file_count": rec.get("file_count"),
             "head_tree_sha": rec.get("head_tree_sha"),
             "canon": rec.get("canon") or {},
             "description": rec.get("description")}
        if rec.get("declared"):
            m["declared"] = rec["declared"]
        # The curated layer is merged UNDER a reserved key. It never overwrites
        # an observed field, because a stale human note that silently replaces a
        # fresh machine reading is precisely how the last map became fiction.
        if name in overlay:
            m["curated"] = overlay[name]
        members.append(m)
    for name in overlay:
        if name not in obs["repos"]:
            unknown_overlay.append(name)

    out = {
        "schema": "rapp-estate-map/2.0",
        "generated_by": "spine map — DERIVED. Do not hand-edit; edit overlay.json.",
        # `built_at` is kept as an alias of observed_at because rapp-tower's
        # tools/drift.sh reads it. Renaming a field to tidy a schema, and
        # breaking a live consumer to do it, is the exact failure this whole
        # exercise exists to avoid. We do not break userspace.
        "built_at": obs["observed_at"],
        "observed_at": obs["observed_at"],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "owner": obs["owner"],
        "count": len(members),
        "counts": {
            "total": len(members),
            "archived": sum(1 for m in members if m["archived"]),
            "private": sum(1 for m in members if m["private"]),
            "with_heartbeat": sum(1 for m in members if m.get("declared")),
            "curated": sum(1 for m in members if m.get("curated")),
        },
        "canon_paths": CANON,
        "overlay_entries_for_missing_repos": sorted(unknown_overlay),
        "members": members,
    }
    with open(args.out, "w") as fh:
        json.dump(out, fh, indent=2, sort_keys=True)
        fh.write("\n")
    c = out["counts"]
    print(f"  wrote {args.out}")
    print(f"    {c['total']} members  ({c['archived']} archived, "
          f"{c['private']} private)")
    print(f"    {c['with_heartbeat']} declare a heartbeat, "
          f"{c['curated']} carry curated notes")
    if unknown_overlay:
        print(f"    overlay mentions {len(unknown_overlay)} repo(s) that no "
              f"longer exist: {', '.join(unknown_overlay[:5])}")
    return 0


# ── vertebra: freeze a moment ────────────────────────────────────────────────

def vertebra_body(obs):
    """Pointers and digests, never content. A vertebra is kilobytes so the whole
    chain can be kept forever — which is the point of having a spine."""
    return {
        "schema": VERTEBRA_SCHEMA,
        "type": "estate",
        "owner": obs["owner"],
        "observed_at": obs["observed_at"],
        "count": obs["count"],
        "private_visible": (obs.get("visibility") or {}).get("private_visible", 0),
        "canon_paths": CANON,
        "members": {
            name: {"repo": r["repo"], "branch": r.get("default_branch"),
                   "tree": r.get("head_tree_sha"), "files": r.get("file_count"),
                   "archived": r["archived"], "private": r["private"],
                   "canon": r.get("canon") or {}}
            for name, r in sorted(obs["repos"].items())
        },
    }


def cmd_snapshot(args):
    with open(args.observations) as fh:
        obs = json.load(fh)
    body = vertebra_body(obs)
    payload = json.dumps(body, indent=2, sort_keys=True).encode()
    manifest = {
        "schema": VERTEBRA_SCHEMA, "type": "estate",
        "name": f"{obs['owner']} estate",
        "observed_at": obs["observed_at"],
        "members": obs["count"],
        "sha256": hashlib.sha256(payload).hexdigest(),
    }
    out = args.out or f"estate-{obs['observed_at'][:10]}.egg"
    buf = io.BytesIO()
    # ZIP, because Article L.2 says the container shape is local to the kind and
    # the estate kind is specified as ZIP.
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps(manifest, indent=2, sort_keys=True))
        z.writestr("estate.json", payload)
        z.writestr("HATCH.md",
                   "# Estate vertebra\n\nA frozen observation of the estate: one "
                   "entry per repo with its head tree sha and the blob shas of "
                   "its canon files.\n\nThis cartridge holds **no content** — "
                   "only pointers and digests — so a chain of them can be kept "
                   "forever. Compare two with `spine diff`.\n")
    with open(out, "wb") as fh:
        fh.write(buf.getvalue())
    print(f"  wrote {out}  ({os.path.getsize(out):,} bytes, "
          f"{obs['count']} members)")
    print(f"    sha256 {manifest['sha256'][:16]}   observed {obs['observed_at']}")
    return 0


def read_vertebra(path):
    with zipfile.ZipFile(path) as z:
        return json.loads(z.read("estate.json"))


def _diff(a, b):
    am, bm = a["members"], b["members"]
    added = sorted(set(bm) - set(am))
    removed = sorted(set(am) - set(bm))
    moved, canon_changed, archived = [], [], []
    for k in sorted(set(am) & set(bm)):
        x, y = am[k], bm[k]
        if x.get("tree") != y.get("tree"):
            moved.append({"repo": k, "from": (x.get("tree") or "")[:12],
                          "to": (y.get("tree") or "")[:12],
                          "files": (y.get("files") or 0) - (x.get("files") or 0)})
        for p in set(x.get("canon", {})) | set(y.get("canon", {})):
            xs, ys = x.get("canon", {}).get(p), y.get("canon", {}).get(p)
            if xs != ys:
                canon_changed.append({"repo": k, "path": p,
                                      "from": (xs or "absent")[:12],
                                      "to": (ys or "absent")[:12]})
        if x.get("archived") != y.get("archived"):
            archived.append({"repo": k, "archived": y.get("archived")})
    return {"added": added, "removed": removed, "moved": moved,
            "canon_changed": canon_changed, "archived_changed": archived}


def cmd_diff(args):
    a, b = read_vertebra(args.a), read_vertebra(args.b)
    d = _diff(a, b)
    print(f"  {a['observed_at']}  ->  {b['observed_at']}\n")
    if d["added"]:
        print(f"  NEW ({len(d['added'])}): {', '.join(d['added'][:12])}"
              + (" …" if len(d["added"]) > 12 else ""))
    if d["removed"]:
        print(f"  GONE ({len(d['removed'])}): {', '.join(d['removed'][:12])}")
    for c in d["archived_changed"]:
        print(f"  {'ARCHIVED' if c['archived'] else 'UNARCHIVED'}: {c['repo']}")
    if d["canon_changed"]:
        print(f"\n  CANON MOVED ({len(d['canon_changed'])}) — this is the part "
              f"that matters:")
        for c in d["canon_changed"]:
            print(f"    {c['repo']:28} {c['path']:34} {c['from']} -> {c['to']}")
    if d["moved"]:
        print(f"\n  repos with new commits ({len(d['moved'])}):")
        for m in d["moved"][:20]:
            sign = f"{m['files']:+d} files" if m["files"] else "same file count"
            print(f"    {m['repo']:28} {m['from']} -> {m['to']}  ({sign})")
        if len(d["moved"]) > 20:
            print(f"    … and {len(d['moved'])-20} more")
    if not any(d.values()):
        print("  nothing moved.")
    return 0


def cmd_check(args):
    """A vertebra against the estate as it is now. This is the question you
    actually ask in an incident: what has changed since the last good state?"""
    old = read_vertebra(args.vertebra)
    obs = collect(old["owner"], args.limit)
    new = vertebra_body(obs)
    d = _diff(old, new)
    print(f"\n  vertebra {old['observed_at']}  vs  live {new['observed_at']}\n")
    print(f"    new repos:      {len(d['added'])}")
    print(f"    gone:           {len(d['removed'])}")
    print(f"    moved:          {len(d['moved'])}")
    print(f"    canon changed:  {len(d['canon_changed'])}")
    for c in d["canon_changed"]:
        print(f"      {c['repo']:28} {c['path']:34} {c['from']} -> {c['to']}")
    if args.strict and d["canon_changed"]:
        return 1
    return 0


def cmd_gate(args):
    """A ratchet, not a wall.

    Five canon files diverge today. A gate that simply failed on that would be
    red from the moment it was installed, and a permanently red gate is a gate
    everyone learns to ignore — which is worse than no gate, because it also
    teaches people that red means nothing.

    So this fails only when drift gets WORSE than the recorded baseline, and
    ratchets the baseline down automatically when it gets better. The estate is
    allowed to be in a bad state; it is not allowed to deteriorate quietly."""
    with open(args.observations) as fh:
        obs = json.load(fh)
    waivers = {}
    if args.waivers and os.path.isfile(args.waivers):
        with open(args.waivers) as fh:
            waivers = json.load(fh).get("waivers", {})
    groups = canon_groups(obs)
    current = {p: len(bysha) for p, bysha in groups.items()
               if len(bysha) > 1 and p not in waivers}

    base, first_run = {}, not os.path.isfile(args.baseline)
    if not first_run:
        with open(args.baseline) as fh:
            base = json.load(fh).get("variants", {})

    if first_run:
        # The first run records the debt; it does not fail on it. A gate that
        # is red the moment it is installed teaches everyone that red means
        # nothing, which costs more than the gate was ever worth.
        with open(args.baseline, "w") as fh:
            json.dump({"schema": "rapp-drift-baseline/1.0",
                       "recorded_at": obs["observed_at"],
                       "note": "First baseline — the estate's starting debt. "
                               "This file only ever ratchets DOWN.",
                       "variants": current}, fh, indent=2, sort_keys=True)
            fh.write("\n")
        print(f"  first baseline recorded: {len(current)} diverging canon file(s)")
        for p_, n in sorted(current.items()):
            print(f"    {p_:38} {n} versions")
        print("\n  From here the gate fails only if this gets WORSE.")
        return 0

    worse, better, new = [], [], []
    for p, n in sorted(current.items()):
        b = base.get(p)
        if b is None:
            new.append((p, n))
        elif n > b:
            worse.append((p, b, n))
        elif n < b:
            better.append((p, b, n))
    fixed = sorted(set(base) - set(current))

    print(f"  canon observed {obs['observed_at']}\n")
    for p, n in sorted(current.items()):
        b = base.get(p)
        mark = ("NEW  " if b is None else
                "WORSE" if n > b else "better" if n < b else "same ")
        print(f"  {mark:6} {p:38} {n} version(s)"
              + (f"  (was {b})" if b is not None and b != n else ""))
    for p in fixed:
        print(f"  FIXED  {p:38} now aligned")

    if worse or new:
        print(f"\n  FAIL: canon drift increased.")
        for p, b, n in worse:
            print(f"    {p}: {b} -> {n} versions")
        for p, n in new:
            print(f"    {p}: newly diverging ({n} versions)")
        print("\n  Align the file, or record a waiver in "
              f"{args.waivers} with a reason and an expiry.")
        return 1

    if (better or fixed) and args.ratchet:
        with open(args.baseline, "w") as fh:
            json.dump({"schema": "rapp-drift-baseline/1.0",
                       "recorded_at": obs["observed_at"],
                       "note": "Ratchet. Written by `spine gate --ratchet` when "
                               "drift improves; never widened by hand.",
                       "variants": current}, fh, indent=2, sort_keys=True)
            fh.write("\n")
        print(f"\n  drift improved — baseline ratcheted down ({len(fixed)} "
              f"file(s) aligned, {len(better)} reduced)")
        return 0

    print("\n  no deterioration.")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(prog="spine", description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)

    q = sub.add_parser("collect", help="observe every repo mechanically")
    q.add_argument("--owner", default=OWNER)
    q.add_argument("--limit", type=int, default=2000)
    q.add_argument("--only", help="comma-separated repo names")
    q.add_argument("-o", "--out", default="spine/observations.json")
    q.add_argument("--allow-shrink", action="store_true",
                   help="accept an estate that got smaller (real deletions)")
    q.set_defaults(fn=cmd_collect)

    q = sub.add_parser("map", help="rebuild the estate map (derived)")
    q.add_argument("observations", nargs="?", default="spine/observations.json")
    q.add_argument("--overlay", default="spine/overlay.json")
    q.add_argument("-o", "--out", default="estate-map.json")
    q.set_defaults(fn=cmd_map)

    q = sub.add_parser("drift", help="where canon diverges")
    q.add_argument("observations", nargs="?", default="spine/observations.json")
    q.add_argument("--waivers", default="spine/waivers.json")
    q.add_argument("--strict", action="store_true")
    q.set_defaults(fn=cmd_drift)

    q = sub.add_parser("gate", help="fail only if canon drift got worse")
    q.add_argument("observations", nargs="?", default="spine/observations.json")
    q.add_argument("--baseline", default="spine/drift-baseline.json")
    q.add_argument("--waivers", default="spine/waivers.json")
    q.add_argument("--ratchet", action="store_true",
                   help="tighten the baseline when drift improves")
    q.set_defaults(fn=cmd_gate)

    q = sub.add_parser("snapshot", help="freeze a vertebra")
    q.add_argument("observations", nargs="?", default="spine/observations.json")
    q.add_argument("-o", "--out")
    q.set_defaults(fn=cmd_snapshot)

    q = sub.add_parser("diff", help="what moved between two vertebrae")
    q.add_argument("a"); q.add_argument("b")
    q.set_defaults(fn=cmd_diff)

    q = sub.add_parser("check", help="a vertebra vs the estate now")
    q.add_argument("vertebra")
    q.add_argument("--limit", type=int, default=2000)
    q.add_argument("--strict", action="store_true")
    q.set_defaults(fn=cmd_check)

    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
