import { NextResponse } from 'next/server';
import { freeLLMClient, selectBestAvailableModel } from '@/lib/free-llm';

export async function GET() {
  try {
    const model = selectBestAvailableModel('Say hello in French');
    const client = freeLLMClient;
    const response = await client.chatCompletion({
      model,
      messages: [{ role: 'user', content: 'Say hello in French' }],
      max_tokens: 50,
    });
    return NextResponse.json({ ok: true, model, response: response.choices[0].message.content });
  } catch (error) {
    console.error('Test Groq error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message });
  }
}
