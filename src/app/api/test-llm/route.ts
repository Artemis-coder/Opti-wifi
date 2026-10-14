import { NextResponse } from 'next/server';
import { getOpenRouterClient } from '@/lib/openrouter';

export async function GET() {
  try {
    const client = getOpenRouterClient();
    const response = await client.chatCompletion({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: 'Say hello in French' }],
      max_tokens: 50,
    });
    return NextResponse.json({ ok: true, response: response.choices[0].message.content });
  } catch (error) {
    console.error('Test LLM error:', error);
    return NextResponse.json({ ok: false, error: error.message });
  }
}
