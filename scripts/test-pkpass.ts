/**
 * Quick win 2, part B — structural gate for the .pkpass pipeline.
 *
 * Builds a REAL pass end-to-end with a self-signed dev chain in
 * `.certs/` (gitignored, generated on first run) and asserts every
 * contract Apple's Wallet would check structurally: zip entries,
 * pass.json schema keys, manifest SHA-1s against the actual bytes,
 * and a parseable detached PKCS#7 over exactly those manifest bytes.
 * When openssl is resolvable it cross-verifies the signature math too
 * (`cms -verify -noverify`).
 *
 * What this does NOT prove: Apple's trust chain. That needs the real
 * WWDR intermediate + a pass type ID certificate — the same external
 * credential block as Phase 1b. The route's honest 503 / the ticket's
 * honest note are the shipped state until then.
 *
 * Run: npx tsx scripts/test-pkpass.ts
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import forge from "node-forge";
import AdmZip from "adm-zip";
import {
  buildManifest,
  buildPassJson,
  buildPkpass,
  getPassConfig,
  PASS_ICON_PATH,
  signManifest,
  type PassLabels,
} from "../src/lib/pkpass";

const CERTS = path.join(process.cwd(), ".certs");
const SIGNER_CERT = path.join(CERTS, "dev-signer.pem");
const SIGNER_KEY = path.join(CERTS, "dev-signer-key.pem");
const WWDR_STANDIN = path.join(CERTS, "dev-wwdr.pem");

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, cond: boolean, detail: string) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

/** One self-signed cert = "the chain" for structural purposes; the
 *  pipeline treats signer and WWDR identically (both enter the bag). */
