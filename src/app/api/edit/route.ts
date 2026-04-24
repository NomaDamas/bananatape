import { NextResponse } from 'next/server';
import { editImage } from '../../../lib/providers/openai-provider';
import { generateImage as godTiboGenerate } from '../../../lib/providers/god-tibo-provider';

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');
  return `data:${file.type};base64,${base64}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const prompt = formData.get('prompt');
    const provider = formData.get('provider');
    const originalImage = formData.get('originalImage');
    const maskImage = formData.get('maskImage');
    const annotatedImage = formData.get('annotatedImage');

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 },
      );
    }

    if (typeof provider !== 'string' || !provider.trim()) {
      return NextResponse.json(
        { error: 'provider is required' },
        { status: 400 },
      );
    }

    let imageDataUrl: string;

    if (provider === 'god-tibo') {
      if (!isFile(originalImage) || !isFile(annotatedImage)) {
        return NextResponse.json(
          {
            error:
              'originalImage and annotatedImage are required and must be valid files for god-tibo',
          },
          { status: 400 },
        );
      }

      const [originalDataUrl, annotatedDataUrl] = await Promise.all([
        fileToDataUrl(originalImage),
        fileToDataUrl(annotatedImage),
      ]);

      imageDataUrl = await godTiboGenerate({
        prompt,
        images: [originalDataUrl, annotatedDataUrl],
      });

      return NextResponse.json({
        success: true,
        imageDataUrl,
        prompt,
        provider: 'god-tibo',
      });
    }

    if (!isFile(originalImage) || !isFile(maskImage)) {
      return NextResponse.json(
        {
          error:
            'originalImage and maskImage are required and must be valid files',
        },
        { status: 400 },
      );
    }

    imageDataUrl = await editImage({
      originalImage,
      annotatedImage: isFile(annotatedImage) ? annotatedImage : undefined,
      maskImage,
      prompt,
    });

    return NextResponse.json({
      success: true,
      imageDataUrl,
      prompt,
      provider: 'openai',
    });
  } catch (error) {
    console.error('Edit error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
