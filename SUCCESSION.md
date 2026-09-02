# Succession — what happens to the kody-w estate when the owner cannot act

RAPP/1 §13.2 makes authority time-scoped: the owner in effect at an artifact's time is the
one whose signature counts, and succession is a signed `re-anchor` record. This page is the
estate's standing plan so that plan exists *before* it is needed.

## The key

- The estate-owner key is Ed25519; its public SPKI is in `ecosystem-spec.json` and its
  rappid is published out of band in `kody-w/rapp-1`'s README.
- The private key is held by the owner outside every repository, and is **split 2-of-3**
  with `tools/key_shares.py` (Shamir over GF(256), stdlib). Any two shares reproduce the
  key byte-for-byte; one share reveals nothing.
- Share custody (the owner fills this in and keeps it current):

  | share | where | held by |
  |---|---|---|
  | 1 | owner's machine | owner |
  | 2 | *(to assign: password manager or second device)* | owner |
  | 3 | *(to assign)* | **successor — unnamed** |

## Planned succession (owner alive, key rotating)

1. Successor mints their own keyed rappid (`tools/registry_sign.py keygen` + `rappid`).
2. Owner appends `registry_seq N+1` with a `spki` entry for the successor and a
   `re-anchor` record `{case:"rotation", old_rappid: owner, new_rappid: successor, utc, sig, old_key_sig}`,
   signed by the outgoing key (§13.2), and a new `estate_owner` entry.
3. The old key's `spki` entry is deprecated. Frames before `utc` still verify under the old key.

## Unplanned succession (owner cannot act)

1. Any two share holders recombine the key: `tools/key_shares.py combine --share A --share B --out key.pem`.
   The tool refuses a recombination whose digest does not match the recorded one.
2. The recombined key performs the *planned* rotation above, then is destroyed. Compromise
   is never assumed from absence (§13.1).
3. If fewer than two shares survive, the trust anchor is lost: every dependent estate re-anchors
   out of band to a new rappid. That is the failure this page exists to prevent.

## What survives without any key

The specification chain, the registry's past sequences, every frame, and the printed book
verify forever by hash. A lost key stops *new* authority; it never invalidates old bytes.