function makeSelfSigned(cn: string, o: string) {
  const pair = forge.pki.rsa.generateKeyPair(2048);
  const priv = pair.privateKey;
  const cert = forge.pki.createCertificate();
  cert.publicKey = pair.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 24 * 3600 * 1000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  const attrs = [
    { name: "commonName", value: cn },
    { name: "organizationName", value: o },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(priv, forge.md.sha256.create());
  return { cert, priv };
}

function ensureDevChain() {
  if (existsSync(SIGNER_CERT) && existsSync(SIGNER_KEY) && existsSync(WWDR_STANDIN)) return;
  mkdirSync(CERTS, { recursive: true });
  console.log("  generating self-signed dev chain in .certs/ (first run)…");
  const signer = makeSelfSigned("Campus Pulse Dev Pass Signer", "Campus Pulse Dev");
  const wwdr = makeSelfSigned("Apple WWDR Dev Stand-in", "Campus Pulse Dev");
  writeFileSync(SIGNER_CERT, forge.pki.certificateToPem(signer.cert));
  writeFileSync(SIGNER_KEY, forge.pki.privateKeyToPem(signer.priv));
  writeFileSync(WWDR_STANDIN, forge.pki.certificateToPem(wwdr.cert));
}

/** openssl for the cross-check: PATH first, then the copy that ships
 *  inside the Git for Windows install (found relative to wherever git
 *  resolves — this OS keeps openssl off PATH). */
function findOpenssl(): string | null {
  const pathProbe = spawnSync("openssl", ["version"], { encoding: "utf8" });
  if (!pathProbe.error && pathProbe.status === 0) return "openssl";

  const whereGit = spawnSync("where", ["git"], { encoding: "utf8" });
  const gitExe = (whereGit.stdout ?? "").split(/\r?\n/).find((l) => l.trim().length > 0);
  if (gitExe) {
    let dir = path.dirname(gitExe.trim()); // …\Git\cmd
    for (let up = 0; up < 4 && dir && dir !== path.dirname(dir); up++) {
      const candidate = path.join(dir, "usr", "bin", "openssl.exe");
      if (existsSync(candidate)) return candidate;
      dir = path.dirname(dir);
    }
  }

  for (const bin of [
    "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
    "C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe",
  ]) {
    if (existsSync(bin)) return bin;
  }
  return null;
}

const main = () => {
  ensureDevChain();

  // Config gate: all five vars flip the feature on, one flips it off.
  process.env.APPLE_PASS_TYPE_ID = "pass.dev.campuspulse";
  process.env.APPLE_TEAM_ID = "DEVTEAM1234";
  process.env.APPLE_WWDR_CERT = WWDR_STANDIN;
  process.env.APPLE_SIGNER_CERT = SIGNER_CERT;
  process.env.APPLE_SIGNER_KEY = SIGNER_KEY;
  delete process.env.APPLE_SIGNER_KEY_PASS;
  const configured = getPassConfig();
  check(
    "Env template flips the feature on",
    configured !== null && configured.passTypeId === "pass.dev.campuspulse",
    configured ? `passType=${configured.passTypeId}` : "getPassConfig() null with all five set"
  );
  delete process.env.APPLE_TEAM_ID;
  const off = getPassConfig() === null;
  process.env.APPLE_TEAM_ID = "DEVTEAM1234";
  check(
    "One missing var = honest OFF (no half-configured pass)",
    off,
    off ? "TEAM_ID removed → null" : "still configured with a var missing"
  );
  if (!configured) {
    console.log("\ntest-pkpass: cannot continue without config");
    process.exit(1);
  }

  const ticket = {
    serialNumber: "TCK-TEST-0001",
    eventTitle: "Line Follower Challenge — Demo Day",
    startsAtLabel: "sam. 8 nov. 2026 14:00",
    startsAtIso: "2026-11-08T14:00:00.000Z",
    location: "Labo Robotics, EMSI",
    clubName: "Club Innovation EMSI",
    ticketCode: "TCK-TEST-0001",
  };
  const labels: PassLabels = {
    event: "Événement",
    date: "Date",
    location: "Lieu",
    club: "Club",
    code: "Code billet",
  };

  // ---- pass.json contract ----
  const passJson = buildPassJson(configured, ticket, labels);
  const pj = passJson as Record<string, unknown>;
  check(
    "pass.json core keys",
    pj.formatVersion === 1 &&
      pj.passTypeIdentifier === "pass.dev.campuspulse" &&
      pj.teamIdentifier === "DEVTEAM1234" &&
      pj.serialNumber === ticket.ticketCode,
    `v${String(pj.formatVersion)} ${String(pj.passTypeIdentifier)} serial=${String(pj.serialNumber)}`
  );
  const barcodes = pj.barcodes as Array<Record<string, string>>;
  check(
    "barcode carries the raw door code as QR",
    barcodes?.[0]?.format === "PKBarcodeFormatQR" &&
      barcodes[0].message === ticket.ticketCode,
    `format=${barcodes?.[0]?.format} message=${barcodes?.[0]?.message}`
  );
  const evt = pj.eventTicket as Record<string, Array<Record<string, string>>>;
  const primary = evt.primaryFields?.[0];
  const secondary = evt.secondaryFields ?? [];
  const back = evt.backFields?.[0];
  check(
    "eventTicket fields localize labels and keep values",
    primary?.value === ticket.eventTitle &&
      primary?.label === labels.event &&
      secondary[0]?.value === ticket.startsAtLabel &&
      secondary[1]?.value === ticket.location &&
      back?.value === ticket.ticketCode,
    `primary="${primary?.value?.slice(0, 24)}…" labels=${primary?.label}/${secondary[0]?.label}`
  );
  check(
    "relevantDate is the ISO event start",
    pj.relevantDate === ticket.startsAtIso,
    String(pj.relevantDate)
  );

  // ---- full bundle ----
  let bundle: Buffer;
  try {
    bundle = buildPkpass(configured, ticket, labels);
    check("buildPkpass produces a zip (PK magic)", bundle.subarray(0, 2).toString() === "PK", `bytes=${bundle.length}`);
  } catch (e) {
    check("buildPkpass produces a zip (PK magic)", false, `threw: ${(e as Error).message}`);
    summary();
    return;
  }

  const zip = new AdmZip(bundle);
  const names = zip.getEntries().map((e) => e.entryName).sort();
  const expected = ["icon.png", "manifest.json", "pass.json", "signature"].sort();
  check(
    "zip holds exactly the four required entries at root",
    JSON.stringify(names) === JSON.stringify(expected),
    names.join(", ")
  );

  const zp = JSON.parse(zip.readAsText("pass.json")) as Record<string, unknown>;
  const manifest = JSON.parse(zip.readAsText("manifest.json")) as Record<string, string>;
  check(
    "pass.json survives the round-trip",
    zp.serialNumber === ticket.serialNumber && zp.description === ticket.eventTitle,
    `serial=${String(zp.serialNumber)}`
  );

  const fileNames = ["pass.json", "icon.png"];
  const hashesOk = fileNames.every((f) => manifest[f] === createHash("sha1").update(zip.readFile(f)!).digest("hex"));
  check(
    "manifest SHA-1s match the zipped bytes",
    hashesOk && Object.keys(manifest).sort().join() === fileNames.sort().join(),
    fileNames.map((f) => `${f}=${manifest[f]?.slice(0, 10)}…`).join(" ")
  );
  check(
    "icon.png is the real icon bytes",
    zip.readFile("icon.png")!.equals(readFileSync(PASS_ICON_PATH)),
    `${zip.readFile("icon.png")!.length} bytes`
  );

  // ---- signature contract ----
  const sig = zip.readFile("signature")!;
  let topOid = "";
  try {
    const asn1 = forge.asn1.fromDer(sig.toString("binary"));
    const oidNode = Array.isArray(asn1.value) ? asn1.value[0] : null;
    const raw = String(oidNode?.value ?? "");
    // forge hands back the OID as raw DER content bytes; a dotted string
    // from a future decoder is accepted too (digits can't start a byte).
    topOid = raw === "" ? "" : /^\d/.test(raw) ? raw : forge.asn1.derToOid(raw);
  } catch {
    topOid = "<unparsable>";
  }
  check(
    "signature parses as a PKCS#7 ContentInfo",
    topOid === "1.2.840.113549.1.7.2",
    `top OID=${topOid || "<none>"} bytes=${sig.length}`
  );
  const oidBytes = (oid: string) =>
    Buffer.from(forge.asn1.oidToDer(oid).getBytes(), "binary");
  const hasData = sig.includes(oidBytes("1.2.840.113549.1.7.1")); // content is "data"
  const hasSha256 = sig.includes(oidBytes("2.16.840.1.101.3.4.2.1"));
  const hasMdAttr = sig.includes(oidBytes("1.2.840.113549.1.9.3"));
  check(
    "signature carries data + sha256 + messageDigest attribute",
    hasData && hasSha256 && hasMdAttr,
    `data=${hasData} sha256=${hasSha256} messageDigest=${hasMdAttr}`
  );

  // ---- openssl cross-check (strongest, when available) ----
  const openssl = findOpenssl();
  if (!openssl) {
    console.log("SKIP  openssl cross-verify — openssl not resolvable (structural checks above still gate)");
  } else {
    writeFileSync(path.join(CERTS, "t-manifest.json"), zip.readFile("manifest.json")!);
    writeFileSync(path.join(CERTS, "t-signature.der"), sig);
    const v = spawnSync(
      openssl,
      [
        "cms", "-verify", "-inform", "DER",
        "-in", path.join(CERTS, "t-signature.der"),
        "-content", path.join(CERTS, "t-manifest.json"),
        "-noverify", "-out", path.join(CERTS, "t-verified.bin"),
      ],
      { encoding: "utf8" }
    );
    check(
      "openssl cross-verifies the signature over the manifest",
      v.status === 0,
      v.status === 0 ? "Verification successful" : `exit=${v.status} ${(v.stderr ?? "").slice(0, 200)}`
    );
  }

  // ---- isolated signManifest contract (route path uses the same fn) ----
  try {
    const manifestBuf = Buffer.from(
      buildManifest({ "pass.json": Buffer.from(JSON.stringify(passJson)) }),
      "utf8"
    );
    const sig2 = signManifest(manifestBuf, configured);
    check("signManifest is standalone-callable (route path)", sig2.length > 500, `bytes=${sig2.length}`);
  } catch (e) {
    check("signManifest is standalone-callable (route path)", false, `threw: ${(e as Error).message}`);
  }

  summary();
};

function summary() {
  const passed = results.filter((r) => r.pass).length;
  console.log(`\ntest-pkpass: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
}

main();
