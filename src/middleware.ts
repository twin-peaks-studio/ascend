import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  generateNonce,
  buildCSPHeader,
  getCSPMode,
  getCSPHeaderName,
} from "@/lib/security/csp";

/**
 * Middleware to:
 * 1. Refresh Supabase auth session
 * 2. Apply Content Security Policy (CSP) headers
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If env vars are missing, just pass through
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  await supabase.auth.getUser();

  // Apply Content Security Policy (CSP)
  const cspMode = getCSPMode();

  if (cspMode !== 'disabled') {
    const nonce = generateNonce();
    const cspHeader = buildCSPHeader(nonce, cspMode);
    const headerName = getCSPHeaderName(cspMode);

    // Add CSP header
    supabaseResponse.headers.set(headerName, cspHeader);

    // Pass nonce to the page via custom header (for use in script/style tags)
    supabaseResponse.headers.set('x-nonce', nonce);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
