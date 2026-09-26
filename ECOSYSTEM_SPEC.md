# Historical ecosystem specification — retired

The former document described a superseded protocol family and treated an
unsigned mirror as canonical. It is removed from the live guidance surface and
remains available only in Git history at commit
`baded0098d8b97c2876c0b8af4475cf3061b7ad0`.

Current protocol authority is the exact pin in
[`RAPP1_AUTHORITY.json`](RAPP1_AUTHORITY.json). The owner action in
[`RAPP1_OWNER_ACTIONS.md`](RAPP1_OWNER_ACTIONS.md) is complete: the registry
path [`ecosystem-spec.json`](ecosystem-spec.json) holds the estate owner's
signed `rapp/1-registry` (registry_seq 2), which consumers verify against the
out-of-band estate-owner rappid before trusting it.
