# Succession — what happens to the kody-w estate when the owner cannot act

RAPP/1 §13.2 makes authority time-scoped: the owner in effect at an artifact's time is the
one whose signature counts, and succession is a signed `re-anchor` record. This page is the
estate's standing plan so that plan exists *before* it is needed.

## The key

- The estate-owner key is Ed25519; its public SPKI is in `ecosystem-spec.json` and its
  rappid is published out of band in `kody-w/rapp-1`'s README.
- The private key is held by the owner outside every repository, and is **split 2-of-4**
  with `tools/key_shares.py` (Shamir over GF(256), stdlib). Any two shares reproduce the
  key byte-for-byte; one share reveals nothing.

## Line of succession (owner's decision, 2026-09-01)

1. first successor
2. second successor
3. third successor

*Who these people are is recorded in the owner's private workspace, not here. A public
list of share holders is a map of whom to coerce; this page carries roles only.*

Each successor, in that order, becomes estate owner by the planned rotation below when the
person ahead of them cannot act. Authority passes by a signed `re-anchor` record, never by
possession of a share alone.

## Share custody

| share | held by | role |
|---|---|---|
| 1 | the owner | owner |
| 2 | first successor | first successor |
| 3 | second successor | second successor |
| 4 | third successor | third successor |

Any two of the four recover the key. Shares travel to their holders off this machine; a
share is never committed to a repository, mailed in plain text, or stored beside another.

## Planned succession (owner alive, key rotating)

1. Successor mints their own keyed rappid (`tools/registry_sign.py keygen` + `rappid`).
2. Owner appends `registry_seq N+1` with a `spki` entry for the successor and a
   `re-anchor` record `{case:"rotation", old_rappid: owner, new_rappid: successor, utc, sig, old_key_sig}`,
   signed by the outgoing key (§13.2), and a new `estate_owner` entry.
3. The old key's `spki` entry is deprecated. Frames before `utc` still verify under the old key.

## Unplanned succession (owner cannot act)

1. The next person in the line of succession and any other share holder recombine the key: `tools/key_shares.py combine --share A --share B --out key.pem`.
   The tool refuses a recombination whose digest does not match the recorded one.
2. The recombined key performs the *planned* rotation above, then is destroyed. Compromise
   is never assumed from absence (§13.1).
3. If fewer than two of the four shares survive, the trust anchor is lost: every dependent estate re-anchors
   out of band to a new rappid. That is the failure this page exists to prevent.

## What survives without any key

The specification chain, the registry's past sequences, every frame, and the printed book
verify forever by hash. A lost key stops *new* authority; it never invalidates old bytes.
