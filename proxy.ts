import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths to exclude from authentication
  const isPublicPath = 
    pathname === '/login' || 
    pathname.startsWith('/_next') || 
    pathname.includes('.') || // Static files like favicon.ico, images, etc.
    pathname.includes('api/'); // Exclude API if necessary, but here we might want to protect it too

  if (isPublicPath) {
    return NextResponse.next();
  }

  const authSession = request.cookies.get('auth_session');

  if (!authSession) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Config matches all routes except for specific exclusions
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
