import childProcess from "node:child_process";
import cluster from "node:cluster";
import dgram from "node:dgram";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import http from "node:http";
import http2 from "node:http2";
import https from "node:https";
import inspector from "node:inspector";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import tls from "node:tls";
import workerThreads from "node:worker_threads";

const denialCode = "RAPP_OFFLINE_DENIED";

function denied(surface) {
  const block = function offlineDenied() {
    const error = new Error(`offline guard denied ${surface}`);
    error.code = denialCode;
    throw error;
  };
  Object.defineProperty(block, "name", { value: "offlineDenied" });
  return block;
}

function replaceFunction(target, key, surface) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor || typeof target[key] !== "function") {
    return;
  }
  const replacement = denied(`${surface}.${String(key)}`);
  if (descriptor.configurable) {
    Object.defineProperty(target, key, {
      configurable: false,
      enumerable: descriptor.enumerable,
      writable: false,
      value: replacement
    });
  } else if (descriptor.writable) {
    target[key] = replacement;
  } else {
    throw new Error(`offline guard could not patch ${surface}.${String(key)}`);
  }
}

function denyFunctions(target, surface) {
  for (const key of Reflect.ownKeys(target)) {
    let value;
    try {
      value = target[key];
    } catch {
      continue;
    }
    if (typeof value === "function") {
      replaceFunction(target, key, surface);
    }
  }
}

function denyNamed(target, surface, names) {
  for (const name of names) {
    replaceFunction(target, name, surface);
  }
}

denyNamed(http, "node:http", ["request", "get", "createServer", "ClientRequest"]);
denyNamed(https, "node:https", ["request", "get", "createServer"]);
denyNamed(http2, "node:http2", ["connect", "createServer", "createSecureServer"]);
denyNamed(net, "node:net", ["connect", "createConnection", "createServer"]);
denyNamed(tls, "node:tls", ["connect", "createServer"]);
denyNamed(dgram, "node:dgram", ["createSocket"]);
denyNamed(childProcess, "node:child_process", [
  "exec",
  "execFile",
  "execFileSync",
  "execSync",
  "fork",
  "spawn",
  "spawnSync"
]);
denyNamed(cluster, "node:cluster", ["disconnect", "fork", "setupMaster", "setupPrimary"]);
denyNamed(inspector, "node:inspector", ["open", "url"]);
denyNamed(workerThreads, "node:worker_threads", ["Worker"]);

denyNamed(net.Socket.prototype, "node:net.Socket.prototype", ["connect"]);
denyNamed(net.Server.prototype, "node:net.Server.prototype", ["listen"]);
denyNamed(tls.TLSSocket.prototype, "node:tls.TLSSocket.prototype", ["connect"]);
denyNamed(dgram.Socket.prototype, "node:dgram.Socket.prototype", [
  "bind",
  "connect",
  "send"
]);
denyNamed(http.Agent.prototype, "node:http.Agent.prototype", ["createConnection"]);
denyNamed(https.Agent.prototype, "node:https.Agent.prototype", ["createConnection"]);

const dnsNames = [
  "getDefaultResultOrder",
  "getServers",
  "lookup",
  "lookupService",
  "resolve",
  "resolve4",
  "resolve6",
  "resolveAny",
  "resolveCaa",
  "resolveCname",
  "resolveMx",
  "resolveNaptr",
  "resolveNs",
  "resolvePtr",
  "resolveSoa",
  "resolveSrv",
  "resolveTxt",
  "reverse",
  "setDefaultResultOrder",
  "setServers"
];
denyNamed(dns, "node:dns", dnsNames);
denyNamed(dnsPromises, "node:dns/promises", dnsNames);
if (dns.Resolver?.prototype) {
  denyFunctions(dns.Resolver.prototype, "node:dns.Resolver.prototype");
}
if (dnsPromises.Resolver?.prototype) {
  denyFunctions(dnsPromises.Resolver.prototype, "node:dns/promises.Resolver.prototype");
}

for (const name of ["fetch", "WebSocket", "EventSource"]) {
  if (name === "fetch" || name in globalThis) {
    Object.defineProperty(globalThis, name, {
      configurable: false,
      enumerable: true,
      writable: false,
      value: denied(`globalThis.${name}`)
    });
  }
}

if (globalThis.navigator && typeof globalThis.navigator.sendBeacon === "function") {
  replaceFunction(globalThis.navigator, "sendBeacon", "globalThis.navigator");
}

syncBuiltinESMExports();

const blockedBindings = new Set([
  "cares_wrap",
  "http_parser",
  "process_wrap",
  "spawn_sync",
  "tcp_wrap",
  "tls_wrap",
  "udp_wrap"
]);
const originalBinding = process.binding.bind(process);
Object.defineProperty(process, "binding", {
  configurable: false,
  enumerable: false,
  writable: false,
  value(name) {
    if (blockedBindings.has(name)) {
      return denied(`process.binding(${JSON.stringify(name)})`)();
    }
    return originalBinding(name);
  }
});

if (typeof process._linkedBinding === "function") {
  const originalLinkedBinding = process._linkedBinding.bind(process);
  Object.defineProperty(process, "_linkedBinding", {
    configurable: false,
    enumerable: false,
    writable: false,
    value(name) {
      if (blockedBindings.has(name)) {
        return denied(`process._linkedBinding(${JSON.stringify(name)})`)();
      }
      return originalLinkedBinding(name);
    }
  });
}

Object.defineProperty(process, "dlopen", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: denied("process.dlopen")
});

for (const key of Object.keys(process.env)) {
  if (
    /(?:TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API[_-]?KEY|PRIVATE[_-]?KEY|AUTH[_-]?SOCK)/iu.test(
      key
    ) ||
    /^(?:AWS|AZURE|GOOGLE|GCP|NPM|GH|GITHUB)_/u.test(key)
  ) {
    delete process.env[key];
  }
}

Object.defineProperty(globalThis, Symbol.for("rapp-map.offline-guard"), {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({
    schema: "rapp-map-offline-guard/1.0",
    active: true,
    denial_code: denialCode,
    scope: "project-node-process",
    host_enforcement: false
  })
});
