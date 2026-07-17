#!/usr/bin/env node

import { spawn as aliasedSpawn } from "node:child_process";
import { lookup as aliasedLookup } from "node:dns";
import { request as aliasedHttpRequest } from "node:http";
import { connect as aliasedNetConnect } from "node:net";
import { createRequire } from "node:module";

const marker = globalThis[Symbol.for("rapp-map.offline-guard")];
if (
  marker?.schema !== "rapp-map-offline-guard/1.0" ||
  marker.active !== true ||
  marker.host_enforcement !== false
) {
  throw new Error("offline guard preload is not active with the documented project-process scope");
}

let checks = 0;
async function expectDenied(name, operation) {
  try {
    await operation();
  } catch (error) {
    if (error?.code === "RAPP_OFFLINE_DENIED") {
      checks += 1;
      console.log(`PASS ${name}`);
      return;
    }
    throw new Error(`${name} failed with an unexpected error: ${error?.stack ?? error}`);
  }
  throw new Error(`${name} was not denied`);
}

const http = await import("node:http");
const https = await import("node:https");
const http2 = await import("node:http2");
const net = await import("node:net");
const tls = await import("node:tls");
const dns = await import("node:dns");
const dnsPromises = await import("node:dns/promises");
const dgram = await import("node:dgram");
const childProcess = await import("node:child_process");
const workerThreads = await import("node:worker_threads");
const require = createRequire(import.meta.url);
const { get: commonJsHttpsGet } = require("node:https");

await expectDenied("global fetch", () => fetch("https://example.invalid"));
await expectDenied("http request", () => http.request("http://example.invalid"));
await expectDenied("aliased ESM http request", () => aliasedHttpRequest("http://example.invalid"));
await expectDenied("https get", () => https.get("https://example.invalid"));
await expectDenied("CommonJS https get", () => commonJsHttpsGet("https://example.invalid"));
await expectDenied("http2 connect", () => http2.connect("https://example.invalid"));
await expectDenied("net connect", () => net.connect(9, "127.0.0.1"));
await expectDenied("aliased ESM net connect", () => aliasedNetConnect(9, "127.0.0.1"));
await expectDenied("Socket.prototype.connect", () => new net.Socket().connect(9, "127.0.0.1"));
await expectDenied("tls connect", () => tls.connect(443, "example.invalid"));
await expectDenied("dns lookup", () => dns.lookup("example.invalid", () => {}));
await expectDenied("aliased ESM dns lookup", () => aliasedLookup("example.invalid", () => {}));
await expectDenied("dns promises lookup", () => dnsPromises.lookup("example.invalid"));
await expectDenied("dgram socket", () => dgram.createSocket("udp4"));
await expectDenied("child_process spawn", () => childProcess.spawn("/usr/bin/env"));
await expectDenied("aliased ESM spawn", () => aliasedSpawn("/usr/bin/env"));
await expectDenied("child_process exec", () => childProcess.exec("printf denied"));
await expectDenied(
  "worker thread",
  () => new workerThreads.Worker("export default 1", { eval: true })
);
await expectDenied("native tcp binding", () => process.binding("tcp_wrap"));
await expectDenied("native addon loading", () => process.dlopen({}, "denied.node"));

console.log(
  `RESULT PASS: ${checks} ordinary, aliased, subprocess, worker, and native escape probes were denied.`
);
