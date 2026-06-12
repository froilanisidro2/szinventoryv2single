import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow auth pages without protection
  if (pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  // This deployment is single-company — the superadmin panel is disabled.
  if (pathname.startsWith('/superadmin')) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Try to get user from cookie (in production, parse secure session cookie)
  // For now, we rely on client-side redirect based on localStorage
  // Middleware can't read localStorage directly, so we handle auth on client
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
