import { NextResponse } from 'next/server';
import { hydrateTelegramEnv } from '@/lib/integration-secrets';
import { isDevAgentRequest } from '@/lib/dev-agent-auth';
import {
  branchSha,
  compareBranches,
  createRelease,
  getFile,
  isGitHubConfigured,
  latestReleaseTag,
  nextVersion,
  putFile,
} from '@/lib/github';
import { sendBotMessage } from '@/lib/bot/assistant';
import { escapeTelegramHtml } from '@/lib/telegram';

// Release après une mise en production validée depuis Telegram : la routine Claude rédige les notes,
// l'application les enregistre sur develop (RELEASE_NOTES + README) et crée la release sur main.
export async function POST(request: Request) {
  if (!isDevAgentRequest(request)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!isGitHubConfigured()) return NextResponse.json({ error: 'GITHUB_TOKEN absent' }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { bump?: string; title?: string; notes?: string };
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
  const bump = body.bump === 'patch' ? 'patch' : 'minor';
  if (!notes || !title) return NextResponse.json({ error: 'title et notes requis' }, { status: 400 });

  const current = await latestReleaseTag();
  if (current) {
    const diff = await compareBranches(current, 'main');
    if (diff.ahead_by === 0) return NextResponse.json({ error: `main est déjà publiée en ${current}` }, { status: 409 });
  }
  const version = nextVersion(current, bump);
  const mainSha = await branchSha('main');
  const file = `RELEASE_NOTES_${version}.md`;
  const markdown = notes.startsWith('#') ? notes : `# OptiSpace ${version} — ${title}\n\n${notes}`;

  // Notes et README sur develop (arriveront sur main à la prochaine mise en production)
  try {
    await putFile(file, 'develop', `${markdown}\n`, `docs: notes de version ${version}`);
    const readme = await getFile('README.md', 'develop');
    if (readme) {
      const updated = readme.text.replace(
        /<strong>Version actuelle : v[\d.]+<\/strong> — <a href="\.\/RELEASE_NOTES_v[\d.]+\.md">/,
        `<strong>Version actuelle : ${version}</strong> — <a href="./${file}">`,
      );
      if (updated !== readme.text) await putFile('README.md', 'develop', updated, `docs: README sur ${version}`, readme.sha);
    }
  } catch (err) {
    console.error('Release notes commit error:', err instanceof Error ? err.message : err);
  }

  const release = await createRelease(version, mainSha, `${version} — ${title}`, markdown);

  await hydrateTelegramEnv();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (chatId) {
    await sendBotMessage(chatId, `🏷️ <b>Release ${version} publiée</b> — ${escapeTelegramHtml(title)}\n<a href="${release.html_url}">Voir les notes de version</a>`);
  }
  return NextResponse.json({ ok: true, version, url: release.html_url });
}
