// ============================================================
// OPTIWIFI - Accès GitHub de l'application (PR et releases du dépôt du projet uniquement).
// Jeton GITHUB_TOKEN : jeton « fine-grained » limité au dépôt, droits Contents + Pull requests.
// ============================================================

export const GITHUB_REPO = 'Artemis-coder/Opti-wifi';
export const REPO_URL = `https://github.com/${GITHUB_REPO}`;
const API = `https://api.github.com/repos/${GITHUB_REPO}`;

export function isGitHubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN?.trim());
}

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) throw new GitHubError(0, 'GITHUB_TOKEN absent');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new GitHubError(res.status, body.message?.slice(0, 200) || `GitHub ${res.status}`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export interface PullRequest {
  number: number;
  html_url: string;
  state: string;
  merged?: boolean;
  head: { ref: string; sha: string };
}

/** PR ouverte head → base, ou création. */
export async function openPullRequest(head: string, base: string, title: string, body: string): Promise<PullRequest> {
  const owner = GITHUB_REPO.split('/')[0];
  const open = await gh<PullRequest[]>(`/pulls?state=open&base=${encodeURIComponent(base)}&head=${encodeURIComponent(`${owner}:${head}`)}`);
  if (open[0]) return open[0];
  return gh<PullRequest>(`/pulls`, { method: 'POST', body: JSON.stringify({ head, base, title: title.slice(0, 200), body: body.slice(0, 60000) }) });
}

export async function getPullRequest(n: number): Promise<PullRequest> {
  return gh<PullRequest>(`/pulls/${n}`);
}

/** Fusion avec commit de fusion (jamais squash/rebase, cf. docs/PROCEDURE_DEPLOIEMENT.md). */
export async function mergePullRequest(n: number, title: string): Promise<{ sha: string }> {
  return gh<{ sha: string }>(`/pulls/${n}/merge`, { method: 'PUT', body: JSON.stringify({ merge_method: 'merge', commit_title: title.slice(0, 200) }) });
}

export interface CompareResult {
  ahead_by: number;
  files?: { filename: string }[];
  commits: { sha: string; commit: { message: string } }[];
}

export async function compareBranches(base: string, head: string): Promise<CompareResult> {
  return gh<CompareResult>(`/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`);
}

export async function branchSha(branch: string): Promise<string> {
  const ref = await gh<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`);
  return ref.object.sha;
}

export async function latestReleaseTag(): Promise<string | null> {
  try {
    const r = await gh<{ tag_name: string }>(`/releases/latest`);
    return r.tag_name;
  } catch (err) {
    if (err instanceof GitHubError && err.status === 404) return null;
    throw err;
  }
}

export async function createRelease(tag: string, targetSha: string, name: string, body: string): Promise<{ html_url: string }> {
  return gh<{ html_url: string }>(`/releases`, {
    method: 'POST',
    body: JSON.stringify({ tag_name: tag, target_commitish: targetSha, name: name.slice(0, 200), body: body.slice(0, 120000), make_latest: 'true' }),
  });
}

/** Lit un fichier texte d'une branche (null s'il n'existe pas). */
export async function getFile(path: string, ref: string): Promise<{ sha: string; text: string } | null> {
  try {
    const f = await gh<{ sha: string; content: string }>(`/contents/${path}?ref=${encodeURIComponent(ref)}`);
    return { sha: f.sha, text: Buffer.from(f.content, 'base64').toString('utf8') };
  } catch (err) {
    if (err instanceof GitHubError && err.status === 404) return null;
    throw err;
  }
}

/** Crée ou remplace un fichier sur une branche (un commit). */
export async function putFile(path: string, branch: string, text: string, message: string, sha?: string): Promise<void> {
  await gh(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, branch, content: Buffer.from(text, 'utf8').toString('base64'), ...(sha ? { sha } : {}) }),
  });
}

/** vX.Y.Z suivante : nouveautés → Y+1, corrections seules → Z+1. */
export function nextVersion(current: string | null, kind: 'minor' | 'patch'): string {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(current || '');
  if (!m) return 'v1.0.0';
  const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return kind === 'minor' ? `v${maj}.${min + 1}.0` : `v${maj}.${min}.${pat + 1}`;
}
