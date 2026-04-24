import { NextResponse } from 'next/server';
import { generateImage as openaiGenerate } from '../../../lib/providers/openai-provider';
import { generateImage as godTiboGenerate } from '../../../lib/providers/god-tibo-provider';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, provider, size, quality } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 },
      );
    }

    let imageDataUrl: string;

    if (provider === 'god-tibo') {
      imageDataUrl = await godTiboGenerate({ prompt });
    } else {
      imageDataUrl = await openaiGenerate({ prompt, size, quality });
    }

    return NextResponse.json({
      success: true,
      imageDataUrl,
      prompt,
      provider: provider ?? 'openai',
    });
  } catch (error) {
    console.error('Generate error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
