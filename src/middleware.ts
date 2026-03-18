import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CANONICAL_HOST = 'dreamshop18.com';

export function middleware(request: NextRequest) {
  // Block fake Server Action requests (bot/scanner probes)
  // This project doesn't use Server Actions, so any such request is illegitimate
  const nextAction = request.headers.get('next-action');
  if (nextAction) {
    return new NextResponse(null, { status: 404 });
  }

  // Redirect www → non-www (301 permanent) to avoid duplicate content
  const host = request.headers.get('host') || '';
  if (host.startsWith('www.')) {
    const url = request.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except static files and images
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
