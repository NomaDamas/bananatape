import { NextResponse } from 'next/server';
import { clearProjectDesignContext, setProjectDesignContext } from '@/lib/projects/metadata-store';
import { requireProjectSession } from '@/lib/projects/session';

export const runtime = 'nodejs';

export const MAX_DESIGN_CONTEXT_BYTES = 256 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'text/markdown',
  'text/x-markdown',
  'text/plain',
  'application/octet-stream',
  '',
]);

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function hasMarkdownExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown');
}

function settingsResponse(settings: Awaited<ReturnType<typeof setProjectDesignContext>>) {
  return NextResponse.json({
    designContext: settings.designContext ?? '',
    designContextFileName: settings.designContextFileName ?? '',
  });
}

export async function POST(request: Request) {
  try {
    const session = requireProjectSession();
    const formData = await request.formData();
    const candidate = formData.get('designContext');
    if (!isFile(candidate)) {
      return NextResponse.json({ error: 'A markdown file is required' }, { status: 400 });
    }
    if (!hasMarkdownExtension(candidate.name) || !ALLOWED_MIME_TYPES.has(candidate.type)) {
      return NextResponse.json(
        { error: 'Design context must be a .md or .markdown file' },
        { status: 400 },
      );
    }
    if (candidate.size > MAX_DESIGN_CONTEXT_BYTES) {
      return NextResponse.json(
        { error: `Design context file must be smaller than ${Math.round(MAX_DESIGN_CONTEXT_BYTES / 1024)} KB` },
        { status: 413 },
      );
    }

    const content = await candidate.text();
    const settings = await setProjectDesignContext(session.projectRoot, {
      content,
      fileName: candidate.name,
    });
    return settingsResponse(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update design context';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const session = requireProjectSession();
    const settings = await clearProjectDesignContext(session.projectRoot);
    return settingsResponse(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to clear design context';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
