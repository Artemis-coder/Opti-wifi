// ============================================================
// OPTIWIFI - Modèles open source (Groq, OpenRouter gratuits, Together) pour l'assistant du bot,
// utilisés en relais quand Claude n'est pas disponible (pas de clé, pas de crédit, panne).
// API compatible « chat completions » avec appels d'outils.
// Les modèles réellement disponibles sont découverts auprès de chaque fournisseur
// (les catalogues changent souvent), puis classés par préférence.
// ============================================================

export type OpenProvider = 'groq' | 'openrouter' | 'together';

export interface OpenModel {
  provider: OpenProvider;
  model: string;
  label: string;
}

interface ProviderConfig {
  key: string | undefined;
  url: string;
  name: string;
  /** Modèles connus, utilisés si la découverte échoue. */
  fallback: string[];
}

function providers(): Record<OpenProvider, ProviderConfig> {
  return {
    groq: {
      key: process.env.GROQ_API_KEY?.trim(),
      url: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      name: 'Groq',
      fallback: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
    },
    openrouter: {
      key: process.env.OPENROUTER_API_KEY?.trim(),
      url: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      name: 'OpenRouter',
      fallback: ['openai/gpt-oss-120b:free', 'meta-llama/llama-3.3-70b-instruct:free'],
    },
    together: {
      key: process.env.TOGETHER_API_KEY?.trim(),
      url: process.env.TOGETHER_BASE_URL || 'https://api.together.xyz/v1',
      name: 'Together',
      fallback: ['openai/gpt-oss-120b', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'],
    },
  };
}

// Préférence : modèles les plus fiables en appels d'outils d'abord
const PREFERENCE = [
  /gpt-oss-120b/i,
  /llama-4-maverick/i,
  /kimi-k2/i,
  /qwen3?-?235b|qwen3-coder/i,
  /llama-3\.3-70b/i,
  /deepseek-(chat|v3)/i,
  /gpt-oss-20b/i,
  /llama-4-scout/i,
  /qwen3-32b|qwen-?2\.5-72b/i,
  /mistral-(small|medium)/i,
  /llama-3\.1-8b/i,
];
const EXCLUDED = /whisper|guard|tts|embed|vision|audio|compound|orpheus|distil|safeguard/i;
const MAX_MODELS_PER_PROVIDER = 4;

function rank(ids: string[]): string[] {
  const score = (id: string) => {
    const i = PREFERENCE.findIndex((re) => re.test(id));
    return i === -1 ? PREFERENCE.length : i;
  };
  return ids
    .filter((id) => !EXCLUDED.test(id) && score(id) < PREFERENCE.length)
    .sort((a, b) => score(a) - score(b))
    .slice(0, MAX_MODELS_PER_PROVIDER);
}

const discovered = new Map<OpenProvider, { at: number; models: string[] }>();
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

async function discoverModels(provider: OpenProvider, cfg: ProviderConfig): Promise<string[]> {
  const cached = discovered.get(provider);
  if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) return cached.models;
  let models: string[] = [];
  try {
    const res = await fetch(`${cfg.url}/models`, {
      headers: provider === 'openrouter' ? {} : { Authorization: `Bearer ${cfg.key}` },
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    const list: { id: string; supported_parameters?: string[]; active?: boolean }[] = Array.isArray(data?.data) ? data.data : [];
    if (provider === 'openrouter') {
      // Sans crédit acheté, seuls les modèles « :free » sont utilisables ; il faut qu'ils gèrent les outils
      models = rank(list.filter((m) => m.id.endsWith(':free') && m.supported_parameters?.includes('tools')).map((m) => m.id));
    } else {
      models = rank(list.filter((m) => m.active !== false).map((m) => m.id));
    }
  } catch {
    // découverte impossible : on garde la liste connue
  }
  if (models.length === 0) models = cfg.fallback;
  discovered.set(provider, { at: Date.now(), models });
  return models;
}

export function isOpenModelAvailable(): boolean {
  return Object.values(providers()).some((p) => Boolean(p.key));
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface FunctionTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface OpenCompletion {
  model: OpenModel;
  content: string;
  toolCalls: ToolCall[];
}

/** Raison lisible d'un échec chez un fournisseur. */
function describeFailure(status: number, message: string, retryAfter: number | null): string {
  if (status === 429) {
    if (!retryAfter) return 'quota atteint';
    return `quota atteint, réessayez dans ${retryAfter > 90 ? `${Math.ceil(retryAfter / 60)} min` : `${Math.ceil(retryAfter)} s`}`;
  }
  if (status === 401 || status === 403) return 'clé API invalide';
  if (status === 402 || /credit/i.test(message)) return 'crédit insuffisant';
  if (status === 404) return 'modèle indisponible';
  if (status === 413 || /too large|context/i.test(message)) return 'demande trop longue';
  if (status >= 500) return 'service en panne';
  return `erreur ${status}`;
}

/** Délai demandé par le fournisseur (en-tête retry-after ou « try again in 7.5s »). */
function retryDelaySeconds(res: Response, message: string): number | null {
  const header = Number(res.headers.get('retry-after'));
  if (Number.isFinite(header) && header > 0) return header;
  const m = message.match(/try again in (?:(\d+)m)?([\d.]+)s/i);
  return m ? Number(m[1] || 0) * 60 + Number(m[2]) : null;
}

export class OpenModelsUnavailableError extends Error {
  constructor(public reasons: Partial<Record<OpenProvider, string>>) {
    super('Aucun modèle open source disponible');
  }
  /** Ex. [« Groq : quota atteint, réessayez dans 12 s », « OpenRouter : crédit insuffisant »] */
  lines(): string[] {
    const names = providers();
    return (Object.keys(this.reasons) as OpenProvider[]).map((p) => `${names[p].name} : ${this.reasons[p]}`);
  }
  summary(): string {
    return this.lines().join(' · ');
  }
}

const MAX_WAIT_SECONDS = 20;

/**
 * Appelle le premier modèle qui répond. `preferred` garde le même modèle pendant une conversation
 * à plusieurs étapes. Sur une limite de débit courte, attend puis réessaie une fois.
 */
export async function openModelCompletion(
  messages: ChatMessage[],
  tools: FunctionTool[],
  preferred?: OpenModel | null
): Promise<OpenCompletion> {
  const all = providers();
  const order: OpenProvider[] = ['groq', 'openrouter', 'together'];
  const candidates: OpenModel[] = [];
  for (const provider of order) {
    const cfg = all[provider];
    if (!cfg.key) continue;
    for (const model of await discoverModels(provider, cfg)) {
      candidates.push({ provider, model, label: `${model.split('/').pop()?.replace(/:free$/, '')} (${cfg.name})` });
    }
  }
  if (preferred) {
    const i = candidates.findIndex((c) => c.provider === preferred.provider && c.model === preferred.model);
    if (i > 0) candidates.unshift(...candidates.splice(i, 1));
  }
  if (candidates.length === 0) throw new OpenModelsUnavailableError({});

  const reasons: Partial<Record<OpenProvider, string>> = {};
  const failedProviders = new Set<OpenProvider>();
  let waited = false;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    // Clé invalide ou crédit absent : inutile d'essayer les autres modèles du même fournisseur
    if (failedProviders.has(candidate.provider)) continue;
    const cfg = all[candidate.provider];
    try {
      const res = await fetch(`${cfg.url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.key}`,
          ...(candidate.provider === 'openrouter' ? { 'HTTP-Referer': 'https://www.optiwifi.site', 'X-Title': 'OptiSpace Bot' } : {}),
        },
        body: JSON.stringify({ model: candidate.model, messages, tools, tool_choice: 'auto', temperature: 0.2, max_tokens: 2000 }),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = String(data?.error?.message || '');
        const retryAfter = res.status === 429 ? retryDelaySeconds(res, message) : null;
        if (res.status === 429 && retryAfter !== null && retryAfter <= MAX_WAIT_SECONDS && !waited) {
          // Limite de débit courte : on attend une fois puis on réessaie le même modèle
          waited = true;
          await new Promise((r) => setTimeout(r, Math.ceil(retryAfter * 1000) + 300));
          i--;
          continue;
        }
        reasons[candidate.provider] = describeFailure(res.status, message, retryAfter);
        if ([401, 402, 403].includes(res.status)) failedProviders.add(candidate.provider);
        console.warn(`Open model ${candidate.label} failed: ${res.status} ${message.slice(0, 160)}`);
        continue;
      }
      const message = data.choices?.[0]?.message || {};
      return {
        model: candidate,
        content: typeof message.content === 'string' ? message.content : '',
        toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
      };
    } catch (err) {
      reasons[candidate.provider] = err instanceof Error && err.name === 'TimeoutError' ? 'délai dépassé' : 'injoignable';
    }
  }
  throw new OpenModelsUnavailableError(reasons);
}
