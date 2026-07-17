# rapp-map

`rapp-map` is a read-only repository map. It is not a protocol authority, a
runtime, an installer, or an authenticated registry.

## RAPP/1 authority and status

The sole protocol authority used here is `kody-w/rapp-1` at commit
`6723c7add2aed36bb68992fc71a56b0a4bd5ad81`, with `SPEC.md` pinned by exact
length and SHA-256 in [`RAPP1_AUTHORITY.json`](RAPP1_AUTHORITY.json).

**This repository is not yet fully RAPP/1 conformant.** The authenticated
registry evidence required by section 13 is absent. See
[`RAPP1_STATUS.md`](RAPP1_STATUS.md) and the
[`owner-action ledger`](RAPP1_OWNER_ACTIONS.md).

## Live artifacts

| Artifact | Disposition |
| --- | --- |
| `ecosystem-spec.json` | Fail-closed registry-path status; consumers must refuse it as an authenticated registry. |
| `graph.json` | Format 2 deterministic map: technical `conforms_to` targets `kody-w/rapp-1`; section 11 `subordinate_to` targets `kody-w/RAPP`. It claims no registry provenance. |
| `estate-map.json` | Historical 92-repository evidence, byte-identical to the baseline blob. |
| `neurons.json` | Historical 630-record evidence, byte-identical to the baseline blob. |
| `neurons-manifest.json` | Historical index evidence, byte-identical to the baseline blob. |
| `HISTORICAL_OBSERVATIONS.json` | Versioned non-authoritative sidecar with baseline byte lengths and SHA-256 values. |
| `conformance/` | Format 3, independently bound rev-5 identity vectors; never owner acceptance. |

Historical ecosystem prose and the former unsigned mirror remain available in
Git history at baseline commit
`baded0098d8b97c2876c0b8af4475cf3061b7ad0`. They are not current guidance.

## Local validation

```sh
bash .github/scripts/run-offline-gates.sh
```

The runner starts every Node check with the checked-in
`rapp-map-offline-guard/1.0` project-process guard in a credential-empty
environment and runs Python graph generation, which has no network-capable
imports. The guard denies the tested Node network, subprocess, worker, and
native-loading paths and synchronizes patched built-ins for ESM. It is **not
host sandbox enforcement**. Passing establishes structural consistency only;
it does not resolve the owner blocker.
