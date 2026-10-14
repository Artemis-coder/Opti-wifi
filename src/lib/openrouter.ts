/**
 * OpenRouter Client - Free LLM API with function calling support
 * Supports: DeepSeek, Llama, Mistral, Qwen, and many more free models
 * Also supports voice transcription via Whisper
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Free models available on OpenRouter (as of 2024)
export const FREE_MODELS = {
  // DeepSeek models
  'deepseek/deepseek-chat': { name: 'DeepSeek Chat', context: 32768, free: true },
  'deepseek/deepseek-r1': { name: 'DeepSeek R1', context: 32768, free: true },
  
  // Llama models
  'meta-llama/llama-3.1-8b-instruct': { name: 'Llama 3.1 8B', context: 131072, free: true },
  'meta-llama/llama-3.1-70b-instruct': { name: 'Llama 3.1 70B', context: 131072, free: true },
  'meta-llama/llama-3.2-3b-instruct': { name: 'Llama 3.2 3B', context: 131072, free: true },
  
  // Mistral models
  'mistralai/mistral-7b-instruct': { name: 'Mistral 7B', context: 32768, free: true },
  'mistralai/mixtral-8x7b-instruct': { name: 'Mixtral 8x7B', context: 32768, free: true },
  
  // Qwen models
  'qwen/qwen-2.5-7b-instruct': { name: 'Qwen 2.5 7B', context: 32768, free: true },
  'qwen/qwen-2.5-72b-instruct': { name: 'Qwen 2.5 72B', context: 32768, free: true },
  
  // Google Gemma
  'google/gemma-2-9b-it': { name: 'Gemma 2 9B', context: 8192, free: true },
  
  // Microsoft Phi
  'microsoft/phi-3-mini-128k-instruct': { name: 'Phi-3 Mini', context: 128000, free: true },
  'microsoft/phi-3-medium-128k-instruct': { name: 'Phi-3 Medium', context: 128000, free: true },

  // Multimodal / Vision models (free)
  'microsoft/phi-3-vision-128k-instruct': { name: 'Phi-3 Vision', context: 128000, free: true, vision: true },
  'qwen/qwen-2.5-vl-7b-instruct': { name: 'Qwen 2.5 VL 7B', context: 32768, free: true, vision: true },
  'meta-llama/llama-3.2-11b-vision-instruct': { name: 'Llama 3.2 11B Vision', context: 131072, free: true, vision: true },

  // Audio/Transcription models (free on OpenRouter)
  'openai/whisper-large-v3': { name: 'Whisper Large v3', context: 0, free: true, audio: true },
  'openai/whisper-large-v3-turbo': { name: 'Whisper Large v3 Turbo', context: 0, free: true, audio: true },
} as const;

export const DEFAULT_MODEL = 'deepseek/deepseek-chat';

export type ModelId = keyof typeof FREE_MODELS;

export type ModelInfo = (typeof FREE_MODELS)[ModelId] & { audio?: boolean; vision?: boolean };

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: Tool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel: string = DEFAULT_MODEL) {
    this.apiKey = apiKey || OPENROUTER_API_KEY || '';
    this.baseUrl = OPENROUTER_BASE_URL;
    this.defaultModel = defaultModel;
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://www.optiwifi.site',
        'X-Title': 'OptiWifi Telegram Bot',
      },
      body: JSON.stringify({
        ...request,
        model: request.model || this.defaultModel,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

async transcribeAudio(audioBuffer: Buffer, language?: string, model?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    const transcriptionModel = model || 'openai/whisper-large-v3';

    const formData = new FormData();
    // Telegram voice messages are OGG/Opus - use correct MIME type
    // Buffer can be used directly with Blob in Node.js 18+
    const audioBlob = new Blob([audioBuffer as unknown as BlobPart], { type: 'audio/ogg; codecs=opus' });
    formData.append('file', audioBlob, 'voice.oga');
    formData.append('model', transcriptionModel);
    if (language) formData.append('language', language);
    formData.append('response_format', 'json');

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Transcription error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    return result.text || result.transcription || '';
  }

  getModelInfo(modelId: string) {
    return FREE_MODELS[modelId as ModelId] || { name: DEFAULT_MODEL, context: 32768, free: true };
  }
}

// Singleton instance
let openRouterClient: OpenRouterClient | null = null;

export function getOpenRouterClient(): OpenRouterClient {
  if (!openRouterClient) {
    openRouterClient = new OpenRouterClient();
  }
  return openRouterClient;
}

export function setOpenRouterApiKey(apiKey: string) {
  openRouterClient = new OpenRouterClient(apiKey);
}

// ElevenLabs TTS Client (Text-to-Speech)
// Note: ElevenLabs does NOT provide transcription (STT), only TTS
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

export class ElevenLabsClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ELEVENLABS_API_KEY || '';
  }

  async textToSpeech(text: string, voiceId: string = '21m00Tcm4TlvDq8ikWAM', modelId: string = 'eleven_multilingual_v2'): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const response = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs TTS error: ${response.status} - ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getVoices() {
    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: { 'xi-api-key': this.apiKey },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs voices error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}

let elevenLabsClient: ElevenLabsClient | null = null;

export function getElevenLabsClient(): ElevenLabsClient {
  if (!elevenLabsClient) {
    elevenLabsClient = new ElevenLabsClient();
  }
  return elevenLabsClient;
}

export function setElevenLabsApiKey(apiKey: string) {
  elevenLabsClient = new ElevenLabsClient(apiKey);
}