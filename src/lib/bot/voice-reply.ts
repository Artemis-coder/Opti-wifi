// ============================================================
// OPTIWIFI - Réponse vocale du bot Telegram (ElevenLabs) : quand le super admin envoie une note
// vocale, l'assistant répond par écrit puis par une courte note vocale (résumé parlé).
// ============================================================
import { hydrateTelegramEnv } from '@/lib/integration-secrets';

const DEFAULT_VOICE_ID = '4SFJvuIUvxaPLgk8FoK3';
// Modèle rapide et économique (environ 0,5 crédit par caractère)
const TTS_MODEL = 'eleven_flash_v2_5';
const MAX_SPOKEN_CHARS = 450;
export const VOICE_MARKER = '🔊';

/** Consigne ajoutée à la question quand elle arrive par note vocale. */
export const VOICE_INSTRUCTION =
  `(Question posée par message vocal : termine ta réponse par une dernière ligne qui commence par « ${VOICE_MARKER} » ` +
  'suivie d’un résumé parlé de 2 à 3 phrases, 350 caractères maximum, en texte simple sans HTML ni liste, ' +
  'avec les montants écrits comme on les dit.)';

export function isVoiceReplyConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

/** Sépare le résumé parlé (ligne 🔊) du texte affiché. Sans ligne 🔊 : début du texte, sans balises. */
export function splitSpokenSummary(text: string): { display: string; spoken: string } {
  const lines = text.split('\n');
  const idx = lines.map((l) => l.trim().startsWith(VOICE_MARKER)).lastIndexOf(true);
  if (idx >= 0) {
    const spoken = lines[idx].trim().slice(VOICE_MARKER.length).trim();
    const display = [...lines.slice(0, idx), ...lines.slice(idx + 1)].join('\n').trim();
    return { display, spoken: clip(plain(spoken)) };
  }
  return { display: text, spoken: clip(plain(text)) };
}

function plain(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/^[\s•\-–—]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(text: string): string {
  if (text.length <= MAX_SPOKEN_CHARS) return text;
  const cut = text.slice(0, MAX_SPOKEN_CHARS);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 150 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Synthèse ElevenLabs (MP3) puis envoi en note vocale. Ne lève jamais : le texte est déjà parti. */
export async function sendVoiceReply(chatId: string, spoken: string): Promise<boolean> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey || !spoken) return false;
  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
    const tts = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey, Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: spoken,
        model_id: TTS_MODEL,
        language_code: 'fr',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!tts.ok) {
      // Pas de détail de la réponse : il peut contenir des informations de compte
      console.error('ElevenLabs TTS error:', tts.status);
      return false;
    }
    const audio = await tts.arrayBuffer();

    await hydrateTelegramEnv();
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) return false;
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('voice', new Blob([audio], { type: 'audio/mpeg' }), 'reponse.mp3');
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) console.error('Telegram sendVoice error:', res.status);
    return res.ok;
  } catch (err) {
    console.error('Voice reply error:', err instanceof Error ? err.name : 'unknown');
    return false;
  }
}
