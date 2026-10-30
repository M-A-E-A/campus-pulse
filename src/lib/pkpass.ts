/**
 * Apple Wallet pass (.pkpass) pipeline — quick win 2, part B.
 *
 * Bundle, in Apple's required order: pass.json + icon.png → manifest.json
 * (SHA-1 of every other file) → `signature`, a PKCS#7 detached signature
 * over the manifest made with the pass type ID certificate and the Apple
 * WWDR intermediate in the bag → all four files zipped flat (no folder).
 *
 * Everything here runs only while the five APPLE_* env vars point at real
 * PEM files; `getPassConfig()` returning null is the honest "not
 * configured" state the route and the ticket page surface (same class as
 * the Phase 1b email block — no dead CTA, no pretend button).
 *
 * Not marked `server-only` on purpose: `scripts/test-pkpass.ts` imports
 * this module under plain Node to exercise the whole pipeline with a
 * self-signed dev chain, and `server-only` throws there. The node:fs /
 * node:crypto imports already make it un-importable from client code.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import forge from "node-forge";
import AdmZip from "adm-zip";

/** Field labels shown ON the pass — localized by the caller (route) via
 *  the app dictionary, so the pass speaks the student's language. */
export type PassLabels = {
  event: string;
  date: string;
  location: string;
  club: string;
  code: string;
};

export type PassTicket = {
  /** Unique per pass; also the raw door code (see barcode note below). */
  serialNumber: string;
  eventTitle: string;
  /** Localized date/time label for display. */
  startsAtLabel: string;
  /** ISO 8601 — feeds `relevantDate` (pass wakes near the event). */
  startsAtIso: string;
  location: string;
  clubName: string;
  ticketCode: string;
};

export type PassConfig = {
  passTypeId: string;
  teamId: string;
  wwdrCertPath: string;
  signerCertPath: string;
  signerKeyPath: string;
  signerKeyPass: string;
};

/** The pass icon. Apple asks for a 29×29 `icon.png`; until the real
 *  Apple chain exists we ship the 192px PWA mark (the structural gate
 *  only needs a valid PNG in the manifest — regenerate the small sizes
 *  together with the real certificates, when device import unblocks). */
export const PASS_ICON_PATH = path.join(
  process.cwd(),
  "public",
  "icons",
  "icon-192.png"
);

/**
 * All five vars must be present or the feature is honestly OFF —
 * a half-configured pass (e.g. cert paths without a team ID) would only
 * fail later at the route, after promising a download in the UI.
 */
export function getPassConfig(): PassConfig | null {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const wwdrCertPath = process.env.APPLE_WWDR_CERT;
  const signerCertPath = process.env.APPLE_SIGNER_CERT;
  const signerKeyPath = process.env.APPLE_SIGNER_KEY;
  if (!passTypeId || !teamId || !wwdrCertPath || !signerCertPath || !signerKeyPath) {
    return null;
  }
  return {
    passTypeId,
    teamId,
    wwdrCertPath,
    signerCertPath,
    signerKeyPath,
    signerKeyPass: process.env.APPLE_SIGNER_KEY_PASS ?? "",
  };
}

export function isPassConfigured(): boolean {
  return getPassConfig() !== null;
}

const truncate = (s: string, max: number) =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;

