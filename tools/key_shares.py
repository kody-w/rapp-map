#!/usr/bin/env python3
"""key_shares.py — split the estate-owner key into k-of-n Shamir shares; recombine any k.

Stdlib only. GF(256) with the AES polynomial (0x11b), one independent random polynomial
per secret byte, evaluation points 1..n. Losing one laptop, one drive, or one person is
then survivable; any two shares reproduce the key byte-for-byte. A single share reveals
nothing about the key.

  split    --in KEY.pem --out-dir DIR [--n 3] [--k 2]
  combine  --share A --share B [...] --out KEY.pem

Share files are plain text and carry the SHA-256 of the whole secret so a recombination
can be checked before it is trusted. Keep shares in DIFFERENT places (a password manager,
a second machine, a trusted person). Never commit a share to any repository.
"""
import argparse, hashlib, os, secrets, sys

def _mul(a, b):
    r = 0
    while b:
        if b & 1:
            r ^= a
        a <<= 1
        if a & 0x100:
            a ^= 0x11B
        b >>= 1
    return r

def _pow(a, e):
    r = 1
    while e:
        if e & 1:
            r = _mul(r, a)
        a = _mul(a, a); e >>= 1
    return r

def _inv(a):
    if a == 0:
        raise ZeroDivisionError
    return _pow(a, 254)

def _eval(coeffs, x):
    y = 0
    for c in reversed(coeffs):
        y = _mul(y, x) ^ c
    return y

def split(secret, n, k):
    if not (1 < k <= n <= 255):
        raise SystemExit("need 1 < k <= n <= 255")
    shares = [bytearray() for _ in range(n)]
    for byte in secret:
        coeffs = [byte] + [secrets.randbelow(256) for _ in range(k - 1)]
        for i in range(n):
            shares[i].append(_eval(coeffs, i + 1))
    return [(i + 1, bytes(s)) for i, s in enumerate(shares)]

def combine(shares):
    xs = [x for x, _ in shares]
    if len(set(xs)) != len(xs):
        raise SystemExit("duplicate share index")
    length = {len(y) for _, y in shares}
    if len(length) != 1:
        raise SystemExit("shares differ in length")
    out = bytearray()
    for pos in range(length.pop()):
        acc = 0
        for i, (xi, yi) in enumerate(shares):
            num, den = 1, 1
            for j, (xj, _) in enumerate(shares):
                if i != j:
                    num = _mul(num, xj)
                    den = _mul(den, xi ^ xj)
            acc ^= _mul(yi[pos], _mul(num, _inv(den)))
        out.append(acc)
    return bytes(out)

def write_share(path, index, data, k, n, digest):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write("rapp-estate-owner-share/1\n")
        f.write(f"index={index}\nthreshold={k}\nshares={n}\nsecret_sha256={digest}\n")
        f.write(f"share_hex={data.hex()}\n")

def read_share(path):
    fields = {}
    for line in open(path):
        line = line.strip()
        if line == "rapp-estate-owner-share/1" or not line:
            continue
        key, _, value = line.partition("=")
        fields[key] = value
    return int(fields["index"]), bytes.fromhex(fields["share_hex"]), fields["secret_sha256"]

def selftest():
    for _ in range(20):
        secret = secrets.token_bytes(secrets.randbelow(200) + 1)
        sh = split(secret, 3, 2)
        for a in range(3):
            for b in range(3):
                if a < b:
                    assert combine([sh[a], sh[b]]) == secret
        assert combine(sh) == secret
        assert combine([sh[0]]) != secret or len(secret) == 0
    print("selftest ok: every pair of 3 shares recombines; all 3 recombine")

def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("split"); s.add_argument("--in", dest="inp", required=True); s.add_argument("--out-dir", required=True); s.add_argument("--n", type=int, default=3); s.add_argument("--k", type=int, default=2)
    c = sub.add_parser("combine"); c.add_argument("--share", action="append", required=True); c.add_argument("--out", required=True)
    sub.add_parser("selftest")
    a = ap.parse_args()
    if a.cmd == "selftest":
        selftest(); return
    if a.cmd == "split":
        secret = open(a.inp, "rb").read()
        digest = hashlib.sha256(secret).hexdigest()
        os.makedirs(a.out_dir, mode=0o700, exist_ok=True)
        for index, data in split(secret, a.n, a.k):
            write_share(os.path.join(a.out_dir, f"share-{index}-of-{a.n}.txt"), index, data, a.k, a.n, digest)
        print(f"wrote {a.n} shares (threshold {a.k}) to {a.out_dir}; secret sha256 {digest}")
        return
    parts = [read_share(p) for p in a.share]
    digests = {d for _, _, d in parts}
    if len(digests) != 1:
        raise SystemExit("shares belong to different secrets")
    secret = combine([(i, d) for i, d, _ in parts])
    if hashlib.sha256(secret).hexdigest() != digests.pop():
        raise SystemExit("recombined secret does not match the recorded digest (too few or wrong shares)")
    fd = os.open(a.out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(secret)
    print("recovered:", a.out)

if __name__ == "__main__":
    main()
