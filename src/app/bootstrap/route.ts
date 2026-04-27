import { NextRequest, NextResponse } from 'next/server';
import { exchangeBootstrapToken } from '@/lib/projects/session';

export const runtime = 'nodejs';

export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  try {
    const session = exchangeBootstrapToken(token);
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set(session.cookieName, session.sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired bootstrap token' }, { status: 401 });
  }
}