export function buildPassJson(
  config: PassConfig,
  ticket: PassTicket,
  labels: PassLabels
): Record<string, unknown> {
  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeId,
    teamIdentifier: config.teamId,
    organizationName: "Campus Pulse",
    description: ticket.eventTitle,
    logoText: truncate(ticket.eventTitle, 26),
    serialNumber: ticket.serialNumber,
    // Campus Pulse's own poster colours, as pass colours: white on ink,
    // labels in signal orange (5.6:1 on the ink ground).
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(20, 19, 15)",
    labelColor: "rgb(255, 77, 0)",
    // The pass barcode cannot rotate like the in-app QR does (the Wallet
    // renders it from a static string), so it carries the RAW ticket
    // code — exactly what the door accepts as manual entry and as a
    // scan, the same honest fallback `useTicketQr` degrades to.
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: ticket.ticketCode,
        messageEncoding: "iso8859-1",
        altText: ticket.ticketCode,
      },
    ],
    eventTicket: {
      primaryFields: [
        { key: "event", label: labels.event, value: ticket.eventTitle },
      ],
      secondaryFields: [
        { key: "date", label: labels.date, value: ticket.startsAtLabel },
        { key: "location", label: labels.location, value: ticket.location },
      ],
      auxiliaryFields: [
        { key: "club", label: labels.club, value: ticket.clubName },
      ],
      backFields: [
        { key: "code", label: labels.code, value: ticket.ticketCode },
      ],
    },
    relevantDate: ticket.startsAtIso,
  };
}

/** `fileName → SHA-1 hex` for every file except manifest.json/signature. */
export function buildManifest(files: Record<string, Buffer>): string {
  const out: Record<string, string> = {};
  for (const [name, buf] of Object.entries(files)) {
    out[name] = createHash("sha1").update(buf).digest("hex");
  }
  return JSON.stringify(out);
}

/** PKCS#8-encrypted keys come in with a passphrase; plain dev keys (the
 *  structural-test case) parse directly. Traditional encrypted PKCS#1
 *  (`openssl rsa -aes256`) is NOT supported — document to PKCS#8:
 *  `openssl pkcs8 -topk8 -in old.pem -out new.pem`. */
function privateKeyFromPem(pem: string, password: string): forge.pki.rsa.PrivateKey {
  try {
    return forge.pki.privateKeyFromPem(pem);
  } catch (plainErr) {
    if (!password) throw plainErr;
    const msg = forge.pem.decode(pem)[0];
    if (!msg) throw plainErr;
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(msg.body));
    const decrypted = forge.pki.decryptPrivateKeyInfo(asn1, password);
    if (!decrypted) throw new Error("Apple Wallet: key passphrase rejected");
    return forge.pki.privateKeyFromAsn1(decrypted);
  }
}

/**
 * Detached PKCS#7 (CMS) signature over the manifest bytes, DER-encoded —
 * the `signature` entry of the bundle. The bag carries the signer cert
 * AND the WWDR intermediate so Wallet can (when they are Apple's real
 * ones) walk the trust chain; sha256 is the digest.
 */
export function signManifest(manifest: Buffer, config: PassConfig): Buffer {
  const cert = forge.pki.certificateFromPem(
    readFileSync(config.signerCertPath, "utf8")
  );
  const wwdr = forge.pki.certificateFromPem(
    readFileSync(config.wwdrCertPath, "utf8")
  );
  const key = privateKeyFromPem(
    readFileSync(config.signerKeyPath, "utf8"),
    config.signerKeyPass
  );

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString("utf8"), "utf8");
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    // The attribute set openssl's `smime -sign` produces, so the
    // structural test can hand the result to `openssl cms -verify`.
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      // @types narrows `value` to string; forge's own signedData example
      // passes a Date here and DER-encodes it as UTCTime for signingTime.
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
      { type: forge.pki.oids.messageDigest },
    ],
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
}

/** Assemble the whole .pkpass (a zip with all four entries at its root). */
export function buildPkpass(
  config: PassConfig,
  ticket: PassTicket,
  labels: PassLabels,
  iconPath: string = PASS_ICON_PATH
): Buffer {
  const passJson = Buffer.from(
    JSON.stringify(buildPassJson(config, ticket, labels)),
    "utf8"
  );
  const icon = readFileSync(iconPath);
  const files: Record<string, Buffer> = {
    "pass.json": passJson,
    "icon.png": icon,
  };
  const manifest = Buffer.from(buildManifest(files), "utf8");
  const signature = signManifest(manifest, config);

  const zip = new AdmZip();
  zip.addFile("pass.json", passJson);
  zip.addFile("icon.png", icon);
  zip.addFile("manifest.json", manifest);
  zip.addFile("signature", signature);
  return zip.toBuffer();
}
