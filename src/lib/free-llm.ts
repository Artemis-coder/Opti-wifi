/**
 * Free LLM Provider with multiple fallback options
 * Supports: OpenRouter, Groq, Together AI, Hugging Face, etc.
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Model mappings for different providers
export const FREE_MODELS = {
  // OpenRouter models (require credits)
  'openrouter/deepseek-chat': { provider: 'openrouter', model: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', context: 32768 },
  'openrouter/deepseek-r1': { provider: 'openrouter', model: 'deepseek/deepseek-r1', name: 'DeepSeek R1', context: 32768 },
  'openrouter/llama-3.1-8b': { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', context: 131072 },
  'openrouter/llama-3.1-70b': { provider: 'openrouter', model: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', context: 131072 },
  'openrouter/mistral-7b': { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', context: 32768 },
  'openrouter/mixtral-8x7b': { provider: 'openrouter', model: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', context: 32768 },
  'openrouter/qwen-2.5-7b': { provider: 'openrouter', model: 'qwen/qwen-2.5-7b-instruct', name: 'Qwen 2.5 7B', context: 32768 },
  'openrouter/gemma-2-9b': { provider: 'openrouter', model: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', context: 8192 },
  'openrouter/phi-3-mini': { provider: 'openrouter', model: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini', context: 128000 },
  'openrouter/phi-3-medium': { provider: 'openrouter', model: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium', context: 128000 },
  'openrouter/phi-3-vision': { provider: 'openrouter', model: 'microsoft/phi-3-vision-128k-instruct', name: 'Phi-3 Vision', context: 128000, vision: true },
  'openrouter/qwen-vl': { provider: 'openrouter', model: 'qwen/qwen-2.5-vl-7b-instruct', name: 'Qwen 2.5 VL 7B', context: 32768, vision: true },
  'openrouter/llama-vision': { provider: 'openrouter', model: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', context: 131072, vision: true },
  'openrouter/whisper': { provider: 'openrouter', model: 'openai/whisper-large-v3', name: 'Whisper Large v3', context: 0, audio: true },
  
  // Groq models (free tier available)
  'groq/llama-3.1-8b': { provider: 'groq', model: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Groq)', context: 8192 },
  'groq/llama-3.1-70b': { provider: 'groq', model: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Groq)', context: 8192 },
  'groq/mixtral-8x7b': { provider: 'groq', model: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', context: 32768 },
  'groq/gemma-7b': { provider: 'groq', model: 'gemma-7b-it', name: 'Gemma 7B (Groq)', context: 8192 },
  'groq/gemma2-9b': { provider: 'groq', model: 'gemma2-9b-it', name: 'Gemma 2 9B (Groq)', context: 8192 },
  
  // Together AI models (free tier)
  'together/llama-3.1-8b': { provider: 'together', model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', name: 'Llama 3.1 8B (Together)', context: 4096 },
  'together/llama-3.1-70b': { provider: 'together', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B (Together)', context: 4096 },
  'together/mixtral-8x7b': { provider: 'together', model: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B (Together)', context: 4096 },
  'together/qwen-2.5-7b': { provider: 'together', model: 'Qwen/Qwen2.5-7B-Instruct-Turbo', name: 'Qwen 2.5 7B (Together)', context: 4096 },
  'together/phi-3-mini': { provider: 'together', model: 'microsoft/Phi-3-mini-128k-instruct', name: 'Phi-3 Mini (Together)', context: 4096 },
  
  // Default fallback
  DEFAULT: 'groq/llama-3.1-8b' // Groq has generous free tier
} as const;

export type ModelId = keyof typeof FREE_MODELS;

export interface ModelInfo {
  provider: 'openrouter' | 'groq' | 'together';
  model: string;
  name: string;
  context: number;
  vision?: boolean;
  audio?: boolean;
}

export function getModelInfo(modelId: ModelId): ModelInfo {
  return FREE_MODELS[modelId] as ModelInfo;
}

export function getAvailableProviders(): Array<'openrouter' | 'groq' | 'together'> {
  const providers: Array<'openrouter' | 'groq' | 'together'> = [];
  if (OPENROUTER_API_KEY) providers.push('openrouter');
  if (GROQ_API_KEY) providers.push('groq');
  if (TOGETHER_API_KEY) providers.push('together');
  return providers;
}

// Auto-select best available model
export function selectBestAvailableModel(
  userMessage: string,
  hasImage: boolean = false,
  hasAudio: boolean = false,
  context: string = 'general'
): ModelId {
  const availableProviders = getAvailableProviders();
  
  // If no providers available, return default
  if (availableProviders.length === 0) {
    return FREE_MODELS.DEFAULT as ModelId;
  }
  
  // Prefer Groq for free tier (no credits needed)
  if (availableProviders.includes('groq')) {
    if (hasAudio) {
      // Groq doesn't have audio transcription, fall back to OpenRouter or Together
      if (availableProviders.includes('openrouter')) {
        return 'openrouter/whisper';
      }
      return 'together/llama-3.1-8b'; // fallback
    }
    if (hasImage) {
      // Groq doesn't have vision, fall back
      if (availableProviders.includes('openrouter')) {
        return 'openrouter/phi-3-vision';
      }
      return 'together/llama-3.1-8b';
    }
    
    const msg = userMessage.toLowerCase();
    const reasoningKeywords = ['raisonne', 'réfléchis', 'analyse', 'complexe', 'étape par étape', 'reasoning', 'step by step'];
    if (reasoningKeywords.some(k => msg.includes(k))) {
      return 'groq/llama-3.1-70b'; // Best for reasoning on Groq
    }
    
    const codingKeywords = ['code', 'programme', 'function', 'api', 'database', 'sql', 'typescript', 'javascript', 'python', 'react', 'nextjs', 'vercel', 'deploy', 'debug', 'erreur', 'bug', 'fix', 'corrige'];
    if (codingKeywords.some(k => msg.includes(k))) {
      return 'groq/llama-3.1-70b';
    }
    
    const longContextKeywords = ['long', 'détail', 'complet', 'exhaustif', 'tout l\'historique', 'contexte complet'];
    if (longContextKeywords.some(k => msg.includes(k)) || userMessage.length > 2000) {
      return 'groq/mixtral-8x7b'; // Good context on Groq
    }
    
    const simpleKeywords = ['bonjour', 'salut', 'merci', 'ok', 'oui', 'non', 'hello', 'hi'];
    if (simpleKeywords.some(k => msg === k || msg.startsWith(k + ' ')) && userMessage.length < 50) {
      return 'groq/gemma2-9b'; // Fast on Groq
    }
    
    switch (context) {
      case 'database':
      case 'deployment':
      case 'security':
        return 'groq/llama-3.1-70b';
      case 'tasks':
      case 'project':
        return 'groq/llama-3.1-70b';
      default:
        return 'groq/llama-3.1-8b'; // Default fast model
    }
  }
  
  // Fallback to Together AI
  if (availableProviders.includes('together')) {
    if (hasAudio || hasImage) {
      if (availableProviders.includes('openrouter')) {
        return hasAudio ? 'openrouter/whisper' : 'openrouter/phi-3-vision';
      }
    }
    return 'together/llama-3.1-8b';
  }
  
  // Fallback to OpenRouter (if credits available)
  if (availableProviders.includes('openrouter')) {
    const msg = userMessage.toLowerCase();
    if (hasAudio) return 'openrouter/whisper';
    if (hasImage) return 'openrouter/phi-3-vision';
    if (msg.includes('raisonne') || msg.includes('reasoning')) return 'openrouter/deepseek-r1';
    return 'openrouter/deepseek-chat';
  }
  
  return FREE_MODELS.DEFAULT as ModelId;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: any[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: any[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class FreeLLMClient {
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const modelInfo = getModelInfo(request.model as ModelId);
    const provider = modelInfo.provider;
    
    switch (provider) {
      case 'groq':
        return this.chatCompletionGroq(request, modelInfo.model);
      case 'together':
        return this.chatCompletionTogether(request, modelInfo.model);
      case 'openrouter':
        return this.chatCompletionOpenRouter(request, modelInfo.model);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
  
  private async chatCompletionGroq(request: ChatCompletionRequest, model: string): Promise<ChatCompletionResponse> {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        ...request,
        model,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }
    
    return response.json();
  }
  
  private async chatCompletionTogether(request: ChatCompletionRequest, model: string): Promise<ChatCompletionResponse> {
    if (!TOGETHER_API_KEY) throw new Error('TOGETHER_API_KEY not configured');
    
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
        ...request,
        model,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Together AI error: ${response.status} - ${error}`);
    }
    
    return response.json();
  }
  
  private async chatCompletionOpenRouter(request: ChatCompletionRequest, model: string): Promise<ChatCompletionResponse> {
    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://www.optiwifi.site',
        'X-Title': 'OptiWifi Telegram Bot',
      },
      body: JSON.stringify({
        ...request,
        model,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }
    
    return response.json();
  }
  
  async transcribeAudio(audioBuffer: Buffer, language?: string, model?: string): Promise<string> {
    // Try OpenRouter first for transcription
    if (OPENROUTER_API_KEY) {
      try {
        return await this.transcribeAudioOpenRouter(audioBuffer, language, model || 'openai/whisper-large-v3');
      } catch (e) {
        console.warn('OpenRouter transcription failed, trying Groq:', e);
      }
    }
    
    // Groq has Whisper transcription
    if (GROQ_API_KEY) {
      return await this.transcribeAudioGroq(audioBuffer, language);
    }
    
    throw new Error('No transcription provider available');
  }
  
  private async transcribeAudioOpenRouter(audioBuffer: Buffer, language?: string, model?: string): Promise<string> {
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer as unknown as BlobPart], { type: 'audio/ogg; codecs=opus' });
    formData.append('file', audioBlob, 'voice.oga');
    formData.append('model', model || 'openai/whisper-large-v3');
    if (language) formData.append('language', language);
    formData.append('response_format', 'json');
    
    const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter transcription error: ${response.status} - ${error}`);
    }
    
    const result = await response.json();
    return result.text || result.transcription || '';
  }
  
  private async transcribeAudioGroq(audioBuffer: Buffer, language?: string): Promise<string> {
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer as unknown as BlobPart], { type: 'audio/ogg; codecs=opus' });
    formData.append('file', audioBlob, 'voice.oga');
    formData.append('model', 'whisper-large-v3');
    if (language) formData.append('language', language);
    formData.append('response_format', 'json');
    
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq transcription error: ${response.status} - ${error}`);
    }
    
    const result = await response.json();
    return result.text || result.transcription || '';
  }
}

export const freeLLMClient = new FreeLLMClient();

export function getFreeLLMClient(): FreeLLMClient {
  return freeLLMClient;
}
