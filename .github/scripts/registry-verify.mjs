// registry-verify.mjs — verify the estate's published rapp/1-registry with Node built-ins only.
// RFC 8785 (JCS) canonicalization for the I-JSON subset this registry uses, and §10 detached
// JWS (EdDSA) verification through node:crypto. No dependency, no network.
import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";

const RAPPID = /^rappid:@([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*):([0-9a-f]{64})$/u;

export function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function canonical(value) {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    invariant(Number.isFinite(value), "canonical: non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  invariant(typeof value === "object", `canonical: unsupported value ${typeof value}`);
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

export function hb(space, octets) {
  return createHash("sha256").update(Buffer.concat([Buffer.from(space, "utf8"), Buffer.from([0x0a]), octets])).digest("hex");
}

export function sha256Hex(octets) {
  return createHash("sha256").update(octets).digest("hex");
}

function b64urlDecode(text) {
  invariant(/^[A-Za-z0-9_-]*$/u.test(text) && text.length % 4 !== 1, "base64url value must be unpadded");
  const decoded = Buffer.from(text, "base64url");
  invariant(decoded.toString("base64url") === text, "base64url value is not canonical");
  return decoded;
}

export function rappidTail(rappid) {
  const match = RAPPID.exec(rappid);
  invariant(match, `not a §6.1 rappid: ${rappid}`);
  return match[3];
}

export function verifyRegistry(document) {
  invariant(document?.schema === "rapp/1-registry", 'registry schema must be "rapp/1-registry"');
  const seq = document.registry_seq;
  invariant(Number.isInteger(seq) && seq >= 0 && seq <= Number.MAX_SAFE_INTEGER, "registry_seq must be uint53");
  invariant(Array.isArray(document.entries), "registry entries must be an array");
  const owners = document.entries.filter((entry) => entry.type === "estate_owner");
  invariant(owners.length === 1, "exactly one estate_owner entry is required");
  const owner = owners[0].rappid;
  const tail = rappidTail(owner);
  const spki = document.entries.find((entry) => entry.type === "spki" && entry.rappid === owner && entry.deprecated === false);
  invariant(spki, "no live spki entry for the estate_owner");
  const der = Buffer.from(spki.spki_der_b64, "base64");
  invariant(der.toString("base64") === spki.spki_der_b64, "spki_der_b64 is not canonical base64");
  invariant(hb("rapp/1:rappid", der) === tail, "SPKI does not hash to the estate_owner tail (§10)");
  const rapp1 = document.entries.find((entry) => entry.type === "protocol" && entry.name === "rapp/1" && entry.deprecated === false);
  invariant(rapp1 && rapp1.spec_repo === "https://github.com/kody-w/rapp-1" && rapp1.spec_path === "SPEC.md" && /^[0-9a-f]{64}$/u.test(rapp1.spec_hash), "a current rapp/1 protocol pin is required");

  invariant(typeof document.sig === "string", "registry must carry a detached JWS sig (§13.1)");
  const parts = document.sig.split(".");
  invariant(parts.length === 3 && parts[1] === "", "sig must be detached compact JWS");
  const headerOctets = b64urlDecode(parts[0]);
  const header = JSON.parse(headerOctets.toString("utf8"));
  invariant(canonical(header) === headerOctets.toString("utf8"), "JWS protected header is not canonical");
  invariant(header.alg === "EdDSA" && header.b64 === false && Array.isArray(header.crit) && header.crit.length === 1 && header.crit[0] === "b64" && header.kid === owner, "JWS header must be {alg:EdDSA,b64:false,crit:[b64],kid:<estate_owner>}");
  const unsigned = Object.fromEntries(Object.entries(document).filter(([key]) => key !== "sig"));
  const signingInput = Buffer.concat([Buffer.from(parts[0], "ascii"), Buffer.from("."), Buffer.from(canonical(unsigned), "utf8")]);
  const publicKey = createPublicKey({ key: der, format: "der", type: "spki" });
  invariant(publicKey.asymmetricKeyType === "ed25519", "estate_owner key must be Ed25519");
  invariant(cryptoVerify(null, signingInput, publicKey, b64urlDecode(parts[2])), "registry signature does not verify");
  return { owner, seq, kinds: document.entries.filter((e) => e.type === "kind").length, rapp1SpecHash: rapp1.spec_hash };
}
