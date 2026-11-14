/**
 * Refait les captures de l'outil utilisées par le site (public/screens/).
 *
 * Prérequis : l'outil tourne en local sur http://localhost:3000 (branche develop,
 * base Neon DEV) et Google Chrome est installé.
 * Comptes de démonstration lus dans le .env.local de l'outil (jamais affichés) :
 *   administrateur  DEV_TEST_CLIENT_EMAIL / DEV_TEST_CLIENT_PASSWORD
 *   collecteur      DEV_TEST_COLLECTOR_EMAIL / DEV_TEST_COLLECTOR_PASSWORD
 *   point de vente  DEV_TEST_POS_PHONE / DEV_TEST_POS_PASSWORD (connexion par téléphone)
 *
 *   node scripts/capture-screens.mjs ../.env.local
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envPath = process.argv[2] ?? "../.env.local";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "screens");
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.CDP_PORT ?? 9444);

// Écrans du site par compte : nom du fichier → page de l'outil (mobile = format téléphone)
const ACCOUNTS = [
  {
    id: "administrateur",
    login: ["DEV_TEST_CLIENT_EMAIL", "DEV_TEST_CLIENT_PASSWORD"],
    shots: [
      { name: "dashboard", path: "/dashboard" },
      { name: "collection-new", path: "/collections/new" },
      { name: "allocations", path: "/allocations" },
      { name: "reports", path: "/reports" },
      { name: "m-dashboard", path: "/dashboard", mobile: true },
      { name: "m-collection-new", path: "/collections/new", mobile: true },
    ],
  },
  {
    id: "collecteur",
    login: ["DEV_TEST_COLLECTOR_EMAIL", "DEV_TEST_COLLECTOR_PASSWORD"],
    shots: [
      { name: "collector-dashboard", path: "/dashboard" },
      { name: "m-collector-dashboard", path: "/dashboard", mobile: true },
    ],
  },
  {
    id: "point de vente",
    login: ["DEV_TEST_POS_PHONE", "DEV_TEST_POS_PASSWORD"],
    shots: [
      { name: "pos-dashboard", path: "/dashboard" },
      { name: "m-pos-dashboard", path: "/dashboard", mobile: true },
    ],
  },
];

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loginCookies([idKey, pwdKey]) {
  if (!env[idKey] || !env[pwdKey]) throw new Error(`${idKey} / ${pwdKey} absents de ${envPath}`);
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: env[idKey], password: env[pwdKey] }),
  });
  if (!res.ok) throw new Error(`connexion refusée (${res.status}) pour ${idKey}`);
  return res.headers.getSetCookie().map((c) => {
    const [nv] = c.split(";");
    const i = nv.indexOf("=");
    return { name: nv.slice(0, i), value: nv.slice(i + 1), url: BASE };
  });
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "optispace-shots-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--force-color-profile=srgb", "about:blank"], { stdio: "ignore" });

try {
  let targets;
  for (let i = 0; i < 20 && !targets; i++) {
    await sleep(500);
    targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => undefined);
  }
  if (!targets) throw new Error(`Chrome ne répond pas sur le port ${PORT}`);
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  await send("Page.enable");
  await send("Network.enable");
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });

  let first = true;
  for (const account of ACCOUNTS) {
    await send("Network.clearBrowserCookies");
    await send("Network.setCookies", { cookies: await loginCookies(account.login) });
    for (const s of account.shots) {
      await send("Emulation.setDeviceMetricsOverride", { width: s.mobile ? 390 : 1440, height: s.mobile ? 844 : 900, deviceScaleFactor: 2, mobile: !!s.mobile });
      await send("Page.navigate", { url: BASE + s.path });
      await sleep(first ? 20000 : 8000); // la première page compile en mode dev
      first = false;
      // Ferme les invitations (notifications « Plus tard », visite guidée « Passer ») et masque le badge de développement
      await send("Runtime.evaluate", {
        expression: `document.querySelectorAll('button').forEach((b) => { if (/^\\s*(Plus tard|Passer)\\s*$/i.test(b.textContent || '')) b.click(); });
          document.head.insertAdjacentHTML('beforeend','<style>nextjs-portal{display:none!important}</style>');`,
      });
      await sleep(900);
      const r = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUT, `${s.name}.png`), Buffer.from(r.result.data, "base64"));
      console.log(`✓ ${s.name} (${account.id})`);
    }
  }
  ws.close();
  // Nouvelle version des captures : force le renouvellement des images optimisées
  const versionFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "screens.ts");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  fs.writeFileSync(versionFile, fs.readFileSync(versionFile, "utf8").replace(/SCREENS_VERSION = "[^"]*"/, `SCREENS_VERSION = "${stamp}"`));
  console.log(`Version des captures : ${stamp}`);
} catch (err) {
  console.error("Capture interrompue :", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await new Promise((r) => (chrome.exitCode !== null ? r() : chrome.once("exit", r)));
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
