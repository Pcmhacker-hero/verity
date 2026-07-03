import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/projects', '/settings'];

// Basic in-memory rate limit map (use Redis in production)
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.includes('session_token'));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  
  // 0. Request ID Generation
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  request.headers.set('x-request-id', requestId);

  // API Route Handling: Rate Limiting & CORS
  if (pathname.startsWith('/api/')) {
    // 1. Rate Limiting
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const now = Date.now();
    const userRecord = rateLimitMap.get(ip) || { count: 0, timestamp: now };
    
    if (now - userRecord.timestamp > RATE_LIMIT_WINDOW) {
      userRecord.count = 1;
      userRecord.timestamp = now;
    } else {
      userRecord.count++;
    }
    
    rateLimitMap.set(ip, userRecord);
    
    if (userRecord.count > MAX_REQUESTS) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', requestId },
        { status: 429, headers: { 'x-request-id': requestId } }
      );
    }

    // 2. CORS Headers
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id');
    response.headers.set('x-request-id', requestId);
    
    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { headers: response.headers, status: 204 });
    }
    
    return response;
  }

  // App Route Handling: Auth Protection
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isProtectedRoute || hasSessionCookie(request)) {
    const res = NextResponse.next({
      request: { headers: request.headers },
    });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  const redirectRes = NextResponse.redirect(loginUrl);
  redirectRes.headers.set('x-request-id', requestId);
  return redirectRes;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
