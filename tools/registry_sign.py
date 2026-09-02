#!/usr/bin/env python3
"""registry_sign.py — the kody-w estate's §13 registry ceremony tooling.

This is ESTATE tooling (it needs `cryptography`); the protocol authority kody-w/rapp-1
stays stdlib-only and is imported here, never re-typed (Constitution Art. 10).

  keygen  --key PATH                       mint the estate-owner Ed25519 key (0600, never in a repo)
  rappid  --key PATH --owner kody-w --slug estate-owner
  sign    --key PATH --in registry.json --out registry.json   (detached JWS, EdDSA, §10)
  verify  --in registry.json                                    (reference check: rapp + rapp_registry)

Point RAPP1_DIR at a checkout of kody-w/rapp-1 (default: ../rapp-1).
"""
import argparse, base64, json, os, stat, sys

RAPP1 = os.environ.get("RAPP1_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "rapp-1")
sys.path.insert(0, os.path.abspath(RAPP1))
import rapp as R                      # noqa: E402
import rapp_registry as REG           # noqa: E402

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519


def b64url(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def load_private(path):
    with open(path, "rb") as f:
        key = serialization.load_pem_private_key(f.read(), password=None)
    if not isinstance(key, ed25519.Ed25519PrivateKey):
        raise SystemExit("estate-owner key must be Ed25519")
    return key


def spki_der(key):
    return key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)


def keygen(path):
    if os.path.exists(path):
        raise SystemExit(f"refusing to overwrite existing key {path}")
    os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
    key = ed25519.Ed25519PrivateKey.generate()
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(pem)
    print("key written (0600):", path)
    print("spki_der_b64:", base64.b64encode(spki_der(key)).decode())


def sign(key, doc):
    unsigned = {k: v for k, v in doc.items() if k != "sig"}
    der = spki_der(key)
    owner = [e for e in unsigned["entries"] if e["type"] == "estate_owner"][0]["rappid"]
    if R.Hb("rapp/1:rappid", der) != R.rappid_parts(owner)["hash"]:
        raise SystemExit("this key is not the estate_owner's key (tail mismatch)")
    header = {"alg": "EdDSA", "b64": False, "crit": ["b64"], "kid": owner}
    protected = b64url(R.canonical(header).encode("utf-8"))
    signing_input = protected.encode("ascii") + b"." + R.canonical(unsigned).encode("utf-8")
    signature = key.sign(signing_input)
    unsigned["sig"] = protected + ".." + b64url(signature)
    return unsigned


def verify(doc, persisted_seq=None, trust_anchor=None):
    """Verify against the OUT-OF-BAND trust anchor. The signer path derives it from the key
    it holds; the verify path must be told it (--trust-anchor or RAPP_ESTATE_OWNER)."""
    if trust_anchor is None:
        raise SystemExit("verify needs the out-of-band estate-owner rappid: --trust-anchor or RAPP_ESTATE_OWNER")
    status, reg, why = REG.load_document(doc, entries_member="entries", trust_anchor=trust_anchor, persisted_seq=persisted_seq)
    print(f"{status}: {why}")
    if status == "verified":
        print(f"  owner {reg.estate_owner}")
        print(f"  seq {doc['registry_seq']}, {len(reg.kinds)} kinds, {len(reg.egg_variants)} variants, "
              f"{len(reg.error_codes)} error codes, {len(reg.genesis)} genesis, {len(reg.protocols)} protocol pins")
    return status == "verified"


def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    k = sub.add_parser("keygen"); k.add_argument("--key", required=True)
    r = sub.add_parser("rappid"); r.add_argument("--key", required=True); r.add_argument("--owner", required=True); r.add_argument("--slug", required=True)
    s = sub.add_parser("sign"); s.add_argument("--key", required=True); s.add_argument("--in", dest="inp", required=True); s.add_argument("--out", required=True)
    v = sub.add_parser("verify"); v.add_argument("--in", dest="inp", required=True); v.add_argument("--persisted-seq", type=int); v.add_argument("--trust-anchor", default=os.environ.get("RAPP_ESTATE_OWNER"))
    a = ap.parse_args()
    if a.cmd == "keygen":
        keygen(a.key)
    elif a.cmd == "rappid":
        key = load_private(a.key); print(R.mint_rappid(a.owner, a.slug, spki_der=spki_der(key)))
    elif a.cmd == "sign":
        if os.path.abspath(a.key).startswith(os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))):
            raise SystemExit("refusing a key path inside the repository")
        if stat.S_IMODE(os.stat(a.key).st_mode) & 0o077:
            raise SystemExit("key file must be mode 0600")
        with open(a.inp) as f: doc = json.load(f)
        key = load_private(a.key)
        signed = sign(key, doc)
        # The signer holds the key, and sign() already proved the key's SPKI hashes to the
        # estate_owner rappid — so for the signer, that rappid is the anchor.
        anchor = [e for e in signed["entries"] if e["type"] == "estate_owner"][0]["rappid"]
        if not verify(signed, trust_anchor=anchor):
            raise SystemExit("signed document does not verify; not written")
        with open(a.out, "w") as f:
            f.write(json.dumps(signed, indent=2, ensure_ascii=False) + "\n")
        print("written:", a.out)
    elif a.cmd == "verify":
        with open(a.inp) as f: doc = json.load(f)
        sys.exit(0 if verify(doc, a.persisted_seq, a.trust_anchor) else 1)


if __name__ == "__main__":
    main()
