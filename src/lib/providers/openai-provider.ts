import OpenAI from 'openai';

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

export interface GenerateImageOptions {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

export interface EditImageOptions {
  images: File[];
  maskImage?: File;
  prompt: string;
}

export async function generateImage(options: GenerateImageOptions): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: options.prompt,
    n: 1,
    size: options.size ?? '1024x1024',
    response_format: 'b64_json',
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('No image returned from OpenAI');
  }

  return `data:image/png;base64,${b64}`;
}

export async function editImage(options: EditImageOptions): Promise<string> {
  const openai = getOpenAI();

  const response = await openai.images.edit({
    image: options.images,
    ...(options.maskImage ? { mask: options.maskImage } : {}),
    prompt: options.prompt,
    model: 'gpt-image-2',
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json',
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('No image returned from OpenAI');
  }

  return `data:image/png;base64,${b64}`;
}
