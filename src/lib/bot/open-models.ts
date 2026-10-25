// ============================================================
// OPTIWIFI - Modèles open source (Groq, Together, OpenRouter) pour l'assistant du bot,
// utilisés en relais quand Claude n'est pas disponible (pas de clé, pas de crédit, panne).
// API compatible « chat completions » avec appels d'outils.
// ============================================================

export interface OpenModel {
  provider: 'groq' | 'together' | 'openrouter';
  model: string;
  label: string;
}

interface ProviderConfig {
  key: string | undefined;
  url: string;
  models: Omit<OpenModel, 'provider'>[];
}

// Ordre de préférence : modèles les plus fiables en appels d'outils d'abord.
// Un modèle retiré ou indisponible est simplement sauté.
function providers(): Record<OpenModel['provider'], ProviderConfig> {
  return {
    groq: {
      key: process.env.GROQ_API_KEY?.trim(),
      url: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      models: [
        { model: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)' },
        { model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' },
        { model: 'moonshotai/kimi-k2-instruct', label: 'Kimi K2 (Groq)' },
        { model: 'qwen/qwen3-32b', label: 'Qwen3 32B (Groq)' },
      ],
    },
    together: {
      key: process.env.TOGETHER_API_KEY?.trim(),
      url: process.env.TOGETHER_BASE_URL || 'https://api.together.xyz/v1',
      models: [
        { model: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Together)' },
        { model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B (Together)' },
      ],
    },
    openrouter: {
      key: process.env.OPENROUTER_API_KEY?.trim(),
      url: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      models: [
        { model: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (OpenRouter)' },
        { model: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (OpenRouter)' },
      ],
    },
  };
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

/**
 * Appelle le premier modèle qui répond. `preferred` permet de rester sur le même modèle
 * pendant une conversation à plusieurs étapes. Lève une erreur si aucun ne répond.
 */
export async function openModelCompletion(
  messages: ChatMessage[],
  tools: FunctionTool[],
  preferred?: OpenModel | null
): Promise<OpenCompletion> {
  const all = providers();
  const candidates: OpenModel[] = (Object.keys(all) as OpenModel['provider'][]).flatMap((provider) =>
    all[provider].key ? all[provider].models.map((m) => ({ provider, ...m })) : []
  );
  if (preferred) {
    const i = candidates.findIndex((c) => c.provider === preferred.provider && c.model === preferred.model);
    if (i > 0) candidates.unshift(...candidates.splice(i, 1));
  }
  if (candidates.length === 0) throw new Error('Aucune clé GROQ_API_KEY, TOGETHER_API_KEY ou OPENROUTER_API_KEY configurée');

  const errors: string[] = [];
  for (const candidate of candidates) {
    const cfg = all[candidate.provider];
    try {
      const res = await fetch(`${cfg.url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.key}`,
          ...(candidate.provider === 'openrouter' ? { 'HTTP-Referer': 'https://www.optiwifi.site', 'X-Title': 'OptiSpace Bot' } : {}),
        },
        body: JSON.stringify({
          model: candidate.model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 3000,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        errors.push(`${candidate.label}: ${res.status} ${String(data?.error?.message || '').slice(0, 120)}`);
        continue;
      }
      const message = data.choices?.[0]?.message || {};
      return {
        model: candidate,
        content: typeof message.content === 'string' ? message.content : '',
        toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
      };
    } catch (err) {
      errors.push(`${candidate.label}: ${err instanceof Error ? err.name : 'erreur'}`);
    }
  }
  console.error('Open models unavailable:', errors.join(' | '));
  throw new Error(`Aucun modèle open source disponible (${errors.length} essayés)`);
}
