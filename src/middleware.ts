import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Block fake Server Action requests (bot/scanner probes)
  // This project doesn't use Server Actions, so any such request is illegitimate
  const nextAction = request.headers.get('next-action');
  if (nextAction) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except static files and images
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
