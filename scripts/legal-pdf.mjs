/**
 * Génère les PDF téléchargeables des CGU et CGV (public/legal/) à partir des pages
 * /cgu et /cgv : le texte téléchargé est toujours celui affiché sur le site.
 *
 * Prérequis : le site tourne (npm run dev ou npm run start, port 3001) et Google Chrome est installé.
 *   npm run legal:pdf                      # http://localhost:3001
 *   SITE=https://… npm run legal:pdf       # autre adresse
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.SITE ?? "http://localhost:3001").replace(/\/$/, "");
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "legal");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.CDP_PORT ?? 9445);
const DOCS = [
  { path: "/cgu", file: "optispace-cgu.pdf", title: "Conditions générales d'utilisation" },
  { path: "/cgv", file: "optispace-cgv.pdf", title: "Conditions générales de vente" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "optispace-pdf-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

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
  for (const d of DOCS) {
    await send("Page.navigate", { url: BASE + d.path });
    await sleep(6000);
    const footer = `<div style="width:100%;font-size:8px;color:#52665a;padding:0 14mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>OptiSpace — ${d.title}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
    const r = await send("Page.printToPDF", {
      paperWidth: 8.27,
      paperHeight: 11.69,
      marginTop: 0.5,
      marginBottom: 0.7,
      marginLeft: 0.4,
      marginRight: 0.4,
      printBackground: false,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footer,
    });
    if (!r.result) throw new Error(`PDF impossible pour ${d.path} : ${JSON.stringify(r.error)}`);
    fs.writeFileSync(path.join(OUT, d.file), Buffer.from(r.result.data, "base64"));
    console.log("✓", d.file);
  }
  ws.close();
} catch (err) {
  console.error("Génération interrompue :", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await new Promise((r) => (chrome.exitCode !== null ? r() : chrome.once("exit", r)));
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
