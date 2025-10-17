/**
 * Next.js Middleware para protección de rutas
 *
 * Permite acceso público a rutas de autenticación y recuperación de contraseña.
 * Todas las demás rutas requieren autenticación.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir acceso a rutas públicas
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Permitir acceso a archivos estáticos y API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Verificar autenticación para rutas protegidas
  // (Implementación básica - ajustar según tu sistema de auth)
  const accessToken = request.cookies.get('access');

  if (!accessToken && pathname !== '/login') {
    // Redirigir a login si no está autenticado
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
