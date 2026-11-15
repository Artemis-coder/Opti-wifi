// Lance le build de production en local SUR LA BASE DEV : les variables de .env.local sont
// imposées (prioritaires sur .env.production*, qui pointent vers la production) et
// VERCEL_ENV=preview active le garde-fou (src/lib/env-guard.ts) qui refuse la base de prod.
import fs from 'fs';
import { spawn } from 'child_process';
const env = { ...process.env, VERCEL_ENV: 'preview' };
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
if (!String(env.DATABASE_URL).includes('ep-crimson-shape')) throw new Error('.env.local ne pointe pas vers la base dev');
spawn('npx', ['next', 'start', '-p', process.argv[2] || '3100'], { stdio: 'inherit', env });
