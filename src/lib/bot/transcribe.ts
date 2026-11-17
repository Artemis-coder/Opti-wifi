/**
 * Transcription des notes vocales Telegram (Whisper).
 * Groq d'abord (gratuit), OpenRouter en relais. Les clés sont lues à l'appel,
 * pour tenir compte des secrets chargés depuis le back-office.
 */

async function whisper(url: string, apiKey: string, model: string, audio: Buffer, language: string): Promise<string> {
  const form = new FormData();
  // Les notes vocales Telegram sont en OGG/Opus ; l'extension .oga est refusée par Groq
  form.append('file', new Blob([audio as unknown as BlobPart], { type: 'audio/ogg' }), 'voice.ogg');
  form.append('model', model);
  form.append('language', language);
  form.append('response_format', 'json');

  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  if (!res.ok) throw new Error(`Transcription ${new URL(url).host} : HTTP ${res.status}`);
  const data = await res.json();
  return String(data.text || data.transcription || '');
}

export async function transcribeAudio(audio: Buffer, language = 'fr'): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();

  if (groqKey) {
    try {
      return await whisper('https://api.groq.com/openai/v1/audio/transcriptions', groqKey, 'whisper-large-v3', audio, language);
    } catch (e) {
      if (!openRouterKey) throw e;
      console.warn('Groq transcription failed, trying OpenRouter:', e);
    }
  }
  if (openRouterKey) {
    return whisper('https://openrouter.ai/api/v1/audio/transcriptions', openRouterKey, 'openai/whisper-large-v3', audio, language);
  }
  throw new Error('Aucun service de transcription configuré (GROQ_API_KEY ou OPENROUTER_API_KEY).');
}

/** Télécharge une note vocale Telegram et la transcrit. */
export async function transcribeTelegramVoice(fileId: string): Promise<string> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const fileData = await fileRes.json();
  if (!fileData.ok) throw new Error('Fichier audio introuvable');
  const audioRes = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`);
  if (!audioRes.ok) throw new Error(`Téléchargement audio : HTTP ${audioRes.status}`);
  return (await transcribeAudio(Buffer.from(await audioRes.arrayBuffer()))).trim();
}
