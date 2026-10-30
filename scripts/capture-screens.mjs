/**
 * Refait les captures de l'outil utilisées par le site (public/screens/).
 *
 * Prérequis : l'outil tourne en local sur http://localhost:3000 (branche develop,
 * base Neon DEV) et Google Chrome est installé.
 * Les identifiants du compte client démo sont lus dans le .env.local de l'outil
 * (DEV_TEST_CLIENT_EMAIL / DEV_TEST_CLIENT_PASSWORD) et ne sont jamais affichés.
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

// Écrans du site : nom du fichier → page de l'outil (m- = format téléphone)
const SHOTS = [
  { name: "dashboard", path: "/dashboard" },
  { name: "collection-new", path: "/collections/new" },
  { name: "allocations", path: "/allocations" },
  { name: "reports", path: "/reports" },
  { name: "m-dashboard", path: "/dashboard", mobile: true },
  { name: "m-collection-new", path: "/collections/new", mobile: true },
];

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (!env.DEV_TEST_CLIENT_EMAIL || !env.DEV_TEST_CLIENT_PASSWORD) {
  console.error("DEV_TEST_CLIENT_EMAIL / DEV_TEST_CLIENT_PASSWORD absents de", envPath);
  process.exit(1);
}

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: env.DEV_TEST_CLIENT_EMAIL, password: env.DEV_TEST_CLIENT_PASSWORD }),
});
if (!login.ok) {
  console.error("Connexion au compte démo impossible :", login.status);
  process.exit(1);
}
const cookies = login.headers.getSetCookie().map((c) => {
  const [nv] = c.split(";");
  const i = nv.indexOf("=");
  return { name: nv.slice(0, i), value: nv.slice(i + 1), url: BASE };
});

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "optispace-shots-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--force-color-profile=srgb", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setCookies", { cookies });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });

  let first = true;
  for (const s of SHOTS) {
    await send("Emulation.setDeviceMetricsOverride", { width: s.mobile ? 390 : 1440, height: s.mobile ? 844 : 900, deviceScaleFactor: 2, mobile: !!s.mobile });
    await send("Page.navigate", { url: BASE + s.path });
    await sleep(first ? 20000 : 8000); // la première page compile en mode dev
    first = false;
    // Masque le badge de développement de Next.js
    await send("Runtime.evaluate", { expression: "document.head.insertAdjacentHTML('beforeend','<style>nextjs-portal{display:none!important}</style>')" });
    await sleep(400);
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, `${s.name}.png`), Buffer.from(r.result.data, "base64"));
    console.log("✓", s.name);
  }
  ws.close();
} catch (err) {
  console.error("Capture interrompue :", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await new Promise((r) => (chrome.exitCode !== null ? r() : chrome.once("exit", r)));
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
